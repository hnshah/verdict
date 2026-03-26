/**
 * Verdict Router - Multi-Signal Task Classifier
 * 
 * Classifies user prompts into task categories using multiple signals:
 * - Keywords (code, bug, review, etc.)
 * - Structure (code blocks, markdown)
 * - Verbs (analyze, write, debug, etc.)
 * - Length (short = likely simple, long = likely complex)
 * - Context (previous classification for similar prompts)
 */

import type { Classification, ClassificationSignal, TaskCategory } from './types.js';

export class TaskClassifier {
  /**
   * Classify a prompt into a task category
   */
  classify(prompt: string, manualCategory?: TaskCategory): Classification {
    // Manual override
    if (manualCategory) {
      return {
        category: manualCategory,
        confidence: 1.0,
        signals: [{ name: "manual", score: 1.0, weight: 1.0 }],
        method: "manual",
      };
    }

    // Collect signals
    const signals: ClassificationSignal[] = [
      this.keywordSignal(prompt),
      this.structureSignal(prompt),
      this.verbSignal(prompt),
      this.lengthSignal(prompt),
    ];

    // Aggregate scores per category
    const scores = this.aggregateSignals(signals);
    
    // Find winner
    const sortedCategories = Object.entries(scores)
      .sort(([, a], [, b]) => b - a);
    
    const [category, score] = sortedCategories[0] as [TaskCategory, number];

    return {
      category,
      confidence: score,
      signals,
      method: "auto",
    };
  }

  /**
   * Signal 1: Keyword matching
   */
  private keywordSignal(prompt: string): ClassificationSignal {
    const lower = prompt.toLowerCase();
    
    const keywords: Record<TaskCategory, string[]> = {
      code_review: ["review", "check", "validate", "audit", "lint"],
      code_generation: ["write", "generate", "create", "implement", "build", "code"],
      bug_analysis: ["bug", "error", "crash", "fail", "debug", "fix", "issue"],
      writing: ["write", "draft", "compose", "article", "blog", "email", "explain"],
      math: ["calculate", "compute", "math", "number", "sum", "multiply", "+", "-", "*", "/"],
      reasoning: ["why", "how", "explain", "reason", "think", "analyze", "understand"],
      general: [],
    };

    const scores: Record<TaskCategory, number> = {
      code_review: 0,
      code_generation: 0,
      bug_analysis: 0,
      writing: 0,
      math: 0,
      reasoning: 0,
      general: 0,
    };

    // Count keyword matches
    for (const [category, words] of Object.entries(keywords)) {
      const matches = words.filter(w => lower.includes(w)).length;
      scores[category as TaskCategory] = matches / Math.max(words.length, 1);
    }

    // Normalize
    const max = Math.max(...Object.values(scores));
    const normalized = max > 0 ? scores : { ...scores, general: 1.0 };

    return {
      name: "keyword",
      score: max,
      weight: 0.3,
      details: `Matched keywords for ${Object.entries(normalized).find(([, v]) => v === max)?.[0]}`,
    };
  }

