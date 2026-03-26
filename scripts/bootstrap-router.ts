#!/usr/bin/env node
/**
 * Bootstrap Verdict Router with eval results
 * 
 * Imports performance data from verdict eval runs into router database
 * so routing starts smart instead of empty.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface EvalResult {
  run_id: string;
  name: string;
  timestamp: string;
  models: string[];
  cases: Array<{
    case_id: string;
    prompt: string;
    criteria: string;
    responses: Record<string, {
      model_id: string;
      text: string;
      latency_ms: number;
    }>;
    scores: Record<string, {
      total: number;
    }>;
  }>;
}

// Map eval pack names to task categories
const CATEGORY_MAP: Record<string, string> = {
  'oss-contribution': 'code_review',
  'code-generation': 'code_generation',
  'coding': 'code_generation',
  'general': 'writing',
  'instruction-following': 'writing',
  'reasoning': 'reasoning',
  'tool-calling': 'code_generation', // Tools often code-related
  'extreme-edge-cases': 'code_review',
  'edge-case-marathon': 'code_review',
  'failure-modes': 'code_review',
  'stress-test': 'code_generation',
  'performance-benchmark': 'code_generation',
};

function inferCategory(packName: string, prompt: string): string {
  // Check pack name first
  const normalizedName = packName.toLowerCase();
  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (normalizedName.includes(key)) {
      return category;
    }
  }

  // Fallback: analyze prompt
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('review') || lowerPrompt.includes('analyze') || lowerPrompt.includes('debug')) {
    return 'code_review';
  }
  if (lowerPrompt.includes('write') || lowerPrompt.includes('implement') || lowerPrompt.includes('create')) {
    return 'code_generation';
  }
  if (lowerPrompt.includes('explain') || lowerPrompt.includes('why') || lowerPrompt.includes('how')) {
    return 'reasoning';
  }
  
  return 'writing'; // Default
}

/**
 * Normalize model names to match config
 * Prevents qwen7b vs qwen2.5:7b mismatches
 */
function normalizeModelName(importedName: string, configModels: string[]): string {
  // Try exact match first
  if (configModels.includes(importedName)) {
    return importedName;
  }
  
  // Try fuzzy match (qwen7b → qwen2.5:7b, llama32-3b → llama3.2:3b)
  const fuzzy = configModels.find((m: string) => {
    const baseName = (name: string) => name.replace(/[0-9:.]/g, '').toLowerCase();
    return baseName(m) === baseName(importedName);
  });
  
  if (fuzzy) {
    console.log(`  ⚠️  Mapping ${importedName} → ${fuzzy}`);
    return fuzzy;
  }
  
  // No match - skip this model
  console.warn(`  ⚠️  Model ${importedName} not in config, skipping...`);
  return ''; // Empty string = skip
}

async function bootstrap() {
  console.log('🔄 Bootstrapping Verdict Router with eval data...\n');

  // Find results directory
  const resultsDir = path.join(__dirname, '..', 'results');
  if (!fs.existsSync(resultsDir)) {
    console.error('❌ No results directory found');
    process.exit(1);
  }

  // Find all result JSON files
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(resultsDir, f));

  if (files.length === 0) {
    console.error('❌ No result files found');
    process.exit(1);
  }

  console.log(`📊 Found ${files.length} eval result files\n`);

  // Open router database
  const dbPath = path.join(process.env.HOME || '~', '.verdict', 'router.db');
  const db = new Database(dbPath);

  // Prepare statement for inserting performance data
  const insertPerf = db.prepare(`
    INSERT OR REPLACE INTO model_performance (
      model, category, avg_score, recent_score, historical_score,
      avg_latency, success_rate, sample_size, confidence, last_used,
      staleness, model_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Track stats
  const stats: Record<string, Record<string, { scores: number[], latencies: number[] }>> = {};

  // Process all result files
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const result: EvalResult = JSON.parse(content);
    
    console.log(`  Processing: ${result.name} (${result.cases.length} cases)`);

    for (const testCase of result.cases) {
      const category = inferCategory(result.name, testCase.prompt);
      
      for (const modelId of result.models) {
        const response = testCase.responses[modelId];
        const score = testCase.scores[modelId];
        
        if (!response || !score) continue;

        // Initialize stats tracking
        if (!stats[modelId]) stats[modelId] = {};
        if (!stats[modelId][category]) stats[modelId][category] = { scores: [], latencies: [] };

        // Add this data point
        stats[modelId][category].scores.push(score.total);
        stats[modelId][category].latencies.push(response.latency_ms);
      }
    }
  }

  console.log('\n📈 Aggregating performance data...\n');

  // Insert aggregated data
  let inserted = 0;
  for (const [modelId, categories] of Object.entries(stats)) {
    for (const [category, data] of Object.entries(categories)) {
      const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const avgLatency = data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length;
      const sampleSize = data.scores.length;
      const successRate = data.scores.filter(s => s >= 7).length / sampleSize;
      
      // Wilson confidence interval (simplified)
      const confidence = Math.min(1.0, sampleSize / 10);

      insertPerf.run(
        modelId,
        category,
        avgScore,
        avgScore, // recent = historical for bootstrap
        avgScore,
        avgLatency,
        successRate,
        sampleSize,
        confidence,
        new Date().toISOString(),
        0.0, // No staleness
        null // No version tracking yet
      );

      inserted++;
      console.log(`  ✅ ${modelId} | ${category}: ${avgScore.toFixed(1)}/10 (${sampleSize} samples, ${avgLatency.toFixed(0)}ms avg)`);
    }
  }

  db.close();

  console.log(`\n🎉 Bootstrap complete!`);
  console.log(`   ${inserted} model×category combinations imported`);
  console.log(`   Router now has performance baseline for smart routing\n`);
}

bootstrap().catch(err => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
