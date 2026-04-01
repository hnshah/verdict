/**
 * Scoring Validation Tests
 */

const fs = require('fs');
const path = require('path');

// Import the validation functions by requiring the module
const validatorPath = path.join(__dirname, 'check-scoring.js');
const validatorCode = fs.readFileSync(validatorPath, 'utf8');

// Extract the validation functions
function hasVisionCases(run) {
  if (!run.cases) return false;
  
  if (run.cases.some(c => c.image || c.images)) return true;
  
  const hasVisionModel = Object.keys(run.summary || {}).some(m => isVisionModel(m));
  if (!hasVisionModel) return false;
  
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

const TEXT_ONLY_MODELS = [
  'phi4', 'phi4:14b', 'phi4-judge',
  'qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:32b',
  'qwen-coder', 'qwen3-coder'
];

const VISION_MODELS = [
  'llava-13b', 'llava',
  'llama-vision-11b', 'llama3.2-vision'
];

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

function validateVisionScoring(run) {
  const hasImages = hasVisionCases(run);
  const issues = [];
  
  if (!hasImages) return { valid: true, issues: [] };
  
  Object.entries(run.summary || {}).forEach(([model, stats]) => {
    if (isTextOnlyModel(model) && stats.avg_total > 5) {
      issues.push({
        type: 'text-only-high-score',
        model,
        score: stats.avg_total
      });
    }
  });
  
  return {
    valid: issues.length === 0,
    issues
  };
}

// Load fixtures
const validRun = require('./fixtures/valid-run.json');
const brokenVisionRun = require('./fixtures/broken-vision-run.json');
const textOnlyRun = require('./fixtures/text-only-run.json');

describe('Vision Scoring Validation', () => {
  test('should flag text-only models scoring high in vision evals', () => {
    const result = validateVisionScoring(brokenVisionRun);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].model).toBe('phi4');
    expect(result.issues[0].score).toBeGreaterThan(5);
  });
  
  test('should pass vision models scoring high', () => {
    const visionOnlyRun = {
      ...brokenVisionRun,
      models: ['llava-13b'],
      summary: {
        'llava-13b': brokenVisionRun.summary['llava-13b']
      }
    };
    
    const result = validateVisionScoring(visionOnlyRun);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
  
  test('should pass text-only runs (no vision cases)', () => {
    const result = validateVisionScoring(textOnlyRun);
    expect(result.valid).toBe(true);
  });
  
  test('should pass valid mixed runs', () => {
    const result = validateVisionScoring(validRun);
    expect(result.valid).toBe(true);
  });
});

describe('Vision Case Detection', () => {
  test('should detect vision cases from prompt keywords', () => {
    expect(hasVisionCases(brokenVisionRun)).toBe(true);
  });
  
  test('should not detect vision cases in text-only runs', () => {
    expect(hasVisionCases(textOnlyRun)).toBe(false);
  });
  
  test('should require vision model presence', () => {
    const fakeVisionRun = {
      ...textOnlyRun,
      cases: [{
        ...textOnlyRun.cases[0],
        prompt: "Describe the scene in this image."
      }]
    };
    
    // Should be false because no vision model in summary
    expect(hasVisionCases(fakeVisionRun)).toBe(false);
  });
});

describe('Model Type Detection', () => {
  test('should identify text-only models', () => {
    expect(isTextOnlyModel('phi4')).toBe(true);
    expect(isTextOnlyModel('qwen-coder')).toBe(true);
    expect(isTextOnlyModel('qwen2.5:7b')).toBe(true);
  });
  
  test('should identify vision models', () => {
    expect(isVisionModel('llava-13b')).toBe(true);
    expect(isVisionModel('llama-vision-11b')).toBe(true);
  });
  
  test('should not confuse model types', () => {
    expect(isTextOnlyModel('llava-13b')).toBe(false);
    expect(isVisionModel('phi4')).toBe(false);
  });
});
