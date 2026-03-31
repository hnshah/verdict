#!/usr/bin/env node
/**
 * Extract model data from dashboard-data.json
 */

const fs = require('fs');

const modelName = process.argv[2];
const dashboardDataPath = process.argv[3] || '../../dashboard-data.json';

if (!modelName) {
  console.error('Usage: node model-from-data.js <model-name> [dashboard-data.json]');
  process.exit(1);
}

// Load dashboard data
const data = JSON.parse(fs.readFileSync(dashboardDataPath, 'utf8'));

// Load run names from individual run files
const runNames = {};
const runFilesDir = '../../dashboard/published/data';
try {
  const runFiles = fs.readdirSync(runFilesDir).filter(f => f.endsWith('.json') && f.startsWith('2026'));
  runFiles.forEach(file => {
    const runData = JSON.parse(fs.readFileSync(`${runFilesDir}/${file}`, 'utf8'));
    const runId = file.replace(/^2026-03-\d+-/, '').replace('.json', '');
    runNames[runId] = runData.name || 'Unnamed Run';
  });
} catch (err) {
  console.error('Warning: Could not load run names:', err.message);
}

// Track model stats across all runs
const runStats = [];
const allCases = new Map();
let totalScore = 0;
let totalWins = 0;
let scoreCount = 0;

// Group by run
const runMap = new Map();

data.cases.forEach(caseData => {
  caseData.runs.forEach(run => {
    const runId = run.run_id;
    
    // Only process if this model was in this run
    if (!run.responses?.[modelName]) return;
    
    // Initialize run stats
    if (!runMap.has(runId)) {
      runMap.set(runId, {
        id: runId,
        name: runNames[runId] || run.run_meta?.name || 'Unnamed Run',
        date: runId.split('T')[0],
        scores: [],
        accuracy: [],
        completeness: [],
        conciseness: [],
        wins: 0,
        latencies: []
      });
    }
    
    const runData = runMap.get(runId);
    
    // Track scores and dimensions
    if (run.scores?.[modelName]?.total) {
      const score = run.scores[modelName].total;
      const dims = run.scores[modelName].dimensions || {};
      
      runData.scores.push(score);
      totalScore += score;
      scoreCount++;
      
      // Track dimensions
      if (dims.accuracy !== undefined) runData.accuracy.push(dims.accuracy);
      if (dims.completeness !== undefined) runData.completeness.push(dims.completeness);
      if (dims.conciseness !== undefined) runData.conciseness.push(dims.conciseness);
    }
    
    // Track wins (calculate from scores if winner not set)
    let winner = run.winner;
    if (!winner && run.scores) {
      let maxScore = -1;
      Object.entries(run.scores).forEach(([model, score]) => {
        const totalScore = typeof score === 'number' ? score : (score.total || 0);
        if (totalScore > maxScore) {
          maxScore = totalScore;
          winner = model;
        }
      });
    }
    
    if (winner === modelName) {
      runData.wins++;
      totalWins++;
    }
    
    // Track latency
    if (run.responses[modelName]?.latency_ms) {
      runData.latencies.push(run.responses[modelName].latency_ms);
    }
    
    // Track cases for best/worst
    const caseScore = run.scores?.[modelName]?.total || 0;
    if (!allCases.has(caseData.id)) {
      allCases.set(caseData.id, {
        id: caseData.id,
        name: caseData.name || caseData.id,
        prompt: caseData.prompt,
        score: caseScore,
        response: run.responses[modelName]?.text || '',
        reasoning: run.scores?.[modelName]?.reasoning || ''
      });
    }
  });
});

// Convert run map to array and calculate averages
const runs = Array.from(runMap.values()).map(run => ({
  id: run.id,
  name: run.name,
  date: run.date,
  score: run.scores.length > 0 
    ? Math.round((run.scores.reduce((a,b) => a+b, 0) / run.scores.length) * 10) / 10
    : 0,
  wins: run.wins,
  latency: run.latencies.length > 0
    ? Math.round((run.latencies.reduce((a,b) => a+b, 0) / run.latencies.length) / 100) / 10
    : 0,
  // Calculate dimension averages
  accuracy: run.accuracy.length > 0
    ? Math.round((run.accuracy.reduce((a,b) => a+b, 0) / run.accuracy.length) * 10) / 10
    : 0,
  completeness: run.completeness.length > 0
    ? Math.round((run.completeness.reduce((a,b) => a+b, 0) / run.completeness.length) * 10) / 10
    : 0,
  conciseness: run.conciseness.length > 0
    ? Math.round((run.conciseness.reduce((a,b) => a+b, 0) / run.conciseness.length) * 10) / 10
    : 0
})).sort((a, b) => b.date.localeCompare(a.date));

// Best and worst cases
const cases = Array.from(allCases.values())
  .sort((a, b) => b.score - a.score);

const best = cases.slice(0, 3);
const worst = cases.slice(-3).reverse();

// Overall stats
const avgScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : 0;
const totalRuns = runs.length;
const avgLatency = runs.length > 0
  ? Math.round((runs.reduce((sum, r) => sum + r.latency, 0) / runs.length) * 10) / 10
  : 0;

// Output
const output = {
  model_name: modelName,
  avg_score: avgScore,
  total_wins: totalWins,
  total_runs: totalRuns,
  avg_latency: avgLatency > 0 ? avgLatency + '' : 's',
  runs,
  best_cases: best,
  worst_cases: worst
};

console.log(JSON.stringify(output, null, 2));
