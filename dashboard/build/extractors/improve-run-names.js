#!/usr/bin/env node
/**
 * Improve run names by generating descriptive names from run data
 * Usage: node improve-run-names.js <result-file>
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node improve-run-names.js <result-file>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Generate a better name if current name is generic
function generateName(data) {
  const currentName = data.name || 'My Evals';
  
  // If name is already descriptive, keep it
  if (currentName !== 'My Evals' && currentName.length > 10) {
    return currentName;
  }
  
  const modelCount = data.models?.length || 0;
  const caseCount = data.cases?.length || 0;
  const timestamp = data.timestamp || '';
  const date = timestamp.split('T')[0];
  
  // Try to use eval pack name
  if (data.eval_pack?.name && data.eval_pack.name !== 'general') {
    return `${data.eval_pack.name} (${modelCount} models)`;
  }
  
  // Generate descriptive name based on content
  if (modelCount === 1) {
    const modelName = Object.keys(data.summary || {})[0] || 'Unknown';
    return `${modelName} - ${caseCount} cases`;
  }
  
  if (modelCount <= 3) {
    return `${modelCount} Model Comparison - ${caseCount} cases`;
  }
  
  if (modelCount >= 10) {
    return `Comprehensive Benchmark (${modelCount} models)`;
  }
  
  return `${modelCount} Models - ${caseCount} Cases`;
}

// Update the name
data.name = generateName(data);

// Write back to file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log(`✅ Updated: ${path.basename(filePath)} → "${data.name}"`);
