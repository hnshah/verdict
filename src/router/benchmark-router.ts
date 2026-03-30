/**
 * Benchmark-Backed Router
 * 
 * Routes tasks to optimal models based on Elite 8-case benchmark results.
 * Integrated with Verdict's existing router architecture.
 * 
 * Based on comprehensive testing:
 * - phi4-14b: 7.8/10, 62.5% win rate (5/8 cases) - DEFAULT
 * - qwen2.5-coder-14b: 7.28/10, won ML (8.2) + migrations (8.2)
 * - qwen3-coder-30b: 7.47/10, 12.5% win rate - NEVER USE
 */

export interface BenchmarkModel {
  id: string
  name: string
  provider: string
  score: number
  speedMs: number
  wins: number
  totalCases: number
  strengths: string[]
  weaknesses: string[]
}

export interface BenchmarkRoute {
  model: BenchmarkModel
  reasoning: string
  confidence: number
  benchmarkData: {
    score: number
    winRate: number
    speed: number
    casesTested: number
  }
}

/**
 * Router that uses benchmark data to select optimal model
 */
export class BenchmarkRouter {
  private models: Map<string, BenchmarkModel>
  
  // ML task patterns (qwen2.5-coder won 8.2 on ML)
  private mlPatterns = [
    /\bml\b/i,
    /machine learning/i,
    /model.*inference/i,
    /model.*serving/i,
    /prediction/i,
    /fastapi.*model/i,
    /\bonnx\b/i,
    /pytorch/i,
    /tensorflow/i,
    /scikit/i,
    /batch.*prediction/i,
  ]
  
  // Migration patterns (qwen2.5-coder won 8.2 on migrations)
  private migrationPatterns = [
    /database.*migration/i,
    /db.*migration/i,
    /alembic/i,
    /flyway/i,
    /schema.*change/i,
    /version.*control.*database/i,
    /upgrade.*downgrade/i,
  ]
  
  // Data pipeline patterns (phi4 won 7.8)
  private dataPatterns = [
    /data.*pipeline/i,
    /data.*processing/i,
    /\betl\b/i,
    /streaming.*data/i,
    /\bpandas\b/i,
    /\bparquet\b/i,
    /csv.*process/i,
  ]

  constructor() {
    this.models = new Map()
    this.initializeBenchmarkData()
  }

  /**
   * Initialize with Elite 8-case benchmark results
   */
  private initializeBenchmarkData(): void {
    // phi4-14b: Clear winner (62.5% win rate)
    this.models.set('phi4-14b', {
      id: 'phi4-14b',
      name: 'Phi-4 14B',
      provider: 'ollama',
      score: 7.8,
      speedMs: 28500,
      wins: 5,
      totalCases: 8,
      strengths: [
        'distributed systems',
        'event sourcing (8.8!)',
        'async operations',
        'data pipelines',
        'metrics/monitoring',
        'general architecture',
        'conciseness (9.0/10)',
      ],
      weaknesses: [
        'oauth2 protocols',
        'ml-specific patterns',
      ],
    })

    // qwen2.5-coder-14b: ML/data specialist
    this.models.set('qwen2.5-coder-14b', {
      id: 'qwen2.5-coder-14b',
      name: 'Qwen 2.5 Coder 14B',
      provider: 'ollama',
      score: 7.28,
      speedMs: 31800,
      wins: 2,
      totalCases: 8,
      strengths: [
        'ml inference (8.2)',
        'database migrations (8.2)',
        'data science',
        'model serving',
      ],
      weaknesses: [
        'general systems design',
        'distributed systems',
        'event sourcing (6.8)',
      ],
    })

    // qwen3-coder-30b: Never use (flagged)
    this.models.set('qwen3-coder-30b', {
      id: 'qwen3-coder-30b',
      name: 'Qwen 3 Coder 30B',
      provider: 'ollama',
      score: 7.47,
      speedMs: 33300,
      wins: 1,
      totalCases: 8,
      strengths: ['oauth2 (barely)'],
      weaknesses: [
        'slower than 14B',
        'fewer wins than 14B',
        '3x memory usage',
        'zero advantages',
      ],
    })
  }

