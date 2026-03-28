/**
 * Verdict Infer Command
 * 
 * Smart model routing: `verdict infer "prompt"`
 */

import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { VerdictRouter } from '../../router/index.js';
import type { TaskCategory } from '../../router/types.js';
import { loadConfig } from '../../core/config.js';

interface InferOptions {
  config: string;
  category?: TaskCategory;
  maxLatency?: number;
  minQuality?: number;
  preferLocal?: boolean;
  model?: string; // Override selection
  explain?: boolean;
  dryRun?: boolean;
}

export async function inferCommand(prompt: string, opts: InferOptions): Promise<void> {
  console.log();
  console.log(chalk.bold('  verdict') + chalk.dim(' infer'));
  console.log();

  // Load config
  let config;
  try {
    config = loadConfig(opts.config);
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  }

  // Initialize router
  const dbPath = path.join(os.homedir(), '.verdict', 'router.db');
  const router = new VerdictRouter(dbPath);

  // Route the task
  const spinner = ora({ prefixText: '  ', text: 'Analyzing task...' }).start();
  
  let classification, choice, runId;
  try {
    const result = await router.route(prompt, {
      category: opts.category,
      maxLatency: opts.maxLatency,
      minQuality: opts.minQuality,
      preferLocal: opts.preferLocal,
    });
    
    classification = result.classification;
    choice = result.choice;
    runId = result.runId;
    
    spinner.succeed('Task analyzed');
  } catch (err) {
    spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
    router.close();
    process.exit(1);
  }

  // Display selection
  console.log();
  console.log(`  ${chalk.bold('Category:')} ${chalk.cyan(classification.category)} ${chalk.dim(`(${(classification.confidence * 100).toFixed(0)}% confidence)`)}`);
  
  if (opts.model) {
    console.log(`  ${chalk.bold('Model:   ')} ${chalk.yellow(opts.model)} ${chalk.dim('(manual override)')}`);
  } else {
    console.log(`  ${chalk.bold('Model:   ')} ${chalk.cyan(choice.model)}`);
  }

  if (opts.explain || choice.isExploration) {
    console.log(`  ${chalk.bold('Reason:  ')} ${chalk.dim(choice.reason)}`);
    console.log(`  ${chalk.bold('Expected:')} ${chalk.dim(`${choice.expectedScore.toFixed(1)}/10, ~${choice.expectedLatency}ms`)}`);
  }

  if (choice.isExploration) {
    console.log();
    console.log(chalk.yellow('  🔬 Exploration mode: Trying alternative to improve future routing'));
  }

  console.log();

  // Dry run?
  if (opts.dryRun) {
    console.log(chalk.yellow('  --dry-run: no inference run'));
    console.log();
    router.close();
    return;
  }

  // Run inference
  const modelToUse = opts.model || choice.model;
  const modelConfig = config.models.find(m => m.id === modelToUse);
  
  if (!modelConfig) {
    console.error(chalk.red(`  Model not found: ${modelToUse}`));
    console.error(chalk.dim(`  Available models: ${config.models.map(m => m.id).join(', ')}`));
    router.close();
    process.exit(1);
  }

  // Run inference
  const runSpinner = ora({ prefixText: '  ', text: `Running ${modelToUse}...` }).start();
  
  const startTime = Date.now();
  let output: string | undefined;
  let latency: number | undefined;
  let status: "success" | "error" = "success";
  let errorMessage: string | undefined;
  
  try {
    const { callModel } = await import('../../providers/compat.js');
    const response = await callModel(modelConfig, prompt);
    output = response.text;
    latency = response.latency_ms;
    runSpinner.succeed(`Complete (${latency}ms)`);
  } catch (err) {
    latency = Date.now() - startTime;
    status = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
    runSpinner.fail(chalk.red(`Failed: ${errorMessage}`));
  }

  // Display output
  if (output && typeof output === 'string') {
    console.log();
    console.log(chalk.dim('  ─'.repeat(40)));
    console.log();
    console.log('  ' + output.split('\n').join('\n  '));
    console.log();
    console.log(chalk.dim('  ─'.repeat(40)));
    console.log();
  }

  // Collect feedback
  console.log();
  const readline = (await import('readline')).createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  readline.question(chalk.dim('  Was this helpful? (y/n/[model name] to override): '), (answer: string) => {
    const trimmed = answer.trim().toLowerCase();
    
    let feedback: any = {};
    
    if (trimmed === 'y') {
      feedback.wasHelpful = true;
      feedback.rating = 8; // Assume good
    } else if (trimmed === 'n') {
      feedback.wasHelpful = false;
      feedback.rating = 3; // Assume poor
    } else if (trimmed.length > 0) {
      // User specified different model
      feedback.correctedModel = trimmed;
      feedback.wasHelpful = false;
      console.log(chalk.yellow(`  ✓ Noted: You prefer ${trimmed} for this type of task`));
    }

    // Record completion
    router.recordCompletion(
      runId,
      prompt,
      classification,
      choice,
      { output, latency, status, errorMessage },
      feedback
    );

    router.close();
    readline.close();
    
    console.log(chalk.dim('  Feedback recorded. Verdict learns from your choices!'));
    console.log();
  });
}
