/**
 * Verdict SDK Types
 */

export interface EvalConfig {
  models: string[];
  pack: string;
  judge?: string;
  concurrency?: number;
}

export interface EvalResult {
  runId: string;
  timestamp: string;
  models: string[];
  summary: Record<string, ModelSummary>;
  cases: EvalCase[];
}

export interface ModelSummary {
  avg_total: number;
  avg_accuracy: number;
  avg_completeness: number;
  avg_conciseness: number;
  avg_latency_ms: number;
  wins: number;
}

export interface EvalCase {
  case_id: string;
  prompt: string;
  category: string;
  responses: Record<string, Response>;
  scores: Record<string, Score>;
  winner: string;
}

export interface Response {
  text: string;
  latency_ms: number;
}

export interface Score {
  total: number;
  accuracy: number;
  completeness: number;
  conciseness: number;
  reasoning: string;
}

export interface RouterRequest {
  prompt: string;
  domain?: 'coding' | 'math' | 'reasoning' | 'knowledge' | 'vision';
  constraints?: {
    maxLatency?: number;
    minScore?: number;
    excludeModels?: string[];
  };
}

export interface RouterResponse {
  recommendedModel: string;
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    model: string;
    score: number;
    reason: string;
  }>;
}

export interface ModelStats {
  name: string;
  avgScore: number;
  winRate: number;
  totalRuns: number;
  domains: Record<string, DomainStats>;
}

export interface DomainStats {
  avgScore: number;
  winRate: number;
  sampleSize: number;
}
