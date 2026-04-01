#!/usr/bin/env node
/**
 * Judge Behavior Analyzer
 * 
 * Analyzes judge scoring patterns across all runs:
 * - Does judge reward helpfulness over correctness?
 * - Does judge penalize non-answers?
 * - What criteria does judge weight most heavily?
 * - Are there biases toward certain response styles?
 */

const fs = require('fs');
const path = require('path');

const PUBLISHED_DIR = path.join(__dirname, '../../published');

let patterns = {
  rewardsHelpfulness: 0,
  penalizesNonAnswers: 0,
  totalNonAnswers: 0,
  avgAccuracyWeight: [],
  avgCompletenessWeight: [],
  avgConcisenessWeight: [],
  totalCases: 0
};

function analyzeJudgeBehavior(run) {
  if (!run.cases) return;
  
  run.cases.forEach(c => {
    patterns.totalCases++;
    
    Object.entries(c.responses || {}).forEach(([model, resp]) => {
      if (!c.scores?.[model]) return;
      
      const responseText = String(resp.text || resp).toLowerCase();
      const score = c.scores[model].total;
      
      // Check for non-answer patterns
      const isNonAnswer = 
        responseText.includes("i cannot") ||
        responseText.includes("i can't") ||
        responseText.includes("i don't have") ||
        responseText.includes("as a text-based") ||
        responseText.includes("as an ai");
      
      if (isNonAnswer) {
        patterns.totalNonAnswers++;
        if (score > 5) {
          patterns.rewardsHelpfulness++;
        } else {
          patterns.penalizesNonAnswers++;
        }
      }
      
      // Collect criteria weights
      const scores = c.scores[model];
      if (scores.accuracy !== undefined) {
        patterns.avgAccuracyWeight.push(scores.accuracy / 10);
      }
      if (scores.completeness !== undefined) {
        patterns.avgCompletenessWeight.push(scores.completeness / 10);
      }
      if (scores.conciseness !== undefined) {
        patterns.avgConcisenessWeight.push(scores.conciseness / 10);
      }
    });
  });
}

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function main() {
  console.log('🔍 Judge Behavior Analyzer\n');
  
  const files = fs.readdirSync(PUBLISHED_DIR)
    .filter(f => f.endsWith('.json') && f !== 'dashboard-data.json')
    .map(f => path.join(PUBLISHED_DIR, f));
  
  console.log(`Analyzing ${files.length} result files\n`);
  
  files.forEach(filePath => {
    try {
      const run = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      analyzeJudgeBehavior(run);
    } catch (e) {
      console.error(`Error reading ${path.basename(filePath)}: ${e.message}`);
    }
  });
  
  console.log('='.repeat(60));
  console.log('\nJUDGE BEHAVIOR PATTERNS:\n');
  
  console.log(`Total Cases Analyzed: ${patterns.totalCases}`);
  console.log(`Total Non-Answers Found: ${patterns.totalNonAnswers}\n`);
  
  if (patterns.totalNonAnswers > 0) {
    const helpfulnessRate = (patterns.rewardsHelpfulness / patterns.totalNonAnswers * 100).toFixed(1);
    const penaltyRate = (patterns.penalizesNonAnswers / patterns.totalNonAnswers * 100).toFixed(1);
    
    console.log('Non-Answer Handling:');
    console.log(`  Rewards "helpful" non-answers (>5/10): ${helpfulnessRate}%`);
    console.log(`  Penalizes non-answers (<5/10): ${penaltyRate}%\n`);
    
    if (patterns.rewardsHelpfulness > patterns.penalizesNonAnswers) {
      console.log('  ⚠️  Judge favors helpfulness over correctness!\n');
    }
  }
  
  if (patterns.avgAccuracyWeight.length > 0) {
    console.log('Criteria Weights (0-1 scale):');
    console.log(`  Accuracy:     ${(avg(patterns.avgAccuracyWeight)).toFixed(2)}`);
    console.log(`  Completeness: ${(avg(patterns.avgCompletenessWeight)).toFixed(2)}`);
    console.log(`  Conciseness:  ${(avg(patterns.avgConcisenessWeight)).toFixed(2)}\n`);
    
    const weights = {
      accuracy: avg(patterns.avgAccuracyWeight),
      completeness: avg(patterns.avgCompletenessWeight),
      conciseness: avg(patterns.avgConcisenessWeight)
    };
    
    const highest = Object.keys(weights).reduce((a, b) => 
      weights[a] > weights[b] ? a : b
    );
    
    console.log(`  Primary focus: ${highest} (${(weights[highest]).toFixed(2)})\n`);
  }
  
  console.log('='.repeat(60));
  console.log('');
}

main();
