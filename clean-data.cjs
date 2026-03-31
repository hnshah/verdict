#!/usr/bin/env node
/**
 * Clean up dashboard-data.json
 * - Consolidate duplicate models
 * - Remove test data
 * - Standardize naming
 */

const fs = require('fs');

console.log('🧹 Starting data cleanup...\n');

// Load dashboard-data.json
const data = JSON.parse(fs.readFileSync('dashboard-data.json', 'utf8'));

// Model name mappings (standardize to colon format)
const modelAliases = {
  'llama3.2-3b': 'llama3.2:3b',
  'qwen2.5-7b': 'qwen2.5:7b',
  'qwen-7b': 'qwen2.5:7b',      // Old name → current version
  'qwen-32b': 'qwen2.5:32b',     // Old name → current version
  'test-phi4': null,              // Remove (test data)
  'cogito': null                  // Remove (test data)
};

// Track changes
let modelsRemoved = 0;
let modelsRenamed = 0;
let casesUpdated = 0;

console.log('1. Consolidating model names...');

// Update model references in cases
data.cases.forEach(caseData => {
  caseData.runs.forEach(run => {
    // Update responses
    const newResponses = {};
    Object.entries(run.responses || {}).forEach(([modelId, response]) => {
      const newId = modelAliases[modelId] !== undefined ? modelAliases[modelId] : modelId;
      if (newId === null) {
        modelsRemoved++;
      } else {
        newResponses[newId] = { ...response, model_id: newId };
        if (newId !== modelId) modelsRenamed++;
      }
    });
    run.responses = newResponses;
    
    // Update scores
    const newScores = {};
    Object.entries(run.scores || {}).forEach(([modelId, score]) => {
      const newId = modelAliases[modelId] !== undefined ? modelAliases[modelId] : modelId;
      if (newId !== null) {
        newScores[newId] = score;
      }
    });
    run.scores = newScores;
    
    // Update winner
    if (run.winner && modelAliases[run.winner] !== undefined) {
      run.winner = modelAliases[run.winner] || run.winner;
    }
    
    casesUpdated++;
  });
});

console.log(`   - Removed ${modelsRemoved} test model references`);
console.log(`   - Renamed ${modelsRenamed} duplicate model references`);
console.log(`   - Updated ${casesUpdated} case entries\n`);

console.log('2. Updating models list...');

// Update models object
const newModels = {};
Object.entries(data.models).forEach(([modelId, modelData]) => {
  const newId = modelAliases[modelId] !== undefined ? modelAliases[modelId] : modelId;
  if (newId !== null) {
    newModels[newId] = { ...modelData, name: newId };
  }
});
data.models = newModels;

console.log(`   - Models before: ${Object.keys(data.models).length + modelsRemoved}`);
console.log(`   - Models after: ${Object.keys(data.models).length}\n`);

console.log('3. Removing empty cases...');

// Remove cases with no runs
const beforeCases = data.cases.length;
data.cases = data.cases.filter(caseData => {
  return caseData.runs.some(run => Object.keys(run.responses || {}).length > 0);
});

console.log(`   - Cases before: ${beforeCases}`);
console.log(`   - Cases after: ${data.cases.length}\n`);

console.log('4. Updating metadata...');

// Update meta
data.meta = {
  total_runs: new Set(data.cases.flatMap(c => c.runs.map(r => r.run_id))).size,
  total_cases: data.cases.length,
  total_models: Object.keys(data.models).length,
  last_updated: new Date().toISOString().split('T')[0]
};

console.log(`   - Total runs: ${data.meta.total_runs}`);
console.log(`   - Total cases: ${data.meta.total_cases}`);
console.log(`   - Total models: ${data.meta.total_models}\n`);

// Save cleaned data
fs.writeFileSync('dashboard-data.json.backup', fs.readFileSync('dashboard-data.json', 'utf8'));
fs.writeFileSync('dashboard-data.json', JSON.stringify(data, null, 2));

console.log('✅ Cleanup complete!');
console.log('   - Backup saved to dashboard-data.json.backup');
console.log('   - Cleaned data written to dashboard-data.json\n');

console.log('📊 Summary:');
console.log(`   - Removed models: test-phi4, cogito`);
console.log(`   - Consolidated: llama3.2-3b → llama3.2:3b`);
console.log(`   - Consolidated: qwen2.5-7b → qwen2.5:7b`);
console.log(`   - Consolidated: qwen-7b → qwen2.5:7b`);
console.log(`   - Consolidated: qwen-32b → qwen2.5:32b`);
