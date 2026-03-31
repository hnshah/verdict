#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const resultsDir = '/Users/Vera/.openclaw/workspace/verdict/results';
const files = fs.readdirSync(resultsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => path.join(resultsDir, f))
  .sort()
  .reverse();

const runs = [];
const modelStats = {};
let totalCases = 0;
let totalScores = [];

files.forEach(filePath => {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fileName = path.basename(filePath, '.json');
  
  const caseCount = data.cases?.length || 0;
  const modelCount = data.models?.length || 0;
  
  const allScores = Object.values(data.summary || {}).map(m => m.avg_total);
  const avgScore = allScores.length > 0
    ? Math.round((allScores.reduce((a,b) => a+b, 0) / allScores.length) * 10) / 10
    : 0;
  
  const badges = [];
  if (caseCount < 5) badges.push({ type: 'test', label: 'Test Run' });
  if (modelCount === 1) badges.push({ type: 'single', label: 'Single Model' });
  // Don't filter "My Evals" - it's the default name, not necessarily a test
  
  const hasAllScores = data.cases?.every(c => c.scores && Object.keys(c.scores).length > 0);
  if (!hasAllScores && caseCount > 0) {
    badges.push({ type: 'incomplete', label: 'Incomplete' });
  }
  
  runs.push({
    id: fileName,
    name: data.name,
    date: data.timestamp.split('T')[0],
    cases: caseCount,
    models: modelCount,
    avg_score: avgScore,
    badges,
    is_test: badges.some(b => b.type === 'test'),
    is_single_model: modelCount === 1
  });
  
  totalCases += caseCount;
  if (avgScore > 0) totalScores.push(avgScore);
  
  const isTestRun = badges.some(b => b.type === 'test');
  if (!isTestRun) {
    Object.entries(data.summary || {}).forEach(([model, stats]) => {
      if (!modelStats[model]) {
        modelStats[model] = { name: model, scores: [], wins: 0, runs: 0, latencies: [] };
      }
      modelStats[model].scores.push(stats.avg_total);
      modelStats[model].wins += stats.wins || 0;
      modelStats[model].runs++;
      if (stats.avg_latency_ms) modelStats[model].latencies.push(stats.avg_latency_ms);
    });
  }
});

const topModels = Object.values(modelStats)
  .map(m => ({
    name: m.name,
    avg_score: Math.round((m.scores.reduce((a,b) => a+b, 0) / m.scores.length) * 10) / 10,
    runs: m.runs,
    total_wins: m.wins,
    win_rate: m.scores.length > 0 ? Math.round((m.wins / m.scores.length) * 100) : 0,
    avg_latency: m.latencies.length > 0
      ? Math.round((m.latencies.reduce((a,b) => a+b, 0) / m.latencies.length) / 100) / 10
      : 0
  }))
  .sort((a, b) => b.avg_score - a.avg_score)
  .map((m, i) => ({
    ...m,
    rank: i + 1,
    medal: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''
  }))
  .slice(0, 10);

console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  stats: {
    total_runs: runs.length,
    total_cases: totalCases,
    total_models: Object.keys(modelStats).length,
    avg_score: totalScores.length > 0
      ? Math.round((totalScores.reduce((a,b) => a+b, 0) / totalScores.length) * 10) / 10
      : 0,
    test_runs: runs.filter(r => r.is_test).length,
    real_runs: runs.filter(r => !r.is_test).length
  },
  runs,
  top_models: topModels
}, null, 2));
