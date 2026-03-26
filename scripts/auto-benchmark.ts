#!/usr/bin/env node
/**
 * Verdict Auto-Benchmark
 * 
 * First-run experience: "Let's find your best models!"
 * 
 * - Detects installed models (Ollama / MLX)
 * - Runs quick eval pack (5-10 cases)
 * - Populates routing table
 * - User ready to use immediately
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import ora from 'ora';
import chalk from 'chalk';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ModelInfo {
  id: string;
  provider: 'ollama' | 'mlx';
  baseUrl: string;
}

interface TestCase {
  category: string;
  prompt: string;
  expectedScore: number; // For quick validation
}

// Quick benchmark cases (10 total, 2 per category)
const QUICK_CASES: TestCase[] = [
  // Code generation
  { category: 'code_generation', prompt: 'Write a Python function to reverse a string', expectedScore: 7 },
  { category: 'code_generation', prompt: 'Implement quicksort in JavaScript', expectedScore: 7 },
  
  // Code review
  { category: 'code_review', prompt: 'Review this function for bugs: def add(a,b): return a+b', expectedScore: 6 },
  { category: 'code_review', prompt: 'What could go wrong with: arr[0] without checking length?', expectedScore: 7 },
  
  // Writing
  { category: 'writing', prompt: 'Write a haiku about programming', expectedScore: 6 },
  { category: 'writing', prompt: 'Compose a one-sentence product description for a code editor', expectedScore: 6 },
  
  // Reasoning
  { category: 'reasoning', prompt: 'Why is async/await better than callbacks?', expectedScore: 7 },
  { category: 'reasoning', prompt: 'Explain binary search in simple terms', expectedScore: 7 },
  
  // Math
  { category: 'math', prompt: 'Calculate: 17 * 23', expectedScore: 10 },
  { category: 'math', prompt: 'What is 144 / 12?', expectedScore: 10 },
];

async function detectModels(): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];
  
  // Detect Ollama
  try {
    const { stdout } = await execAsync('ollama list');
    const lines = stdout.split('\n').slice(1); // Skip header
    
    for (const line of lines) {
      const match = line.match(/^(\S+)/);
      if (match) {
        const modelName = match[1];
        models.push({
          id: modelName,
          provider: 'ollama',
          baseUrl: 'http://localhost:11434/v1',
        });
      }
    }
  } catch {
    // Ollama not installed
  }
  
  // Could add MLX detection here if needed
  
  return models;
}

async function runInference(model: ModelInfo, prompt: string): Promise<{ text: string; latency: number }> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.id,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
      }),
    });
    
    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content || '';
    const latency = Date.now() - startTime;
    
    return { text, latency };
  } catch (err) {
    throw new Error(`Inference failed: ${err instanceof Error ? err.message : err}`);
  }
}

function simpleScore(text: string, category: string): number {
  // Very simple scoring (good enough for auto-benchmark)
  const length = text.length;
  
  if (category === 'math') {
    // Check if contains numbers
    return /\d+/.test(text) ? 10 : 2;
  }
  
  if (category === 'code_generation') {
    // Check if contains code-like patterns
    return /function|def|class|const|let|var/.test(text) ? 8 : 4;
  }
  
  // General: length-based
  if (length < 50) return 3;
  if (length < 150) return 6;
  if (length < 300) return 8;
  return 9;
}

async function benchmark() {
  console.log();
  console.log(chalk.bold.cyan('  🚀 Verdict Auto-Benchmark'));
  console.log(chalk.dim('  Let\'s find your best models!\n'));
  
  // Detect models
  const spinner = ora('  Detecting installed models...').start();
  const models = await detectModels();
  spinner.succeed(`Found ${models.length} models`);
  
  if (models.length === 0) {
    console.log(chalk.red('\n  ❌ No models detected. Install Ollama first:\n'));
    console.log(chalk.dim('     brew install ollama'));
    console.log(chalk.dim('     ollama pull qwen2.5:7b\n'));
    process.exit(1);
  }
  
  console.log();
  for (const model of models) {
    console.log(`  ${chalk.cyan('•')} ${model.id} (${model.provider})`);
  }
  console.log();
  
  // Run benchmark
  const results: Record<string, Record<string, { scores: number[]; latencies: number[] }>> = {};
  
  for (const model of models) {
    console.log(chalk.bold(`  Testing ${model.id}...`));
    results[model.id] = {};
    
    for (const testCase of QUICK_CASES) {
      const testSpinner = ora(`    ${testCase.category}: ${testCase.prompt.slice(0, 50)}...`).start();
      
      try {
        const { text, latency } = await runInference(model, testCase.prompt);
        const score = simpleScore(text, testCase.category);
        
        if (!results[model.id][testCase.category]) {
          results[model.id][testCase.category] = { scores: [], latencies: [] };
        }
        
        results[model.id][testCase.category].scores.push(score);
        results[model.id][testCase.category].latencies.push(latency);
        
        testSpinner.succeed(`${testCase.category}: ${score}/10 (${latency}ms)`);
      } catch (err) {
        testSpinner.fail(`${testCase.category}: FAILED`);
      }
    }
    
    console.log();
  }
  
  // Populate router database
  console.log(chalk.bold('  📊 Updating router database...\n'));
  
  const dbPath = path.join(process.env.HOME || '~', '.verdict', 'router.db');
  const db = new Database(dbPath);
  
  const insertPerf = db.prepare(`
    INSERT OR REPLACE INTO model_performance (
      model, category, avg_score, recent_score, historical_score,
      avg_latency, success_rate, sample_size, confidence, last_used,
      staleness, model_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let inserted = 0;
  for (const [modelId, categories] of Object.entries(results)) {
    for (const [category, data] of Object.entries(categories)) {
      if (data.scores.length === 0) continue;
      
      const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const avgLatency = data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length;
      const sampleSize = data.scores.length;
      const successRate = data.scores.filter(s => s >= 7).length / sampleSize;
      const confidence = Math.min(1.0, sampleSize / 10);
      
      insertPerf.run(
        modelId,
        category,
        avgScore,
        avgScore,
        avgScore,
        avgLatency,
        successRate,
        sampleSize,
        confidence,
        new Date().toISOString(),
        0.0,
        null
      );
      
      inserted++;
      console.log(`  ✅ ${modelId} | ${category}: ${avgScore.toFixed(1)}/10 (${Math.round(avgLatency)}ms avg)`);
    }
  }
  
  db.close();
  
  // Summary
  console.log();
  console.log(chalk.bold.green('  🎉 Benchmark complete!'));
  console.log(`  ${chalk.dim('•')} ${inserted} model×category combinations measured`);
  console.log(`  ${chalk.dim('•')} Router ready for smart routing\n`);
  
  console.log(chalk.dim('  Try it now:'));
  console.log(chalk.cyan('    verdict infer "Write a Python function"\n'));
}

benchmark().catch(err => {
  console.error(chalk.red('\n  ❌ Benchmark failed:'), err);
  process.exit(1);
});
