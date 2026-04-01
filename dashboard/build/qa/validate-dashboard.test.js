/**
 * Dashboard Validation Tests
 */

const validRun = require('./fixtures/valid-run.json');
const brokenVisionRun = require('./fixtures/broken-vision-run.json');

function validateRequiredFields(run, fields) {
  const missing = [];
  fields.forEach(field => {
    if (!run.hasOwnProperty(field)) {
      missing.push(field);
    }
  });
  return { valid: missing.length === 0, missing };
}

function validateScoreRange(run) {
  const issues = [];
  
  if (run.summary) {
    Object.entries(run.summary).forEach(([model, stats]) => {
      if (stats.avg_total < 0 || stats.avg_total > 10) {
        issues.push({
          model,
          score: stats.avg_total,
          error: 'Score out of range (0-10)'
        });
      }
      
      if (isNaN(stats.avg_total)) {
        issues.push({
          model,
          score: stats.avg_total,
          error: 'Score is NaN'
        });
      }
    });
  }
  
  return { valid: issues.length === 0, issues };
}

function findMissingReasoning(run) {
  const missing = [];
  
  if (run.cases) {
    run.cases.forEach((c, i) => {
      if (c.scores) {
        Object.entries(c.scores).forEach(([model, score]) => {
          if (!score.reasoning || score.reasoning.length === 0) {
            missing.push({ caseIndex: i, model });
          }
        });
      }
    });
  }
  
  return missing;
}

describe('Required Fields Validation', () => {
  const requiredFields = ['name', 'timestamp', 'run_id', 'cases', 'models', 'summary'];
  
  test('should pass when all required fields present', () => {
    const result = validateRequiredFields(validRun, requiredFields);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
  
  test('should detect missing fields', () => {
    const incomplete = { ...validRun };
    delete incomplete.timestamp;
    delete incomplete.models;
    
    const result = validateRequiredFields(incomplete, requiredFields);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('timestamp');
    expect(result.missing).toContain('models');
  });
});

describe('Score Range Validation', () => {
  test('should pass valid scores (0-10)', () => {
    const result = validateScoreRange(validRun);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
  
  test('should detect scores out of range', () => {
    const invalid = {
      ...validRun,
      summary: {
        'test-model': {
          avg_total: 15.5
        }
      }
    };
    
    const result = validateScoreRange(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues[0].score).toBe(15.5);
  });
  
  test('should detect NaN scores', () => {
    const invalid = {
      ...validRun,
      summary: {
        'test-model': {
          avg_total: NaN
        }
      }
    };
    
    const result = validateScoreRange(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues[0].error).toContain('NaN');
  });
});

describe('Judge Reasoning Validation', () => {
  test('should have reasoning for all scored cases', () => {
    const missing = findMissingReasoning(validRun);
    expect(missing).toHaveLength(0);
  });
  
  test('should detect missing reasoning', () => {
    const incomplete = {
      ...validRun,
      cases: [{
        ...validRun.cases[0],
        scores: {
          'qwen2.5:7b': {
            total: 9.5,
            accuracy: 10,
            completeness: 9,
            conciseness: 9.5,
            reasoning: '' // Empty reasoning
          }
        }
      }]
    };
    
    const missing = findMissingReasoning(incomplete);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0].model).toBe('qwen2.5:7b');
  });
});

describe('Timestamp Validation', () => {
  test('should have valid ISO timestamp', () => {
    const date = new Date(validRun.timestamp);
    expect(isNaN(date.getTime())).toBe(false);
  });
  
  test('should detect invalid timestamp', () => {
    const date = new Date('invalid-date');
    expect(isNaN(date.getTime())).toBe(true);
  });
});
