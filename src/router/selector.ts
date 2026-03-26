/**
 * Verdict Router - Statistical Model Selector
 * 
 * Selects best model using:
 * - Wilson confidence intervals (prevent small-sample bias)
 * - Time-weighted scoring (recent > historical)
 * - ε-greedy exploration (discover better models)
 * - Staleness penalty (prefer recently-used models)
 * - User preferences (learn from corrections)
 */

import type {
  TaskCategory,
  ModelPerformance,
  ModelChoice,
  SelectionConstraints,
  RouterConfig,
  UserPreference,
} from './types.js';

export class ModelSelector {
  constructor(
    private config: RouterConfig,
    private performanceData: Map<string, ModelPerformance[]>, // key: category
    private preferences: UserPreference[]
  ) {}

  /**
   * Select best model for a given task
   */
  select(
    category: TaskCategory,
    constraints: SelectionConstraints = {}
  ): ModelChoice {
    // Check user preferences first
    const preference = this.findPreference(category);
    if (preference && Math.random() > 0.3) {
      // 70% of time, respect user preference
      return this.selectPreferred(preference, constraints);
    }

    // Get all candidates for this category
    const candidates = this.performanceData.get(category) || [];
    
    // No data? Use fallback
    if (candidates.length === 0) {
      return this.selectFallback(category, constraints);
    }

    // ε-greedy exploration
    if (Math.random() < this.config.explorationRate) {
      return this.explore(candidates, category, constraints);
    }

    // Exploitation: Select best based on data
    return this.exploit(candidates, category, constraints);
  }

  /**
   * Exploitation: Pick statistically best model
   */
  private exploit(
    candidates: ModelPerformance[],
    category: TaskCategory,
    constraints: SelectionConstraints
  ): ModelChoice {
    // Filter by constraints
    const viable = candidates.filter(m => this.meetsConstraints(m, constraints));

    if (viable.length === 0) {
      // No viable candidates, relax constraints
      return this.selectFallback(category, constraints);
    }

    // Rank by adjusted score
    const ranked = viable
      .map(m => ({
        ...m,
        adjustedScore: this.computeAdjustedScore(m),
      }))
      .sort((a, b) => b.adjustedScore - a.adjustedScore);

    const best = ranked[0];

    return {
      model: best.model,
      reason: this.explainChoice(best, category, constraints, false),
      expectedScore: best.avgScore,
      expectedLatency: best.avgLatency,
      confidence: best.confidence,
      isExploration: false,
    };
  }

  /**
   * Exploration: Try random model to discover improvements
   */
  private explore(
    candidates: ModelPerformance[],
    category: TaskCategory,
    constraints: SelectionConstraints
  ): ModelChoice {
    // Filter by constraints
    const viable = candidates.filter(m => this.meetsConstraints(m, constraints));

    if (viable.length === 0) {
      return this.selectFallback(category, constraints);
    }

    // Random selection
    const random = viable[Math.floor(Math.random() * viable.length)];

    return {
      model: random.model,
      reason: `Exploring alternatives (helps Verdict learn!)`,
      expectedScore: random.avgScore,
      expectedLatency: random.avgLatency,
      confidence: random.confidence,
      isExploration: true,
    };
  }

  /**
   * Compute adjusted score with all factors
   */
  private computeAdjustedScore(perf: ModelPerformance): number {
    // 1. Wilson lower bound (confidence interval)
    const wilsonScore = this.wilsonLowerBound(perf.avgScore / 10, perf.sampleSize) * 10;

    // 2. Time-weighted score (recent > historical)
    const timeWeighted = 
      perf.recentScore * this.config.recentWeight +
      perf.historicalScore * (1 - this.config.recentWeight);

    // 3. Staleness penalty
    const stalenessPenalty = Math.exp(-perf.staleness / this.config.stalePenalty);

    // 4. Success rate
    const reliabilityBonus = perf.successRate;

    // Combine all factors
    return wilsonScore * 0.4 +
           timeWeighted * 0.4 +
           (wilsonScore * stalenessPenalty) * 0.1 +
           (wilsonScore * reliabilityBonus) * 0.1;
  }

