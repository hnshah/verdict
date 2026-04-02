/**
 * Verdict SDK Client
 */

import type {
  EvalConfig,
  EvalResult,
  RouterRequest,
  RouterResponse,
  ModelStats
} from './types';

export class VerdictClient {
  private apiBaseUrl: string;
  private apiKey?: string;

  constructor(options: { apiUrl?: string; apiKey?: string } = {}) {
    this.apiBaseUrl = options.apiUrl || 'https://api.verdict.sh';
    this.apiKey = options.apiKey;
  }

  /**
   * Run an evaluation
   */
  async run(config: EvalConfig): Promise<EvalResult> {
    // TODO: Implement actual API call
    throw new Error('Not yet implemented - use CLI for now');
  }

  /**
   * Get eval result by ID
   */
  async getResult(runId: string): Promise<EvalResult> {
    const response = await this.fetch(`/runs/${runId}`);
    return response.json();
  }

  /**
   * List all eval runs
   */
  async listRuns(options?: {
    limit?: number;
    offset?: number;
  }): Promise<EvalResult[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    
    const response = await this.fetch(`/runs?${params}`);
    return response.json();
  }

  /**
   * Get model statistics
   */
  async getModel(modelName: string): Promise<ModelStats> {
    const response = await this.fetch(`/models/${encodeURIComponent(modelName)}`);
    return response.json();
  }

  /**
   * List all models
   */
  async listModels(): Promise<ModelStats[]> {
    const response = await this.fetch('/models');
    return response.json();
  }

  /**
   * Smart routing - get best model recommendation
   */
  async route(request: RouterRequest): Promise<RouterResponse> {
    const response = await this.fetch('/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    return response.json();
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(options?: {
    domain?: string;
    limit?: number;
  }): Promise<ModelStats[]> {
    const params = new URLSearchParams();
    if (options?.domain) params.set('domain', options.domain);
    if (options?.limit) params.set('limit', options.limit.toString());
    
    const response = await this.fetch(`/leaderboard?${params}`);
    return response.json();
  }

  /**
   * Internal fetch wrapper
   */
  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.apiBaseUrl}${path}`;
    const headers = new Headers(init?.headers);
    
    if (this.apiKey) {
      headers.set('Authorization', `Bearer ${this.apiKey}`);
    }

    const response = await fetch(url, {
      ...init,
      headers
    });

    if (!response.ok) {
      throw new Error(`Verdict API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }
}

/**
 * Default export for convenience
 */
export default VerdictClient;
