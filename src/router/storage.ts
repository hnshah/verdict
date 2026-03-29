/**
 * Verdict Router - Storage Layer
 * 
 * Privacy-aware SQLite storage with:
 * - Secret redaction (API keys, tokens)
 * - Retention policy (bounded growth)
 * - WAL mode (concurrent safety)
 * - Failure tracking (not just successes)
 */

import Database from 'better-sqlite3';
import type { TaskRun, ModelPerformance, UserPreference, RouterConfig, TaskCategory } from './types.js';

export class RouterStorage {
  db: Database.Database;

  constructor(dbPath: string, private config: RouterConfig) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Concurrent safety
    this.initSchema();
  }

  /**
   * Initialize database schema
   */
  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_runs (
        id TEXT PRIMARY KEY,
        prompt TEXT,
        category TEXT,
        classification_confidence REAL,
        classification_method TEXT,
        selected_model TEXT,
        selection_reason TEXT,
        was_exploration INTEGER,
        result TEXT,
        latency INTEGER,
        status TEXT,
        error_message TEXT,
        corrected_model TEXT,
        user_rating INTEGER,
        was_helpful INTEGER,
        timestamp DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_category ON task_runs(category);
      CREATE INDEX IF NOT EXISTS idx_model ON task_runs(selected_model);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON task_runs(timestamp);

      CREATE TABLE IF NOT EXISTS model_performance (
        model TEXT,
        category TEXT,
        avg_score REAL,
        recent_score REAL,
        historical_score REAL,
        avg_latency REAL,
        success_rate REAL,
        sample_size INTEGER,
        confidence REAL,
        last_used DATETIME,
        staleness REAL,
        model_version TEXT,
        PRIMARY KEY (model, category)
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        category TEXT,
        preferred_model TEXT,
        over_original TEXT,
        strength INTEGER,
        timestamp DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_pref_category ON user_preferences(category);
    `);
  }

  /**
   * Store a task run with privacy protection
   */
  storeRun(run: TaskRun): void {
    let prompt = run.prompt;

    // Redact secrets if enabled
    if (this.config.redactSecrets) {
      prompt = this.redactSecrets(prompt);
    }

    // Don't store prompt if disabled
    if (!this.config.storePrompts) {
      prompt = "[REDACTED]";
    }

    const stmt = this.db.prepare(`
      INSERT INTO task_runs VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    stmt.run(
      run.id,
      prompt,
      run.category,
      run.classificationConfidence,
      run.classificationMethod,
      run.selectedModel,
      run.selectionReason,
      run.wasExploration ? 1 : 0,
      run.result || null,
      run.latency || null,
      run.status,
      run.errorMessage || null,
      run.userFeedback?.correctedModel || null,
      run.userFeedback?.rating || null,
      run.userFeedback?.wasHelpful ? 1 : 0,
      run.timestamp.toISOString()
    );

    // Update model performance
    this.updatePerformance(run);

    // Enforce retention policy
    this.enforceRetention();
  }

  /**
   * Update model performance stats
   */
  private updatePerformance(run: TaskRun): void {
    // Only update for successful runs with ratings
    if (run.status !== "success" || !run.userFeedback?.rating) {
      return;
    }

    const current = this.getPerformance(run.selectedModel, run.category);
    
    const newSampleSize = (current?.sampleSize || 0) + 1;
    const newAvgScore = current
      ? (current.avgScore * current.sampleSize + run.userFeedback.rating) / newSampleSize
      : run.userFeedback.rating;

    // Time-weighted recent score (last 10 runs)
    const recentRuns = this.getRecentRuns(run.selectedModel, run.category, 10);
    const recentScore = recentRuns.length > 0
      ? recentRuns.reduce((sum, r) => sum + (r.user_rating || 0), 0) / recentRuns.length
      : newAvgScore;

    const newAvgLatency = current
      ? (current.avgLatency * current.sampleSize + (run.latency || 0)) / newSampleSize
      : (run.latency || 0);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO model_performance VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      run.selectedModel,
      run.category,
      newAvgScore,
      recentScore,
      newAvgScore, // historical = avg for now
      newAvgLatency,
      1.0, // TODO: Calculate actual success rate
      newSampleSize,
      this.computeConfidence(newSampleSize),
      new Date().toISOString(),
      0, // fresh
      null // model_version
    );
  }

  /**
   * Get performance for a specific model + category
   */
  private getPerformance(model: string, category: string): ModelPerformance | null {
    const stmt = this.db.prepare(`
      SELECT * FROM model_performance WHERE model = ? AND category = ?
    `);
    
    const row = stmt.get(model, category) as any;
    if (!row) return null;

    return {
      model: row.model,
      category: row.category as TaskCategory,
      avgScore: row.avg_score,
      recentScore: row.recent_score,
      historicalScore: row.historical_score,
      avgLatency: row.avg_latency,
      successRate: row.success_rate,
      sampleSize: row.sample_size,
      confidence: row.confidence,
      lastUsed: new Date(row.last_used),
      staleness: row.staleness,
      modelVersion: row.model_version,
    };
  }

  /**
   * Get recent runs for a model
   */
  private getRecentRuns(model: string, category: string, limit: number): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM task_runs 
      WHERE selected_model = ? AND category = ? AND user_rating IS NOT NULL
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    return stmt.all(model, category, limit) as any[];
  }

  /**
   * Compute confidence based on sample size
   */
  private computeConfidence(sampleSize: number): number {
    // Simple confidence: more samples = higher confidence
    return Math.min(1.0, sampleSize / 10);
  }

  /**
   * Redact API keys, tokens, passwords
   */
  private redactSecrets(text: string): string {
    return text
      .replace(/sk-[a-zA-Z0-9]{32,}/g, '[REDACTED_API_KEY]')
      .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]')
      .replace(/password["\s:=]+\S+/gi, 'password=[REDACTED]')
      .replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]');
  }

  /**
   * Enforce retention policy (keep last N runs)
   */
  private enforceRetention(): void {
    const stmt = this.db.prepare(`
      DELETE FROM task_runs 
      WHERE id NOT IN (
        SELECT id FROM task_runs 
        ORDER BY timestamp DESC 
        LIMIT ?
      )
    `);

    stmt.run(this.config.maxHistorySize);
  }

  /**
   * Get all performance data for a category
   */
  getPerformanceForCategory(category: TaskCategory): ModelPerformance[] {
    const stmt = this.db.prepare(`
      SELECT * FROM model_performance WHERE category = ?
    `);

    const rows = stmt.all(category) as any[];
    return rows.map(row => ({
      model: row.model,
      category: row.category as TaskCategory,
      avgScore: row.avg_score,
      recentScore: row.recent_score,
      historicalScore: row.historical_score,
      avgLatency: row.avg_latency,
      successRate: row.success_rate,
      sampleSize: row.sample_size,
      confidence: row.confidence,
      lastUsed: new Date(row.last_used),
      staleness: row.staleness,
      modelVersion: row.model_version,
    }));
  }

  /**
   * Get user preferences
   */
  getPreferences(): UserPreference[] {
    const stmt = this.db.prepare(`SELECT * FROM user_preferences`);
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      category: row.category as TaskCategory,
      preferredModel: row.preferred_model,
      overOriginalModel: row.over_original,
      timestamp: new Date(row.timestamp),
      strength: row.strength,
    }));
  }

  /**
   * Close database
   */
  close(): void {
    this.db.close();
  }
}
