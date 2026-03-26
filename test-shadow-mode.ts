#!/usr/bin/env tsx

/**
 * Test Shadow Mode Integration
 * 
 * Verifies DSPy router works alongside heuristic router
 */

import { VerdictRouter } from './src/router/index.js';
import { join } from 'path';

async function testShadowMode() {
  console.log('🧪 Testing Shadow Mode Integration\n');

  // DSPy router config
  const dspyConfig = {
    pythonPath: 'python3',
    scriptPath: join(process.cwd(), '..', 'verdict-dspy', 'src', 'router_bridge.py'),
    timeout: 10000,
  };

  // Initialize router with shadow mode
  const router = new VerdictRouter(
    ':memory:', // In-memory SQLite for testing
    undefined,  // Use default config
    dspyConfig  // Enable shadow mode
  );

  // Test tasks
  const tasks = [
    'Analyze this code for potential bugs',
    'Write a function to sort an array',
    'Explain quantum computing in simple terms',
    'What tools do I need to debug a memory leak?',
    'Solve this math equation: 2x + 5 = 15',
  ];

  console.log(`📋 Running ${tasks.length} test tasks...\n`);

  for (const [i, task] of tasks.entries()) {
    console.log(`\n[${i + 1}/${tasks.length}] "${task.substring(0, 50)}..."`);
    
    const start = Date.now();
    const result = await router.route(task);
    const duration = Date.now() - start;

    console.log(`  ⏱️  ${duration}ms`);
    console.log(`  🎯 Heuristic: ${result.classification.category} → ${result.choice.model}`);
    
    if (result.shadow?.dspy) {
      const dspy = result.shadow.dspy;
      console.log(`  🤖 DSPy: ${dspy.category} → ${dspy.model}`);
      
      const agreement = (
        result.classification.category === dspy.category &&
        result.choice.model === dspy.model
      );
      
      console.log(`  ${agreement ? '✅ AGREE' : '❌ DISAGREE'}`);
    } else {
      console.log(`  ⚠️  DSPy router failed`);
    }
  }

  // Get summary statistics
  console.log('\n\n📊 Shadow Mode Statistics:\n');
  const stats = router.getShadowStats();
  
  if (stats) {
    console.log(`  Total decisions: ${stats.total_decisions}`);
    console.log(`  DSPy successful: ${stats.dspy_successful}/${stats.total_decisions}`);
    console.log(`  DSPy failure rate: ${stats.dspy_failure_rate}`);
    console.log(`  Agreement rate: ${stats.agreement_rate}`);
    console.log(`  Disagreements: ${stats.disagreements}`);
    
    if (stats.disagreements > 0) {
      console.log(`\n  Disagreement breakdown:`);
      console.log(`    Category: ${stats.disagreement_breakdown.category}`);
      console.log(`    Complexity: ${stats.disagreement_breakdown.complexity}`);
      console.log(`    Model: ${stats.disagreement_breakdown.model}`);
      console.log(`    All: ${stats.disagreement_breakdown.all}`);
    }
  }

  // Flush logs
  console.log('\n💾 Flushing shadow logs...');
  await router.flushShadowLogs();
  console.log('  ✅ Logs written to .verdict-shadow-logs.jsonl');

  router.close();
  console.log('\n✨ Test complete!');
}

testShadowMode().catch(console.error);
