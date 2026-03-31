#!/usr/bin/env node
/**
 * Extract dashboard data from dashboard-data.json (new format)
 */

const fs = require('fs');

// Read dashboard-data.json from command line arg or default location
const dashboardDataPath = process.argv[2] || '../../dashboard-data.json';
const dashboardData = JSON.parse(fs.readFileSync(dashboardDataPath, 'utf8'));

// Extract unique runs from cases
const runMap = new Map();
dashboardData.cases.forEach(caseData => {
  caseData.runs.forEach(run => {
    const runId = run.run_id;
    if (!runMap.has(runId)) {
      runMap.set(runId, {
        id: runId,
        name: run.run_meta?.name || 'Unnamed Run',
        date: runId.split('T')[0],
        models: new Set(),
        cases: 0,
        totalScore: 0,
        scoreCount: 0
      });
    }
    
    const runData = runMap.get(runId);
    runData.cases++;
    
    // Track models
    Object.keys(run.responses || {}).forEach(model => runData.models.add(model));
    
    // Track scores
    Object.values(run.scores || {}).forEach(score => {
      if (score.total) {
        runData.totalScore += score.total;
        runData.scoreCount++;
      }
    });
  });
});

// Convert to runs array
const runs = Array.from(runMap.values()).map(run => ({
  id: run.id,
  name: run.name,
  date: run.date,
  cases: Math.floor(run.cases / run.models.size), // Divide by models to get unique cases
  models: run.models.size,
  avg_score: run.scoreCount > 0 
    ? Math.round((run.totalScore / run.scoreCount) * 10) / 10 
    : 0,
  badges: [],
  is_test: false,
  is_single_model: run.models.size === 1
}));

// Sort by date desc
runs.sort((a, b) => b.id.localeCompare(a.id));

// Build model stats
const modelStats = {};
Object.keys(dashboardData.models).forEach(modelId => {
  modelStats[modelId] = {
    name: modelId,
    total_runs: 0,
    total_wins: 0,
    total_scores: [],
    avg_score: 0
  };
});

// Count wins and scores per model
dashboardData.cases.forEach(caseData => {
  caseData.runs.forEach(run => {
    // Find winner for this run+case
    let maxScore = -1;
    let winner = null;
    Object.entries(run.scores || {}).forEach(([model, score]) => {
      if (score.total > maxScore) {
        maxScore = score.total;
        winner = model;
      }
      if (modelStats[model]) {
        modelStats[model].total_scores.push(score.total);
      }
    });
    
    if (winner && modelStats[winner]) {
      modelStats[winner].total_wins++;
    }
    
    // Count runs
    Object.keys(run.responses || {}).forEach(model => {
      if (modelStats[model]) {
        modelStats[model].total_runs++;
      }
    });
  });
});

// Calculate averages
Object.values(modelStats).forEach(stats => {
  if (stats.total_scores.length > 0) {
    stats.avg_score = Math.round(
      (stats.total_scores.reduce((a, b) => a + b, 0) / stats.total_scores.length) * 10
    ) / 10;
  }
  // Don't track total_runs in new format since models participate in different cases
  stats.total_runs = stats.total_scores.length;
});

// Top models (by avg score)
const topModels = Object.values(modelStats)
  .filter(m => m.total_scores.length > 0)
  .sort((a, b) => b.avg_score - a.avg_score)
  .slice(0, 10);

// Overall stats
const allScores = [];
Object.values(modelStats).forEach(m => allScores.push(...m.total_scores));
const avgScore = allScores.length > 0
  ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
  : 0;

// Output
const output = {
  stats: {
    total_runs: runs.length,
    total_cases: dashboardData.meta.total_cases,
    total_models: Object.keys(dashboardData.models).length,
    avg_score: avgScore,
    test_runs: 0,
    real_runs: runs.length
  },
  runs,
  top_models: topModels,
  all_models: Object.values(modelStats).sort((a, b) => 
    b.avg_score - a.avg_score || a.name.localeCompare(b.name)
  )
};

console.log(JSON.stringify(output, null, 2));
