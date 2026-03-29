/**
 * DSPy Router Integration - Shadow Mode
 * 
 * Wraps the Python DSPy router for comparison with heuristic router
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import type { Classification } from './types.js';

const execFileAsync = promisify(execFile);

export interface DSPyRouterConfig {
  pythonPath?: string;
  scriptPath: string;
  timeout?: number;
}

export interface DSPyRoutingDecision {
  category: string;
  complexity: string;
  model?: string;  // New format
  recommended_model?: string;  // Old format (for backward compat)
  error?: string;
  reasoning?: string;
  confidence?: number;
}

export class DSPyRouter {
  private pythonPath: string;
  private scriptPath: string;
  private timeout: number;

  constructor(config: DSPyRouterConfig) {
    this.pythonPath = config.pythonPath || 'python3';
    this.scriptPath = config.scriptPath;
    this.timeout = config.timeout || 10000; // 10s default
  }

  /**
   * Route a task using DSPy-optimized model
   */
  async route(prompt: string): Promise<DSPyRoutingDecision | null> {
    try {
      // Use execFile instead of exec to prevent shell injection from user-supplied prompt.
      // The prompt is passed as a discrete argument, never interpolated into a shell string.
      const { stdout, stderr } = await execFileAsync(
        this.pythonPath,
        [this.scriptPath, prompt],
        {
          timeout: this.timeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        }
      );

      if (stderr && !stderr.includes('Warning')) {
        console.warn('[DSPy Router] stderr:', stderr);
      }

      const result = JSON.parse(stdout.trim());
      return result;
    } catch (error) {
      console.error('[DSPy Router] Error:', error);
      return null;
    }
  }

  /**
   * Convert DSPy decision to Verdict Classification format
   */
  toClassification(decision: DSPyRoutingDecision): Classification {
    return {
      category: this.mapCategory(decision.category),
      confidence: decision.confidence || 0.8,
      signals: [],
      method: 'auto',
    };
  }

  private mapCategory(category: string): Classification['category'] {
    const map: Record<string, Classification['category']> = {
      'tool-calling': 'general',
      'tool_call': 'general',
      'reasoning': 'reasoning',
      'code-generation': 'code_generation',
      'code_generation': 'code_generation',
      'code-review': 'code_review',
      'code_review': 'code_review',
      'bug-analysis': 'bug_analysis',
      'bug_analysis': 'bug_analysis',
      'writing': 'writing',
      'general': 'general',
      'math': 'math',
      'creative': 'writing',
    };
    return map[category] ?? 'general';
  }

  private mapComplexity(complexity: string): string {
    const valid = ['simple', 'moderate', 'complex'];
    return valid.includes(complexity) ? complexity : 'moderate';
  }

  /**
   * Health check - verify Python script is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testPrompt = "Test task";
      const result = await this.route(testPrompt);
      return result !== null;
    } catch {
      return false;
    }
  }
}

/**
 * Shadow Mode Logger - Compare two routing decisions
 */
export interface ShadowModeLog {
  timestamp: string;
  prompt: string;
  heuristic: {
    category: string;
    complexity?: string;
    model: string;
  };
  dspy: {
    category: string;
    complexity?: string;
    model: string;
  } | null;
  agreement: boolean;
  disagreement_type?: 'category' | 'complexity' | 'model' | 'all';
}

export class ShadowModeLogger {
  private logs: ShadowModeLog[] = [];
  private logPath: string;

  constructor(logPath?: string) {
    this.logPath = logPath || join(process.cwd(), '.verdict-shadow-logs.jsonl');
  }

  /**
   * Log a routing decision comparison
   */
  log(
    prompt: string,
    heuristic: { category: string; complexity?: string; model: string },
    dspy: { category: string; complexity?: string; model: string } | null
  ): void {
    const entry: ShadowModeLog = {
      timestamp: new Date().toISOString(),
      prompt,
      heuristic,
      dspy,
      agreement: this.checkAgreement(heuristic, dspy),
    };

    if (!entry.agreement && dspy) {
      entry.disagreement_type = this.getDisagreementType(heuristic, dspy);
    }

    this.logs.push(entry);
  }

  private checkAgreement(
    heuristic: { category: string; complexity?: string; model: string },
    dspy: { category: string; complexity?: string; model: string } | null
  ): boolean {
    if (!dspy) return false;
    
    return (
      heuristic.category === dspy.category &&
      heuristic.complexity === dspy.complexity &&
      heuristic.model === dspy.model
    );
  }

  private getDisagreementType(
    heuristic: { category: string; complexity?: string; model: string },
    dspy: { category: string; complexity?: string; model: string }
  ): 'category' | 'complexity' | 'model' | 'all' {
    const categoryMatch = heuristic.category === dspy.category;
    const complexityMatch = heuristic.complexity === dspy.complexity;
    const modelMatch = heuristic.model === dspy.model;

    if (!categoryMatch && !complexityMatch && !modelMatch) return 'all';
    if (!categoryMatch) return 'category';
    if (!complexityMatch) return 'complexity';
    if (!modelMatch) return 'model';
    return 'all';
  }

  /**
   * Get current logs
   */
  getLogs(): ShadowModeLog[] {
    return this.logs;
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const total = this.logs.length;
    const dsypSuccessful = this.logs.filter((l) => l.dspy !== null).length;
    const agreements = this.logs.filter((l) => l.agreement).length;

    const disagreements = this.logs.filter((l) => !l.agreement && l.dspy);
    const byType = {
      category: disagreements.filter((l) => l.disagreement_type === 'category').length,
      complexity: disagreements.filter((l) => l.disagreement_type === 'complexity').length,
      model: disagreements.filter((l) => l.disagreement_type === 'model').length,
      all: disagreements.filter((l) => l.disagreement_type === 'all').length,
    };

    return {
      total_decisions: total,
      dspy_successful: dsypSuccessful,
      dspy_failure_rate: total > 0 ? ((total - dsypSuccessful) / total * 100).toFixed(1) + '%' : '0%',
      agreement: agreements,
      agreement_rate: dsypSuccessful > 0 ? ((agreements / dsypSuccessful) * 100).toFixed(1) + '%' : '0%',
      disagreements: disagreements.length,
      disagreement_breakdown: byType,
    };
  }

  /**
   * Write logs to file
   */
  async flush(): Promise<void> {
    const fs = await import('fs/promises');
    const lines = this.logs.map((log) => JSON.stringify(log)).join('\n');
    await fs.writeFile(this.logPath, lines + '\n', 'utf-8');
  }
}
