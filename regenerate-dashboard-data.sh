#!/bin/bash
# regenerate-dashboard-data.sh - Rebuild dashboard-data.json from individual run files

set -e

echo "Regenerating dashboard-data.json from all run files..."

# Use the dashboard generator (if exists) or manual approach
cd dashboard/build

# Generate from all run files in published/data
node -e "
const fs = require('fs');

const runFiles = fs.readdirSync('../../dashboard/published/data')
  .filter(f => f.startsWith('2026') && f.endsWith('.json'))
  .sort();

console.log('Processing', runFiles.length, 'run files...');

const allCases = new Map();
const models = {};

runFiles.forEach(file => {
  const data = JSON.parse(fs.readFileSync(\`../../dashboard/published/data/\${file}\`, 'utf8'));
  const runId = file.replace(/^2026-03-\\d+-/, '').replace('.json', '');
  
  console.log('  -', runId, ':', data.name || 'Unnamed');
  
  data.cases.forEach(caseData => {
    const caseId = caseData.case_id;
    
    if (!allCases.has(caseId)) {
      allCases.set(caseId, {
        id: caseId,
        name: caseData.name || caseId,
        prompt: caseData.prompt || '',
        criteria: caseData.criteria || '',
        runs: []
      });
    }
    
    const runEntry = {
      run_id: runId,
      run_meta: {
        name: data.name || 'Unnamed Run',
        timestamp: data.timestamp
      },
      responses: caseData.responses || {},
      scores: caseData.scores || {},
      winner: caseData.winner || null
    };
    
    allCases.get(caseId).runs.push(runEntry);
    
    // Track models
    Object.keys(caseData.responses || {}).forEach(model => {
      models[model] = true;
    });
  });
});

const output = {
  meta: {
    total_runs: runFiles.length,
    total_cases: allCases.size,
    total_models: Object.keys(models).length,
    last_updated: new Date().toISOString().split('T')[0]
  },
  models: Object.fromEntries(Object.keys(models).sort().map(m => [m, {}])),
  cases: Array.from(allCases.values())
};

fs.writeFileSync('../../dashboard-data.json', JSON.stringify(output, null, 2));
console.log('✅ Generated dashboard-data.json');
console.log('  -', output.meta.total_runs, 'runs');
console.log('  -', output.meta.total_cases, 'cases');
console.log('  -', output.meta.total_models, 'models');
"

cd ../..

echo ""
echo "Running cleanup..."
node clean-data.cjs

echo ""
echo "✅ Dashboard data regenerated!"
