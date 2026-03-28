/**
 * Verdict Router - Core Types
 * 
 * Smart model selection based on task classification and historical performance
 */

export type TaskCategory =
  | "code_review"
  | "code_generation"
  | "bug_analysis"
  | "writing"
  | "math"
  | "reasoning"
  | "general";

export interface Classification {
  category: TaskCategory;
  confidence: number; // 0.0-1.0
  signals: ClassificationSignal[];
  method: "auto" | "manual";
}

export interface ClassificationSignal {
  name: string; // "keyword", "structure", "verb", etc.
  score: number; // 0.0-1.0
  weight: number; // Importance of this signal
  details?: string; // Debug info
}

export interface ModelPerformance {
  model: string; // "qwen2.5:7b"
  category: TaskCategory;
  
  // Scoring
  avgScore: number; // 0-10
  recentScore: number; // Last 10 runs (time-weighted)
  historicalScore: number; // All-time average
  
  // Reliability
  avgLatency: number; // milliseconds
  successRate: number; // 0.0-1.0 (completed / total attempts)
  
  // Confidence
  sampleSize: number; // Number of runs
  confidence: number; // 0.0-1.0 (Wilson lower bound)
  
  // Metadata
  lastUsed: Date;
  staleness: number; // Days since last use
  modelVersion?: string; // Track model updates
}

export interface ModelChoice {
  model: string;
  reason: string; // Human-readable explanation
  expectedScore: number;
  expectedLatency: number;
  confidence: number;
  isExploration: boolean; // ε-greedy exploration flag
}

export interface TaskRun {
  id: string;
  prompt: string;
  
  // Classification
  category: TaskCategory;
  classificationConfidence: number;
  classificationMethod: "auto" | "manual";
  
  // Selection
  selectedModel: string;
  selectionReason: string;
  wasExploration: boolean;
  
  // Execution
  result?: string;
  latency?: number;
  status: "success" | "timeout" | "crash" | "error";
  errorMessage?: string;
  
  // Feedback
  userFeedback?: {
    correctedModel?: string; // User overrode selection
    rating?: number; // 1-10
    wasHelpful?: boolean; // Simple y/n
  };
  
  timestamp: Date;
}

export interface UserPreference {
  category: TaskCategory;
  preferredModel: string;
  overOriginalModel: string; // What was auto-selected
  timestamp: Date;
  strength: number; // How many times this preference was expressed
}

export interface SelectionConstraints {
  maxLatency?: number; // milliseconds
  minQuality?: number; // 0-10
  preferLocal?: boolean;
  maxCost?: number; // USD (for cloud models)
  category?: TaskCategory; // Manual override
}

export interface RouterConfig {
  // Exploration
  explorationRate: number; // ε-greedy (default: 0.1)
  
  // Time decay
  recentWeight: number; // Weight for recent scores (default: 0.7)
  stalePenalty: number; // Days before staleness penalty (default: 30)
  
  // Confidence
  minSampleSize: number; // Minimum runs for confidence (default: 3)
  
  // Storage
  maxHistorySize: number; // Max task_runs to keep (default: 1000)
  retentionDays: number; // Archive after N days (default: 90)
  
  // Privacy
  storePrompts: boolean; // Whether to store full prompts (default: false)
  redactSecrets: boolean; // Auto-redact API keys, tokens (default: true)
  
  // Defaults
  fallbackModel: string; // When no data available (default: "qwen2.5:7b")
}

export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  explorationRate: 0.1,
  recentWeight: 0.7,
  stalePenalty: 30,
  minSampleSize: 3,
  maxHistorySize: 1000,
  retentionDays: 90,
  storePrompts: false,
  redactSecrets: true,
  fallbackModel: "qwen2.5:7b",
};

// Default routing table (from our Verdict testing!)
export const DEFAULT_ROUTING: Record<TaskCategory, string> = {
  code_review: "qwen2.5:7b",
  code_generation: "qwen2.5:7b",
  bug_analysis: "qwen2.5:7b",
  writing: "qwen2.5:7b", // Can override to anthropic/claude-sonnet-4 if available
  math: "llama3.2:3b",
  reasoning: "qwen2.5:14b",
  general: "qwen2.5:7b",
};
