#!/usr/bin/env node
/**
 * Run Detail Extractor
 * Usage: node run.js <result-file-path>
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node run.js <result-file-path>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const fileName = path.basename(filePath, '.json');

// Convert UTC timestamp to Pacific Time
function toPacificTime(utcString) {
  const date = new Date(utcString);
  return date.toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short'
  }) + ' PT';
}

// Calculate run stats
const caseCount = data.cases?.length || 0;
const modelCount = data.models?.length || 0;

const allScores = Object.values(data.summary || {}).map(m => m.avg_total);
const avgScore = allScores.length > 0
  ? Math.round((allScores.reduce((a,b) => a+b, 0) / allScores.length) * 10) / 10
  : 0;

const passCount = data.cases?.filter(c => {
  const scores = Object.values(c.scores || {});
  const avg = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.total, 0) / scores.length
    : 0;
  return avg >= 8;
}).length || 0;

const passRate = caseCount > 0 ? Math.round((passCount / caseCount) * 100) : 0;

const avgLatency = Object.values(data.summary || {}).length > 0
  ? Math.round((Object.values(data.summary).reduce((sum, m) => sum + m.avg_latency_ms, 0) / Object.values(data.summary).length) / 100) / 10
  : 0;

// Model leaderboard for this run
const modelLeaderboard = Object.entries(data.summary || {})
  .map(([model, stats]) => ({
    name: model,
    avg_score: Math.round(stats.avg_total * 10) / 10,
    accuracy: Math.round(stats.avg_accuracy * 10) / 10,
    completeness: Math.round(stats.avg_completeness * 10) / 10,
    conciseness: Math.round(stats.avg_conciseness * 10) / 10,
    wins: stats.wins || 0,
    latency: Math.round(stats.avg_latency_ms / 100) / 10
  }))
  .sort((a, b) => b.avg_score - a.avg_score)
  .map((m, i) => ({
    ...m,
    rank: i + 1,
    medal: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''
  }));

// Process cases
const cases = (data.cases || []).map(c => ({
  case_id: c.case_id,
  prompt: c.prompt,
  category: c.category || 'general',
  responses: Object.entries(c.responses || {}).map(([model, resp]) => ({
    model,
    text: resp.text,
    latency: Math.round(resp.latency_ms / 100) / 10,
    score: c.scores?.[model]?.total || 0,
    accuracy: c.scores?.[model]?.accuracy || 0,
    completeness: c.scores?.[model]?.completeness || 0,
    conciseness: c.scores?.[model]?.conciseness || 0,
    reasoning: c.scores?.[model]?.reasoning || ''
  })),
  avg_score: c.scores
    ? Math.round((Object.values(c.scores).reduce((sum, s) => sum + s.total, 0) / Object.values(c.scores).length) * 10) / 10
    : 0
}));

// Generate "last updated" timestamp in Pacific Time
const lastUpdated = new Date().toLocaleString('en-US', {
  timeZone: 'America/Los_Angeles',
  dateStyle: 'medium',
  timeStyle: 'short'
}) + ' PT';

console.log(JSON.stringify({
  id: fileName,
  name: data.name,
  date: toPacificTime(data.timestamp),
  run_id: data.run_id,
  eval_pack: data.eval_pack,
  stats: {
    cases: caseCount,
    models: modelCount,
    avg_score: avgScore,
    pass_rate: passRate,
    avg_latency: avgLatency
  },
  model_leaderboard: modelLeaderboard,
  cases,
  last_updated: lastUpdated
}, null, 2));
