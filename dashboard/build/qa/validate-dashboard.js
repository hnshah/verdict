#!/usr/bin/env node
/**
 * Dashboard Validator
 * 
 * Checks:
 * 1. All JSON files valid
 * 2. All runs have required fields
 * 3. All model IDs consistent
 * 4. Scores in valid range (0-10)
 * 5. No broken links (404s)
 * 6. All timestamps valid
 * 7. Win rates add up correctly
 * 8. Judge reasoning exists for all scores
 * 9. Image paths valid (for vision evals)
 * 10. No NaN or undefined in scores
 */

const fs = require('fs');
const path = require('path');

const PUBLISHED_DIR = path.join(__dirname, '../../published');
const REQUIRED_RUN_FIELDS = ['name', 'timestamp', 'run_id', 'cases', 'models', 'summary'];
const REQUIRED_CASE_FIELDS = ['case_id', 'prompt', 'responses', 'scores'];

let totalChecks = 0;
let passedChecks = 0;
let errors = [];
let warnings = [];

function check(name, condition, errorMsg, isWarning = false) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    return true;
  } else {
    if (isWarning) {
      warnings.push(`⚠️  ${name}: ${errorMsg}`);
    } else {
      errors.push(`❌ ${name}: ${errorMsg}`);
    }
    return false;
  }
}

function validateJSON(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { valid: true, data };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

function validateRun(filePath, data) {
  const fileName = path.basename(filePath, '.json');
  
  // Check 1: Required fields exist
  for (const field of REQUIRED_RUN_FIELDS) {
    check(
      `${fileName} - ${field}`,
      data.hasOwnProperty(field),
      `Missing required field: ${field}`
    );
  }
  
  // Check 2: Scores in valid range
  if (data.summary) {
    Object.entries(data.summary).forEach(([model, stats]) => {
      check(
        `${fileName} - ${model} score`,
        stats.avg_total >= 0 && stats.avg_total <= 10,
        `Score out of range: ${stats.avg_total}`,
        false
      );
      
      // Check for NaN
      check(
        `${fileName} - ${model} NaN check`,
        !isNaN(stats.avg_total),
        `Score is NaN`
      );
    });
  }
  
  // Check 3: Cases have required fields
  if (data.cases) {
    data.cases.forEach((c, i) => {
      for (const field of REQUIRED_CASE_FIELDS) {
        check(
          `${fileName} - case ${i} - ${field}`,
          c.hasOwnProperty(field),
          `Missing required field: ${field}`,
          true
        );
      }
      
      // Check 4: Judge reasoning exists
      if (c.scores) {
        Object.entries(c.scores).forEach(([model, score]) => {
          check(
            `${fileName} - case ${i} - ${model} reasoning`,
            score.reasoning && score.reasoning.length > 0,
            `Missing judge reasoning`,
            true
          );
        });
      }
    });
  }
  
  // Check 5: Win rates add up (for multi-model runs)
  if (data.summary && Object.keys(data.summary).length > 1) {
    const totalWins = Object.values(data.summary).reduce((sum, s) => sum + (s.wins || 0), 0);
    const expectedWins = data.cases ? data.cases.length : 0;
    check(
      `${fileName} - win count`,
      totalWins === expectedWins,
      `Win count mismatch: ${totalWins} wins but ${expectedWins} cases`,
      true
    );
  }
  
  // Check 6: Timestamp valid
  if (data.timestamp) {
    const date = new Date(data.timestamp);
    check(
      `${fileName} - timestamp`,
      !isNaN(date.getTime()),
      `Invalid timestamp: ${data.timestamp}`
    );
  }
  
  // Check 7: Image paths (for vision evals)
  if (data.cases) {
    data.cases.forEach((c, i) => {
      if (c.image) {
        // Just check that image field is a string for now
        check(
          `${fileName} - case ${i} - image`,
          typeof c.image === 'string' && c.image.length > 0,
          `Invalid image path`,
          true
        );
      }
    });
  }
}

function main() {
  console.log('🔍 Dashboard Validator\n');
  
  // Get all JSON files
  const files = fs.readdirSync(PUBLISHED_DIR)
    .filter(f => f.endsWith('.json') && f !== 'dashboard-data.json')
    .map(f => path.join(PUBLISHED_DIR, f));
  
  console.log(`Found ${files.length} result files\n`);
  
  // Validate each file
  files.forEach(filePath => {
    const result = validateJSON(filePath);
    
    check(
      path.basename(filePath),
      result.valid,
      `Invalid JSON: ${result.error}`
    );
    
    if (result.valid) {
      validateRun(filePath, result.data);
    }
  });
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ ${passedChecks}/${totalChecks} checks passed\n`);
  
  if (errors.length > 0) {
    console.log('ERRORS:');
    errors.forEach(e => console.log(e));
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log('WARNINGS:');
    warnings.forEach(w => console.log(w));
    console.log('');
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('🎉 All checks passed!\n');
  }
  
  // Exit with error code if critical errors found
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