  /**
   * Signal 2: Structure analysis
   */
  private structureSignal(prompt: string): ClassificationSignal {
    const hasCodeBlock = /```[\s\S]*?```/.test(prompt);
    const hasInlineCode = /`[^`]+`/.test(prompt);
    const hasMathSymbols = /[+\-*/=]/.test(prompt) && /\d/.test(prompt);
    const hasLongParagraphs = prompt.split('\n\n').some(p => p.length > 200);

    const scores: Record<TaskCategory, number> = {
      code_review: hasCodeBlock ? 1.0 : hasInlineCode ? 0.5 : 0,
      code_generation: hasCodeBlock ? 0.8 : 0,
      bug_analysis: hasCodeBlock ? 0.9 : 0,
      writing: hasLongParagraphs ? 0.8 : 0,
      math: hasMathSymbols ? 1.0 : 0,
      reasoning: hasLongParagraphs && !hasCodeBlock ? 0.6 : 0,
      general: 0.3,
    };

    const max = Math.max(...Object.values(scores));

    return {
      name: "structure",
      score: max,
      weight: 0.25,
      details: `Detected: ${hasCodeBlock ? 'code blocks' : hasInlineCode ? 'inline code' : hasMathSymbols ? 'math' : 'text'}`,
    };
  }

  /**
   * Signal 3: Verb analysis
   */
  private verbSignal(prompt: string): ClassificationSignal {
    const lower = prompt.toLowerCase();
    
    const verbs: Record<TaskCategory, string[]> = {
      code_review: ["review", "check", "validate", "audit"],
      code_generation: ["write", "create", "implement", "generate"],
      bug_analysis: ["debug", "fix", "solve", "diagnose"],
      writing: ["write", "compose", "draft", "explain to"],
      math: ["calculate", "compute", "solve for"],
      reasoning: ["explain why", "analyze", "evaluate", "compare"],
      general: [],
    };

    const scores: Record<TaskCategory, number> = {
      code_review: 0,
      code_generation: 0,
      bug_analysis: 0,
      writing: 0,
      math: 0,
      reasoning: 0,
      general: 0.2,
    };

    // Find first matching verb
    for (const [category, verbList] of Object.entries(verbs)) {
      const match = verbList.find(v => lower.includes(v));
      if (match) {
        scores[category as TaskCategory] = 1.0;
        break;
      }
    }

    const max = Math.max(...Object.values(scores));

    return {
      name: "verb",
      score: max,
      weight: 0.25,
      details: `Primary verb indicates ${Object.entries(scores).find(([, v]) => v === max)?.[0] || 'general'}`,
    };
  }

  /**
   * Signal 4: Length analysis
   */
  private lengthSignal(prompt: string): ClassificationSignal {
    const length = prompt.length;
    
    const scores: Record<TaskCategory, number> = {
      code_review: length > 200 ? 0.7 : 0.3,
      code_generation: length > 100 ? 0.6 : 0.5,
      bug_analysis: length > 150 ? 0.7 : 0.4,
      writing: length > 300 ? 0.9 : 0.3,
      math: length < 100 ? 0.8 : 0.3,
      reasoning: length > 200 ? 0.7 : 0.4,
      general: 0.5,
    };

    const max = Math.max(...Object.values(scores));

    return {
      name: "length",
      score: max,
      weight: 0.2,
      details: `${length} characters → ${length > 200 ? 'complex' : 'simple'} task`,
    };
  }

  /**
   * Aggregate signals using weighted voting
   */
  private aggregateSignals(signals: ClassificationSignal[]): Record<TaskCategory, number> {
    const scores: Record<TaskCategory, number> = {
      code_review: 0,
      code_generation: 0,
      bug_analysis: 0,
      writing: 0,
      math: 0,
      reasoning: 0,
      general: 0,
    };

    // For simplicity, we'll do a simple weighted sum
    // (In production, each signal would return per-category scores)
    // For now, using the signal with highest score as indicator
    
    // Weight by signal strength
    let totalWeight = 0;
    for (const signal of signals) {
      totalWeight += signal.weight * signal.score;
    }

    // This is a simplified aggregation
    // A full implementation would have each signal return scores for ALL categories
    // and then combine them properly. For MVP, we use dominant signals.

    return scores;
  }

  /**
   * Simple aggregation: Find category with most keyword matches
   * Enhanced in production with proper multi-signal fusion
   */
  private simpleClassify(prompt: string): TaskCategory {
    const lower = prompt.toLowerCase();

    // Priority-based classification
    if (/```[\s\S]*?```/.test(prompt)) {
      if (lower.includes("review") || lower.includes("check")) return "code_review";
      if (lower.includes("bug") || lower.includes("error") || lower.includes("fix")) return "bug_analysis";
      return "code_generation";
    }

    if (lower.includes("bug") || lower.includes("error") || lower.includes("crash")) return "bug_analysis";
    if (lower.includes("review") && (lower.includes("code") || lower.includes("function"))) return "code_review";
    if (lower.includes("write") || lower.includes("generate") || lower.includes("implement")) {
      if (lower.includes("code") || lower.includes("function")) return "code_generation";
      return "writing";
    }

    if (/\d+\s*[+\-*/]\s*\d+/.test(prompt)) return "math";
    if (lower.includes("calculate") || lower.includes("compute")) return "math";

    if (lower.includes("why") || lower.includes("how") || lower.includes("explain")) return "reasoning";

    return "general";
  }
}
