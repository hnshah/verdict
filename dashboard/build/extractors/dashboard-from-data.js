#!/usr/bin/env node
/**
 * Extract dashboard data from dashboard-data.json (new format)
 */

const fs = require('fs');

// Read dashboard-data.json from command line arg or default location
const dashboardDataPath = process.argv[2] || '../../dashboard-data.json';
const dashboardData = JSON.parse(fs.readFileSync(dashboardDataPath, 'utf8'));

// Load run names from individual run files
const runNames = {};
const runFilesDir = '../../dashboard/published/data';
try {
  const runFiles = fs.readdirSync(runFilesDir).filter(f => f.endsWith('.json') && f.startsWith('2026'));
  runFiles.forEach(file => {
    const data = JSON.parse(fs.readFileSync(`${runFilesDir}/${file}`, 'utf8'));
    const runId = file.replace(/^2026-03-\d+-/, '').replace('.json', '');
    runNames[runId] = data.name || 'Unnamed Run';
  });
} catch (err) {
  console.error('Warning: Could not load run names:', err.message);
}

// Extract unique runs from cases
const runMap = new Map();
dashboardData.cases.forEach(caseData => {
  caseData.runs.forEach(run => {
    const runId = run.run_id;
    if (!runMap.has(runId)) {
      runMap.set(runId, {
        id: runId,
        name: runNames[runId] || run.run_meta?.name || 'Unnamed Run',
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

// Calculate unique cases per run (count distinct case IDs)
dashboardData.cases.forEach(caseData => {
  caseData.runs.forEach(run => {
    const runId = run.run_id;
    if (runMap.has(runId)) {
      const runData = runMap.get(runId);
      if (!runData.caseIds) runData.caseIds = new Set();
      runData.caseIds.add(caseData.id);
    }
  });
});

// Convert to runs array with MM-DD-YY date format
const runs = Array.from(runMap.values()).map(run => {
  // Convert YYYY-MM-DD to MM-DD-YY
  const [year, month, day] = run.date.split('-');
  const shortYear = year.slice(-2);
  const usDate = `${month}-${day}-${shortYear}`;
  
  return {
    id: run.id,
    name: run.name,
    date: usDate,
    cases: run.caseIds ? run.caseIds.size : run.cases,
    models: run.models.size,
    avg_score: run.scoreCount > 0 
      ? Math.round((run.totalScore / run.scoreCount) * 10) / 10 
      : 0,
    badges: [],
    is_test: false,
    is_single_model: run.models.size === 1
  };
});

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
    latencies: [],
    avg_score: 0
  };
});

// Count wins and scores per model
dashboardData.cases.forEach(caseData => {
  caseData.runs.forEach(run => {
    // Find winner for this run+case (calculate from scores if not set)
    let winner = run.winner;
    let maxScore = -1;
    
    // Calculate winner from scores if not already set
    if (!winner) {
      Object.entries(run.scores || {}).forEach(([model, score]) => {
        const totalScore = typeof score === 'number' ? score : (score.total || 0);
        if (totalScore > maxScore) {
          maxScore = totalScore;
          winner = model;
        }
      });
    }
    
    // Track scores and latencies
    Object.entries(run.scores || {}).forEach(([model, score]) => {
      const totalScore = typeof score === 'number' ? score : (score.total || 0);
      if (modelStats[model]) {
        modelStats[model].total_scores.push(totalScore);
        
        // Track latency
        if (run.responses?.[model]?.latency_ms) {
          modelStats[model].latencies.push(run.responses[model].latency_ms);
        }
      }
    });
    
    // Track wins
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

// Calculate averages and win rate
Object.values(modelStats).forEach(stats => {
  if (stats.total_scores.length > 0) {
    stats.avg_score = Math.round(
      (stats.total_scores.reduce((a, b) => a + b, 0) / stats.total_scores.length) * 10
    ) / 10;
  }
  stats.total_runs = stats.total_scores.length;
  stats.win_rate = stats.total_scores.length > 0
    ? Math.round((stats.total_wins / stats.total_scores.length) * 100)
    : 0;
  stats.avg_latency = stats.latencies.length > 0
    ? Math.round((stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length) / 100) / 10
    : '-';
});

// All models (sorted by avg score) - no limit, show all
const topModels = Object.values(modelStats)
  .filter(m => m.total_scores.length > 0)
  .map(m => ({
    ...m,
    runs: m.total_runs  // Add 'runs' alias for template compatibility
  }))
  .sort((a, b) => b.avg_score - a.avg_score)
  // REMOVED: .slice(0, 10) - now showing ALL models
  .map((m, idx) => ({
    ...m,
    rank: idx + 1  // Add rank (1-based)
  }));

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