  /**
   * Route task to optimal model based on benchmarks
   */
  route(prompt: string): BenchmarkRoute {
    const promptLower = prompt.toLowerCase()

    // Check ML patterns (qwen2.5-coder won 8.2)
    if (this.matchesPatterns(promptLower, this.mlPatterns)) {
      const model = this.models.get('qwen2.5-coder-14b')!
      return {
        model,
        reasoning: `ML task detected → ${model.name}
Benchmark: 8.2/10 on ML inference (beat phi4's 7.8)
Strengths: ${model.strengths.slice(0, 3).join(', ')}`,
        confidence: 0.9,
        benchmarkData: {
          score: 8.2,
          winRate: 0.5, // Won 1/2 specialist cases
          speed: model.speedMs,
          casesTested: 8,
        },
      }
    }

    // Check migration patterns (qwen2.5-coder won 8.2)
    if (this.matchesPatterns(promptLower, this.migrationPatterns)) {
      const model = this.models.get('qwen2.5-coder-14b')!
      return {
        model,
        reasoning: `Database migration task → ${model.name}
Benchmark: 8.2/10 on DB migrations (beat phi4's 7.8)
Strengths: ${model.strengths.slice(0, 3).join(', ')}`,
        confidence: 0.9,
        benchmarkData: {
          score: 8.2,
          winRate: 0.5, // Won 1/2 specialist cases
          speed: model.speedMs,
          casesTested: 8,
        },
      }
    }

    // Check data pipeline (phi4 still won 7.8)
    if (this.matchesPatterns(promptLower, this.dataPatterns)) {
      const model = this.models.get('phi4-14b')!
      return {
        model,
        reasoning: `Data pipeline task → ${model.name}
Benchmark: 7.8/10 on data pipeline (beat specialists 6.8)
Note: Use qwen2.5-coder if ML-heavy`,
        confidence: 0.85,
        benchmarkData: {
          score: 7.8,
          winRate: model.wins / model.totalCases,
          speed: model.speedMs,
          casesTested: model.totalCases,
        },
      }
    }

    // Default: phi4-14b (won 5/8, 62.5%)
    const model = this.models.get('phi4-14b')!
    return {
      model,
      reasoning: `General task → ${model.name} (default)
Benchmark: ${model.score}/10 overall, ${(model.wins / model.totalCases * 100).toFixed(1)}% win rate (${model.wins}/${model.totalCases} cases)
Won: distributed queue, data pipeline, async scraper, metrics, event sourcing
Fastest: ${model.speedMs / 1000}s (11% faster than qwen2.5-coder)`,
      confidence: 0.8,
      benchmarkData: {
        score: model.score,
        winRate: model.wins / model.totalCases,
        speed: model.speedMs,
        casesTested: model.totalCases,
      },
    }
  }

  /**
   * Check if text matches any pattern
   */
  private matchesPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(text))
  }

  /**
   * Get model details
   */
  getModel(modelId: string): BenchmarkModel | undefined {
    return this.models.get(modelId)
  }

  /**
   * Get all models
   */
  getAllModels(): BenchmarkModel[] {
    return Array.from(this.models.values())
  }

  /**
   * Compare models for a task
   */
  compareModels(prompt: string): {
    recommended: BenchmarkRoute
    alternatives: Array<{ model: BenchmarkModel; score: number; reason: string }>
  } {
    const recommended = this.route(prompt)

    const alternatives = Array.from(this.models.values())
      .filter((m) => m.id !== recommended.model.id)
      .sort((a, b) => b.score - a.score)
      .map((model) => ({
        model,
        score: model.score,
        reason: `${model.wins}/${model.totalCases} wins, ${model.speedMs / 1000}s avg`,
      }))

    return { recommended, alternatives }
  }

  /**
   * Check if model should never be used
   */
  isBlacklisted(modelId: string): boolean {
    // qwen3-coder-30b is explicitly flagged as useless
    return modelId === 'qwen3-coder-30b'
  }

  /**
   * Get routing statistics
   */
  getStats(): {
    totalModels: number
    defaultModel: string
    specialistModels: string[]
    blacklistedModels: string[]
    averageWinRate: number
  } {
    const models = Array.from(this.models.values())
    const totalWins = models.reduce((sum, m) => sum + m.wins, 0)
    const totalCases = models.reduce((sum, m) => sum + m.totalCases, 0)

    return {
      totalModels: models.length,
      defaultModel: 'phi4-14b',
      specialistModels: ['qwen2.5-coder-14b'],
      blacklistedModels: ['qwen3-coder-30b'],
      averageWinRate: totalCases > 0 ? totalWins / totalCases : 0,
    }
  }
}
