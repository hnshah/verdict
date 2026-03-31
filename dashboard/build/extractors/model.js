#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const resultsDir = '/Users/Vera/.openclaw/workspace/verdict/results';
const modelName = process.argv[2];

if (!modelName) {
  console.error('Usage: node model.js <model-name>');
  process.exit(1);
}

const files = fs.readdirSync(resultsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => path.join(resultsDir, f))
  .sort()
  .reverse();

const runs = [];
const allCases = {};
let totalScore = 0;
let totalWins = 0;
let totalLatency = 0;
let count = 0;

files.forEach(filePath => {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!data.summary || !data.summary[modelName]) return;
  
  const stats = data.summary[modelName];
  const fileName = path.basename(filePath, '.json');
  
  runs.push({
    id: fileName,
    name: data.name,
    date: data.timestamp.split('T')[0],
    score: Math.round(stats.avg_total * 10) / 10,
    accuracy: Math.round(stats.avg_accuracy * 10) / 10,
    completeness: Math.round(stats.avg_completeness * 10) / 10,
    conciseness: Math.round(stats.avg_conciseness * 10) / 10,
    wins: stats.wins || 0,
    latency: Math.round(stats.avg_latency_ms / 100) / 10
  });
  
  totalScore += stats.avg_total;
  totalWins += stats.wins || 0;
  totalLatency += stats.avg_latency_ms;
  count++;
  
  (data.cases || []).forEach(c => {
    if (c.scores && c.scores[modelName]) {
      const caseId = c.case_id;
      if (!allCases[caseId]) {
        allCases[caseId] = {
          id: caseId,
          prompt: c.prompt,
          scores: []
        };
      }
      allCases[caseId].scores.push(c.scores[modelName].total);
    }
  });
});

const casesList = Object.values(allCases).map(c => ({
  id: c.id,
  prompt: c.prompt,
  score: Math.round((c.scores.reduce((a,b) => a+b, 0) / c.scores.length) * 10) / 10
}));

const bestCases = casesList.sort((a,b) => b.score - a.score).slice(0, 5);
const worstCases = casesList.sort((a,b) => a.score - b.score).slice(0, 5);

console.log(JSON.stringify({
  model_name: modelName,
  total_runs: runs.length,
  total_cases: Object.keys(allCases).length,
  avg_score: count > 0 ? Math.round((totalScore / count) * 10) / 10 : 0,
  total_wins: totalWins,
  avg_latency: count > 0 ? Math.round((totalLatency / count) / 100) / 10 : 0,
  runs,
  best_cases: bestCases,
  worst_cases: worstCases
}, null, 2));
