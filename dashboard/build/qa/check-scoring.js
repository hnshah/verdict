#!/usr/bin/env node
/**
 * Scoring Sanity Checker
 * 
 * Detects illogical scoring patterns:
 * - Text-only models scoring high in vision benchmarks
 * - Vision models scoring low when they should excel
 * - Scores that don't match response quality
 */

const fs = require('fs');
const path = require('path');

const PUBLISHED_DIR = path.join(__dirname, '../../published');

// Known model capabilities
const TEXT_ONLY_MODELS = [
  'phi4', 'phi4:14b', 'phi4-judge',
  'qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:32b',
  'qwen2.5-7b', 'qwen-7b', 'qwen-32b',
  'qwen-coder', 'qwen3-coder', 'qwen2.5-coder:7b',
  'llama3.2:3b', 'llama3.2-3b', 'llama3.3:70b',
  'gemma2:9b', 'mistral:7b', 'mathstral:7b',
  'deepseek-coder', 'deepseek-coder:6.7b',
  'cogito', 'qwen3-4b'
];

const VISION_MODELS = [
  'llava-13b', 'llava',
  'llama-vision-11b', 'llama3.2-vision',
  'qwen2.5-vl', 'qwen-vl'
];

let issues = [];
let warnings = [];

function hasVisionCases(run) {
  if (!run.cases) return false;
  
  // Check for explicit image fields
  if (run.cases.some(c => c.image || c.images)) return true;
  
  // Check if run has vision models (strong signal it's a vision eval)
  const hasVisionModel = Object.keys(run.summary || {}).some(m => isVisionModel(m));
  if (!hasVisionModel) return false;
  
  // Check for vision-specific prompts (be strict to avoid false positives)
  const visionPhrases = [
    'describe the scene', 
    'what do you see in',
    'describe this image',
    'what is shown in',
    'analyze the image',
    'describe what you see'
  ];
  
  return run.cases.some(c => {
    const prompt = (c.prompt || '').toLowerCase();
    return visionPhrases.some(phrase => prompt.includes(phrase));
  });
}

function isTextOnlyModel(modelName) {
  return TEXT_ONLY_MODELS.some(m => 
    modelName.toLowerCase().includes(m.toLowerCase())
  );
}

function isVisionModel(modelName) {
  return VISION_MODELS.some(m => 
    modelName.toLowerCase().includes(m.toLowerCase())
  );
}

function validateVisionScoring(filePath, run) {
  const fileName = path.basename(filePath, '.json');
  const hasImages = hasVisionCases(run);
  
  if (!hasImages) return;
  
  // Check for text-only models scoring high in vision benchmarks
  Object.entries(run.summary || {}).forEach(([model, stats]) => {
    if (isTextOnlyModel(model)) {
      if (stats.avg_total > 5) {
        issues.push({
          file: fileName,
          type: 'broken-vision-scoring',
          severity: 'critical',
          message: `Text-only model ${model} scored ${stats.avg_total}/10 in vision eval (expected <5)`
        });
      }
    }
    
    // Check for vision models scoring unusually low
    if (isVisionModel(model)) {
      if (stats.avg_total < 6) {
        warnings.push({
          file: fileName,
          type: 'low-vision-score',
          severity: 'warning',
          message: `Vision model ${model} scored only ${stats.avg_total}/10 (expected >6)`
        });
      }
    }
  });
  
  // Check for text-only models scoring higher than vision models
  const textScores = Object.entries(run.summary || {})
    .filter(([model]) => isTextOnlyModel(model))
    .map(([model, stats]) => ({ model, score: stats.avg_total }));
  
  const visionScores = Object.entries(run.summary || {})
    .filter(([model]) => isVisionModel(model))
    .map(([model, stats]) => ({ model, score: stats.avg_total }));
  
  if (textScores.length > 0 && visionScores.length > 0) {
    textScores.forEach(text => {
      visionScores.forEach(vision => {
        if (text.score > vision.score) {
          issues.push({
            file: fileName,
            type: 'inverted-scoring',
            severity: 'critical',
            message: `Text-only ${text.model} (${text.score}) scored higher than vision ${vision.model} (${vision.score})`
          });
        }
      });
    });
  }
}

function checkNonAnswerRewards(filePath, run) {
  const fileName = path.basename(filePath, '.json');
  const hasImages = hasVisionCases(run);
  
  if (!hasImages) return;
  
  // Check if judge is rewarding "I can't see" type responses
  run.cases?.forEach((c, i) => {
    Object.entries(c.responses || {}).forEach(([model, resp]) => {
      const responseText = String(resp.text || resp);
      const isNonAnswer = 
        responseText.includes("I cannot view") ||
        responseText.includes("I can't see") ||
        responseText.includes("I don't have access") ||
        responseText.includes("as a text-based model");
      
      if (isNonAnswer && c.scores?.[model]) {
        const score = c.scores[model].total;
        if (score > 5) {
          warnings.push({
            file: fileName,
            type: 'rewarding-non-answers',
            severity: 'warning',
            message: `Case ${i}: Model ${model} scored ${score}/10 for non-answer response`
          });
        }
      }
    });
  });
}

function main() {
  console.log('🔍 Scoring Sanity Checker\n');
  
  const files = fs.readdirSync(PUBLISHED_DIR)
    .filter(f => f.endsWith('.json') && f !== 'dashboard-data.json')
    .map(f => path.join(PUBLISHED_DIR, f));
  
  console.log(`Checking ${files.length} result files\n`);
  
  files.forEach(filePath => {
    try {
      const run = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      validateVisionScoring(filePath, run);
      checkNonAnswerRewards(filePath, run);
    } catch (e) {
      console.error(`Error reading ${path.basename(filePath)}: ${e.message}`);
    }
  });
  
  console.log('='.repeat(60));
  console.log('');
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ No scoring issues detected!\n');
  } else {
    if (issues.length > 0) {
      console.log(`❌ CRITICAL ISSUES (${issues.length}):\n`);
      issues.forEach(issue => {
        console.log(`  ${issue.file}`);
        console.log(`  → ${issue.message}\n`);
      });
    }
    
    if (warnings.length > 0) {
      console.log(`⚠️  WARNINGS (${warnings.length}):\n`);
      warnings.forEach(warn => {
        console.log(`  ${warn.file}`);
        console.log(`  → ${warn.message}\n`);
      });
    }
  }
  
  process.exit(issues.length > 0 ? 1 : 0);
}

main();
