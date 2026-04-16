/**
 * SQLite schema definitions for verdict persistence layer.
 * Uses better-sqlite3 synchronous API.
 */

/** SQL statements to create the verdict database schema. */
export const CREATE_EVAL_RESULTS = `
CREATE TABLE IF NOT EXISTS eval_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  name TEXT,
  model_id TEXT NOT NULL,
  provider TEXT,
  pack TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL DEFAULT 10,
  cases_run INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL,
  total_cost_usd REAL DEFAULT 0,
  tokens_per_sec REAL,
  run_at TEXT NOT NULL
)` as const

export const CREATE_QUESTION_RESULTS = `
CREATE TABLE IF NOT EXISTS question_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eval_result_id INTEGER NOT NULL REFERENCES eval_results(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL,
  prompt TEXT,
  model_id TEXT NOT NULL,
  score REAL NOT NULL,
  latency_ms REAL,
  response TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER
)` as const

export const CREATE_MODELS_REGISTRY = `
CREATE TABLE IF NOT EXISTS models_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT UNIQUE NOT NULL,
  provider TEXT,
  first_seen TEXT NOT NULL DEFAULT '',
  last_eval_at TEXT,
  best_score REAL,
  best_pack TEXT,
  avg_tokens_per_sec REAL,
  total_runs INTEGER DEFAULT 0
)` as const

export const CREATE_JOBS = `
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  model_id TEXT,
  input TEXT,
  output TEXT,
  error TEXT,
  priority INTEGER DEFAULT 0,
  queued_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  metadata TEXT
)` as const

export const CREATE_WATCHED_MODELS = `
CREATE TABLE IF NOT EXISTS watched_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  first_detected TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT,
  auto_eval INTEGER DEFAULT 1,
  eval_pack TEXT DEFAULT 'general'
)` as const

/**
 * Cron-based eval schedules. Rows created via YAML (source='yaml') are
 * re-synced by the daemon on startup; rows created via `verdict schedule add`
 * use source='cli' and persist unconditionally.
 *
 * `next_run_at` is the computed next fire time from the cron expression;
 * the scheduler tick polls WHERE enabled=1 AND next_run_at <= now().
 */
export const CREATE_SCHEDULES = `
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  cron TEXT NOT NULL,
  config_path TEXT,
  packs TEXT,
  models TEXT,
  category TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  on_regression TEXT,
  last_run_at TEXT,
  last_run_id TEXT,
  last_status TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL DEFAULT 'cli'
)` as const

export const CREATE_SCHEDULES_INDEX = `
CREATE INDEX IF NOT EXISTS idx_schedules_due ON schedules(enabled, next_run_at)
` as const

/** All schema creation statements in order. */
export const ALL_SCHEMAS = [
  CREATE_EVAL_RESULTS,
  CREATE_QUESTION_RESULTS,
  CREATE_MODELS_REGISTRY,
  CREATE_JOBS,
  CREATE_WATCHED_MODELS,
  CREATE_SCHEDULES,
  CREATE_SCHEDULES_INDEX,
] as const
