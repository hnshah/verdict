/**
 * Verdict Router - Main Orchestrator
 * 
 * Brings together classification, selection, and execution
 */

import { randomUUID } from 'crypto';
import { TaskClassifier } from './classifier.js';
import { ModelSelector } from './selector.js';
import { RouterStorage } from './storage.js';
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

  constructor(
    private dbPath: string,
    private config: RouterConfig = DEFAULT_ROUTER_CONFIG as RouterConfig
  ) {
    this.classifier = new TaskClassifier();
    this.storage = new RouterStorage(dbPath, config);
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
  }> {
    // 1. Classify task
    const classification = this.classifier.classify(prompt, constraints.category);

    // 2. Get performance data for this category
    const performanceData = this.storage.getPerformanceForCategory(classification.category);
    const preferences = this.storage.getPreferences();

    // 3. Select best model
    const perfMap = new Map<string, any[]>();
    perfMap.set(classification.category, performanceData);
    
    const selector = new ModelSelector(this.config, perfMap, preferences);
    const choice = selector.select(classification.category, constraints);

    // 4. Create run record
    const runId = randomUUID();

    return {
      classification,
      choice,
      runId,
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
   * Close storage
   */
  close(): void {
    this.storage.close();
  }
}

export * from './types.js';
