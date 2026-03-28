/**
 * Verdict Router - Main Orchestrator
 * 
 * Brings together classification, selection, and execution
 */

import { randomUUID } from 'crypto';
import { TaskClassifier } from './classifier.js';
import { selectModel } from './selector.js';
import { RouterStorage } from './storage.js';
import { DSPyRouter, ShadowModeLogger, type DSPyRouterConfig } from './dspy-router.js';
import type {
  TaskCategory,
  TaskRun,
  SelectionConstraints,
  RouterConfig,
  ModelChoice,
  Classification,
} from './types.js';
import { DEFAULT_ROUTER_CONFIG } from './types.js';

export class VerdictRouter {
  private classifier: TaskClassifier;
  private storage: RouterStorage;
  private dspyRouter?: DSPyRouter;
  private shadowLogger?: ShadowModeLogger;
  private shadowMode: boolean = false;

  constructor(
    private dbPath: string,
    private config: RouterConfig = DEFAULT_ROUTER_CONFIG as RouterConfig,
    dspyConfig?: DSPyRouterConfig
  ) {
    this.classifier = new TaskClassifier();
    this.storage = new RouterStorage(dbPath, config);
    
    // Initialize DSPy router if config provided
    if (dspyConfig) {
      this.dspyRouter = new DSPyRouter(dspyConfig);
      this.shadowLogger = new ShadowModeLogger();
      this.shadowMode = true;
    }
  }

  /**
   * Main entry point: Route a prompt to best model
   */
  async route(
    prompt: string,
    constraints: SelectionConstraints = {}
  ): Promise<{
    classification: Classification;
    choice: ModelChoice;
    runId: string;
    shadow?: { dspy: any; heuristic: any };
  }> {
    // 1. Classify task (heuristic)
    const classification = this.classifier.classify(prompt, constraints.category);

    // 2. Get performance data for this category
    const performanceData = this.storage.getPerformanceForCategory(classification.category);
    const preferences = this.storage.getPreferences();

    // 3. Select best model using eval history
    const selected = selectModel(this.storage.db, {
      taskType: classification.category,
      preferLocal: constraints.preferLocal,
      minScore: constraints.minQuality,
    });
    const choice: ModelChoice = selected
      ? {
          model: selected.modelId,
          reason: selected.reason,
          expectedScore: selected.score,
          expectedLatency: 0,
          confidence: classification.confidence,
          isExploration: false,
        }
      : {
          model: 'unknown',
          reason: 'No eval history — run `verdict run` first to build model performance data',
          expectedScore: 0,
          expectedLatency: 0,
          confidence: 0,
          isExploration: true,
        };

    // 4. Shadow mode: Compare with DSPy router
    let shadowData: { dspy: any; heuristic: any } | undefined;
    
    if (this.shadowMode && this.dspyRouter && this.shadowLogger) {
      try {
        const dspyDecision = await this.dspyRouter.route(prompt);
        
        const heuristicData = {
          category: classification.category,
          model: choice.model,
        };
        
        const dspyData = dspyDecision ? {
          category: dspyDecision.category,
          complexity: dspyDecision.complexity,
          model: dspyDecision.model || dspyDecision.recommended_model || 'unknown',
        } : null;
        
        this.shadowLogger.log(prompt, heuristicData, dspyData);
        
        shadowData = { dspy: dspyData, heuristic: heuristicData };
      } catch (error) {
        console.warn('[Shadow Mode] DSPy routing failed:', error);
      }
    }

    // 5. Create run record
    const runId = randomUUID();

    return {
      classification,
      choice,
      runId,
      shadow: shadowData,
    };
  }

  /**
   * Record task completion
   */
  recordCompletion(
    runId: string,
    prompt: string,
    classification: Classification,
    choice: ModelChoice,
    result: {
      output?: string;
      latency?: number;
      status: "success" | "timeout" | "crash" | "error";
      errorMessage?: string;
    },
    feedback?: {
      correctedModel?: string;
      rating?: number;
      wasHelpful?: boolean;
    }
  ): void {
    const run: TaskRun = {
      id: runId,
      prompt,
      category: classification.category,
      classificationConfidence: classification.confidence,
      classificationMethod: classification.method,
      selectedModel: choice.model,
      selectionReason: choice.reason,
      wasExploration: choice.isExploration,
      result: result.output,
      latency: result.latency,
      status: result.status,
      errorMessage: result.errorMessage,
      userFeedback: feedback,
      timestamp: new Date(),
    };

    this.storage.storeRun(run);
  }

  /**
   * Get shadow mode statistics
   */
  getShadowStats() {
    if (!this.shadowLogger) return null;
    return this.shadowLogger.getSummary();
  }

  /**
   * Flush shadow logs to disk
   */
  async flushShadowLogs(): Promise<void> {
    if (this.shadowLogger) {
      await this.shadowLogger.flush();
    }
  }

  /**
   * Close storage
   */
  close(): void {
    this.storage.close();
  }
}

export * from './types.js';
export { DSPyRouter, ShadowModeLogger, type DSPyRouterConfig } from './dspy-router.js';
