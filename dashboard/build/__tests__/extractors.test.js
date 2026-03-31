/**
 * Tests for dashboard data extractors
 */

const { describe, it, expect } = require('node:test');
const fs = require('fs');
const path = require('path');

describe('Dashboard Extractors', () => {
  describe('dashboard-from-data.js', () => {
    it('should exist', () => {
      const extractorPath = path.join(__dirname, '../extractors/dashboard-from-data.js');
      expect(fs.existsSync(extractorPath)).toBe(true);
    });

    it('should generate valid JSON output', () => {
      const { execSync } = require('child_process');
      const output = execSync(
        'node extractors/dashboard-from-data.js ../../../dashboard-data.json',
        { cwd: path.join(__dirname, '..'), encoding: 'utf8' }
      );
      
      const data = JSON.parse(output);
      expect(data).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.runs).toBeDefined();
      expect(data.top_models).toBeDefined();
      expect(Array.isArray(data.runs)).toBe(true);
      expect(Array.isArray(data.top_models)).toBe(true);
    });

    it('should include start time and duration in runs', () => {
      const { execSync } = require('child_process');
      const output = execSync(
        'node extractors/dashboard-from-data.js ../../../dashboard-data.json',
        { cwd: path.join(__dirname, '..'), encoding: 'utf8' }
      );
      
      const data = JSON.parse(output);
      if (data.runs.length > 0) {
        const run = data.runs[0];
        expect(run.start_time).toBeDefined();
        expect(run.duration).toBeDefined();
      }
    });

    it('should use MM-DD-YY date format', () => {
      const { execSync } = require('child_process');
      const output = execSync(
        'node extractors/dashboard-from-data.js ../../../dashboard-data.json',
        { cwd: path.join(__dirname, '..'), encoding: 'utf8' }
      );
      
      const data = JSON.parse(output);
      if (data.runs.length > 0) {
        const run = data.runs[0];
        // Format: MM-DD-YY (e.g., 03-31-26)
        expect(run.date).toMatch(/^\d{2}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('model-from-data.js', () => {
    it('should exist', () => {
      const extractorPath = path.join(__dirname, '../extractors/model-from-data.js');
      expect(fs.existsSync(extractorPath)).toBe(true);
    });

    it('should generate model data', () => {
      const { execSync } = require('child_process');
      
      // Get first model from dashboard-data.json
      const dashboardData = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../../dashboard-data.json'), 'utf8')
      );
      const modelName = Object.keys(dashboardData.models)[0];
      
      if (modelName) {
        const output = execSync(
          `node extractors/model-from-data.js "${modelName}" ../../../dashboard-data.json`,
          { cwd: path.join(__dirname, '..'), encoding: 'utf8' }
        );
        
        const data = JSON.parse(output);
        expect(data.model_name).toBe(modelName);
        expect(data.runs).toBeDefined();
        expect(Array.isArray(data.runs)).toBe(true);
      }
    });

    it('should include dimension scores in runs', () => {
      const { execSync } = require('child_process');
      
      const dashboardData = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../../dashboard-data.json'), 'utf8')
      );
      const modelName = Object.keys(dashboardData.models)[0];
      
      if (modelName) {
        const output = execSync(
          `node extractors/model-from-data.js "${modelName}" ../../../dashboard-data.json`,
          { cwd: path.join(__dirname, '..'), encoding: 'utf8' }
        );
        
        const data = JSON.parse(output);
        if (data.runs.length > 0) {
          const run = data.runs[0];
          // Should have dimension scores
          expect(typeof run.accuracy).toBe('number');
          expect(typeof run.completeness).toBe('number');
          expect(typeof run.conciseness).toBe('number');
        }
      }
    });
  });

  describe('build.js', () => {
    it('should exist', () => {
      const buildPath = path.join(__dirname, '../build.js');
      expect(fs.existsSync(buildPath)).toBe(true);
    });
  });
});

describe('Dashboard Data Quality', () => {
  it('dashboard-data.json should be valid JSON', () => {
    const dataPath = path.join(__dirname, '../../../dashboard-data.json');
    expect(fs.existsSync(dataPath)).toBe(true);
    
    const content = fs.readFileSync(dataPath, 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('dashboard-data.json should have required fields', () => {
    const dataPath = path.join(__dirname, '../../../dashboard-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    expect(data.meta).toBeDefined();
    expect(data.meta.total_runs).toBeDefined();
    expect(data.meta.total_cases).toBeDefined();
    expect(data.meta.total_models).toBeDefined();
    expect(data.models).toBeDefined();
    expect(data.cases).toBeDefined();
    expect(Array.isArray(data.cases)).toBe(true);
  });

  it('all cases should have valid structure', () => {
    const dataPath = path.join(__dirname, '../../../dashboard-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    data.cases.forEach((caseData, i) => {
      expect(caseData.id).toBeDefined();
      expect(caseData.runs).toBeDefined();
      expect(Array.isArray(caseData.runs)).toBe(true);
      
      caseData.runs.forEach((run, j) => {
        expect(run.run_id).toBeDefined();
        expect(run.responses).toBeDefined();
        expect(run.scores).toBeDefined();
      });
    });
  });
});
