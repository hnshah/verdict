/**
 * Verdict Router - Main Orchestrator
 *
 * Brings together classification, selection, and execution.
 */

import { randomUUID } from 'crypto';
import { TaskClassifier } from './classifier.js';
import { selectModel } from './selector.js';
import { RouterStorage } from './storage.js';
import type {
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
    private config: RouterConfig = DEFAULT_ROUTER_CONFIG as RouterConfig,
  ) {
    this.classifier = new TaskClassifier();
    this.storage = new RouterStorage(dbPath, config);
  }

  /**
   * Main entry point: Route a prompt to best model.
   */
  async route(
    prompt: string,
    constraints: SelectionConstraints = {}
  ): Promise<{
    classification: Classification;
    choice: ModelChoice;
    runId: string;
  }> {
    const classification = this.classifier.classify(prompt, constraints.category);

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

    return {
      classification,
      choice,
      runId: randomUUID(),
    };
  }

  /**
   * Record task completion.
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

  close(): void {
    this.storage.close();
  }
}

export * from './types.js';