  /**
   * Wilson score confidence interval (lower bound)
   * 
   * Returns conservative estimate accounting for sample size
   * - Large n → lowerBound ≈ score
   * - Small n → lowerBound << score
   */
  private wilsonLowerBound(score: number, n: number): number {
    if (n === 0) return 0;

    const z = 1.96; // 95% confidence
    const phat = score;

    const numerator = phat + (z * z) / (2 * n) - z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n);
    const denominator = 1 + (z * z) / n;

    return numerator / denominator;
  }

  /**
   * Check if model meets constraints
   */
  private meetsConstraints(perf: ModelPerformance, constraints: SelectionConstraints): boolean {
    if (constraints.maxLatency && perf.avgLatency > constraints.maxLatency) {
      return false;
    }

    if (constraints.minQuality && perf.avgScore < constraints.minQuality) {
      return false;
    }

    if (constraints.preferLocal && this.isCloudModel(perf.model)) {
      return false;
    }

    // TODO: Cost constraints when we track costs

    return true;
  }

  /**
   * Check if model is cloud-based
   */
  private isCloudModel(model: string): boolean {
    return model.includes("anthropic/") || 
           model.includes("openai/") ||
           model.includes("google/");
  }

  /**
   * Find user preference for category
   */
  private findPreference(category: TaskCategory): UserPreference | undefined {
    // Get most recent preference for this category
    return this.preferences
      .filter(p => p.category === category)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }

  /**
   * Select based on user preference
   */
  private selectPreferred(
    preference: UserPreference,
    constraints: SelectionConstraints
  ): ModelChoice {
    // TODO: Look up performance data for preferred model
    return {
      model: preference.preferredModel,
      reason: `Using your preferred model (overrode ${preference.overOriginalModel} ${preference.strength} time(s))`,
      expectedScore: 8.0, // Placeholder
      expectedLatency: 5000, // Placeholder
      confidence: 0.9,
      isExploration: false,
    };
  }

  /**
   * Fallback when no data available
   */
  private selectFallback(
    category: TaskCategory,
    constraints: SelectionConstraints
  ): ModelChoice {
    const fallback = this.config.fallbackModel;

    return {
      model: fallback,
      reason: `No performance data yet, using default for ${category}`,
      expectedScore: 7.0, // Conservative estimate
      expectedLatency: 5000,
      confidence: 0.3, // Low confidence
      isExploration: false,
    };
  }

  /**
   * Explain why this model was chosen
   */
  private explainChoice(
    perf: ModelPerformance,
    category: TaskCategory,
    constraints: SelectionConstraints,
    isExploration: boolean
  ): string {
    if (isExploration) {
      return `Exploring alternatives (helps Verdict learn!)`;
    }

    const reasons: string[] = [];

    reasons.push(`Proven best for ${category}`);
    reasons.push(`${perf.avgScore.toFixed(1)}/10 avg score`);
    
    if (perf.sampleSize >= this.config.minSampleSize) {
      reasons.push(`${perf.sampleSize} runs`);
    } else {
      reasons.push(`${perf.sampleSize} runs (low confidence)`);
    }

    if (constraints.maxLatency) {
      reasons.push(`${perf.avgLatency}ms (within ${constraints.maxLatency}ms budget)`);
    }

    if (perf.successRate < 1.0) {
      reasons.push(`${(perf.successRate * 100).toFixed(0)}% success rate`);
    }

    return reasons.join(", ");
  }

  /**
   * Get all available models for a category
   * (For exploration)
   */
  private getAllModels(category: TaskCategory): ModelPerformance[] {
    return this.performanceData.get(category) || [];
  }
}
