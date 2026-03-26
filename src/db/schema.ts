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

/** All schema creation statements in order. */
export const ALL_SCHEMAS = [
  CREATE_EVAL_RESULTS,
  CREATE_QUESTION_RESULTS,
  CREATE_MODELS_REGISTRY,
] as const
