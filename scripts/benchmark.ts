#!/usr/bin/env node
/**
 * Performance benchmark for Verdict
 * 
 * Tests throughput, latency, and cost across multiple models.
 * 
 * Usage:
 *   npm run benchmark
 *   npm run benchmark -- --models "qwen2.5:7b,sonnet,gpt-4o"
 *   npm run benchmark -- --tasks 20
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import chalk from 'chalk'
import { callModel } from '../src/providers/compat.js'
import type { ModelConfig } from '../src/types/index.js'

interface BenchmarkResult {
  model: string
  tasks: number
  total_time_ms: number
  avg_latency_ms: number
  min_latency_ms: number
  max_latency_ms: number
  total_tokens: number
  tokens_per_second: number
  total_cost_usd: number
  cost_per_task_usd: number
  success_rate: number
}

const BENCHMARK_TASKS = [
  "Explain quantum computing in 2 sentences",
  "Write a haiku about debugging",
  "Calculate: (15 * 8) + (23 - 7)",
  "What's the capital of France?",
  "Reverse this string: 'hello world'",
  "List 3 benefits of exercise",
  "Translate 'good morning' to Spanish",
  "What year did WWI end?",
  "Name 2 programming languages",
  "What is 25% of 200?",
]

async function benchmarkModel(model: ModelConfig, taskCount: number): Promise<BenchmarkResult> {
  console.log(chalk.cyan(`\n📊 Benchmarking ${model.id}...`))
  
  const tasks = BENCHMARK_TASKS.slice(0, Math.min(taskCount, BENCHMARK_TASKS.length))
  const latencies: number[] = []
  let totalTokens = 0
  let totalCost = 0
  let successCount = 0
  
  const startTime = Date.now()
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    process.stdout.write(chalk.dim(`  [${i + 1}/${tasks.length}] `))
    
    try {
      const result = await callModel(model, task)
      
      if (!result.error) {
        successCount++
        latencies.push(result.latency_ms)
        totalTokens += result.input_tokens + result.output_tokens
        totalCost += result.cost_usd
        process.stdout.write(chalk.green('✓\n'))
      } else {
        process.stdout.write(chalk.red(`✗ ${result.error}\n`))
      }
    } catch (err) {
      process.stdout.write(chalk.red(`✗ ${err instanceof Error ? err.message : err}\n`))
    }
  }
  
  const totalTime = Date.now() - startTime
  
  return {
    model: model.id,
    tasks: tasks.length,
    total_time_ms: totalTime,
    avg_latency_ms: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0,
    min_latency_ms: Math.min(...latencies) || 0,
    max_latency_ms: Math.max(...latencies) || 0,
    total_tokens: totalTokens,
    tokens_per_second: (totalTokens / totalTime) * 1000,
    total_cost_usd: totalCost,
    cost_per_task_usd: totalCost / tasks.length,
    success_rate: (successCount / tasks.length) * 100,
  }
}

function printResults(results: BenchmarkResult[]): void {
  console.log(chalk.bold('\n\n📈 Benchmark Results\n'))
  
  // Sort by throughput (tokens/sec)
  results.sort((a, b) => b.tokens_per_second - a.tokens_per_second)
  
  console.log(chalk.dim('Rank  Model                    Throughput    Latency      Cost         Success'))
  console.log(chalk.dim('────  ─────────────────────  ───────────   ──────────   ──────────   ───────'))
  
  results.forEach((r, i) => {
    const rank = `${i + 1}.`.padEnd(4)
    const model = r.model.padEnd(23)
    const throughput = `${r.tokens_per_second.toFixed(0)} tok/s`.padEnd(12)
    const latency = `${r.avg_latency_ms.toFixed(0)}ms`.padEnd(11)
    const cost = r.total_cost_usd > 0 ? `$${r.cost_per_task_usd.toFixed(4)}`.padEnd(11) : 'FREE'.padEnd(11)
    const success = `${r.success_rate.toFixed(0)}%`
    
    const color = i === 0 ? chalk.green : i === 1 ? chalk.yellow : chalk.white
    
    console.log(color(`${rank}  ${model}  ${throughput}  ${latency}  ${cost}  ${success}`))
  })
  
  console.log()
  
  // Summary stats
  const fastest = results[0]
  const cheapest = results.reduce((a, b) => a.cost_per_task_usd < b.cost_per_task_usd ? a : b)
  const mostReliable = results.reduce((a, b) => a.success_rate > b.success_rate ? a : b)
  
  console.log(chalk.bold('🏆 Winners\n'))
  console.log(chalk.green(`  Fastest:       ${fastest.model} (${fastest.tokens_per_second.toFixed(0)} tok/s)`))
  console.log(chalk.green(`  Cheapest:      ${cheapest.model} ($${cheapest.cost_per_task_usd.toFixed(4)}/task)`))
  console.log(chalk.green(`  Most reliable: ${mostReliable.model} (${mostReliable.success_rate.toFixed(0)}%)`))
  console.log()
}

function saveResults(results: BenchmarkResult[]): void {
  const output = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      models_tested: results.length,
      total_tasks: results[0]?.tasks || 0,
      fastest_model: results[0]?.model,
      fastest_throughput: results[0]?.tokens_per_second,
    }
  }
  
  const path = resolve(process.cwd(), 'benchmark-results.json')
  writeFileSync(path, JSON.stringify(output, null, 2))
  console.log(chalk.dim(`📁 Saved to ${path}\n`))
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  
  // Parse args
  let modelIds: string[] | undefined
  let taskCount = 10
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--models' && args[i + 1]) {
      modelIds = args[i + 1].split(',').map(m => m.trim())
      i++
    } else if (args[i] === '--tasks' && args[i + 1]) {
      taskCount = parseInt(args[i + 1])
      i++
    }
  }
  
  // Load config
  let config: any
  try {
    const configPath = resolve(process.cwd(), 'verdict.yaml')
    const yaml = await import('js-yaml')
    config = yaml.load(readFileSync(configPath, 'utf-8'))
  } catch (err) {
    console.error(chalk.red('❌ Error: Could not load verdict.yaml'))
    console.error(chalk.dim('Run `verdict init` first'))
    process.exit(1)
  }
  
  // Select models
  const models: ModelConfig[] = modelIds
    ? config.models.filter((m: ModelConfig) => modelIds.includes(m.id))
    : config.models.slice(0, 3) // Default: first 3 models
  
  if (models.length === 0) {
    console.error(chalk.red('❌ Error: No models found'))
    process.exit(1)
  }
  
  console.log(chalk.bold('\n🏃 Verdict Performance Benchmark\n'))
  console.log(chalk.dim(`  Models: ${models.map(m => m.id).join(', ')}`))
  console.log(chalk.dim(`  Tasks:  ${taskCount} per model`))
  console.log()
  
  // Run benchmarks
  const results: BenchmarkResult[] = []
  
  for (const model of models) {
    const result = await benchmarkModel(model, taskCount)
    results.push(result)
  }
  
  // Print and save results
  printResults(results)
  saveResults(results)
}

main().catch(err => {
  console.error(chalk.red(`\n❌ Benchmark failed: ${err instanceof Error ? err.message : err}\n`))
  process.exit(1)
})
