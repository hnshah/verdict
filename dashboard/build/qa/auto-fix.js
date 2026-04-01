#!/usr/bin/env node
/**
 * Auto-Fix Generator
 * 
 * Detects issues and generates fixes automatically:
 * - Adds warning banners to broken runs
 * - Updates timestamps to Pacific Time
 * - Fixes broken links
 * - Suggests judge replacements
 */

const fs = require('fs');
const path = require('path');

let fixes = [];

function generateFixes(issues) {
  fixes = [];
  
  issues.forEach(issue => {
    switch(issue.type) {
      case 'broken-vision-scoring':
        fixes.push({
          type: 'add-warning-banner',
          file: `runs/${issue.runId}/index.html`,
          runId: issue.runId,
          action: 'inject',
          location: 'after-main-wrapper-open',
          content: generateWarningBanner(issue)
        });
        break;
        
      case 'missing-timestamp':
        fixes.push({
          type: 'add-footer-timestamp',
          file: issue.file,
          action: 'append-before-body-close',
          content: generateFooter()
        });
        break;
        
      case 'broken-link':
        fixes.push({
          type: 'fix-link',
          file: issue.file,
          action: 'replace',
          old: issue.brokenLink,
          new: suggestLinkFix(issue.brokenLink)
        });
        break;
        
      case 'biased-judge':
        fixes.push({
          type: 'flag-judge',
          judge: issue.judge,
          action: 'document',
          recommendation: `Replace ${issue.judge} with ${issue.suggestedJudge}`
        });
        break;
    }
  });
  
  return fixes;
}

function generateWarningBanner(issue) {
  return `
  <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
    <div class="flex">
      <div class="flex-shrink-0">
        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-red-800">⚠️ ${issue.title}</h3>
        <div class="mt-2 text-sm text-red-700">
          <p>${issue.message}</p>
        </div>
      </div>
    </div>
  </div>`;
}

function generateFooter() {
  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short'
  }) + ' PT';
  
  return `
<footer class="text-center text-xs text-gray-400 mt-12 pb-6">
  Last updated: ${now}
</footer>`;
}

function suggestLinkFix(brokenLink) {
  // Common fixes
  if (brokenLink.includes('huggingface.co')) {
    const model = brokenLink.split('/').pop();
    return `https://ollama.com/library/${model}`;
  }
  
  // Try adding index.html
  if (!brokenLink.endsWith('.html') && !brokenLink.endsWith('/')) {
    return `${brokenLink}/index.html`;
  }
  
  return brokenLink; // No automatic fix available
}

function applyFixes(fixes, dryRun = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(dryRun ? '\nDRY RUN - Changes Preview:\n' : '\nApplying Fixes:\n');
  
  fixes.forEach((fix, i) => {
    console.log(`${i + 1}. ${fix.type}`);
    console.log(`   File: ${fix.file}`);
    console.log(`   Action: ${fix.action}`);
    
    if (fix.recommendation) {
      console.log(`   📝 ${fix.recommendation}`);
    }
    
    if (!dryRun) {
      try {
        // Actually apply the fix
        applyFix(fix);
        console.log(`   ✅ Applied`);
      } catch (e) {
        console.log(`   ❌ Failed: ${e.message}`);
      }
    } else {
      console.log(`   💡 Would apply this fix`);
    }
    
    console.log('');
  });
  
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Total fixes: ${fixes.length}`);
  console.log(dryRun ? '\nRun with --apply to execute fixes\n' : '\n');
}

function applyFix(fix) {
  // Implementation would go here
  // For now, just logging
  throw new Error('Not implemented - use manual review');
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  
  console.log('🔧 Auto-Fix Generator\n');
  
  // Example issues (in real usage, these come from QA tools)
  const exampleIssues = [
    {
      type: 'broken-vision-scoring',
      runId: '2026-04-01-2026-04-01T03-19-27',
      title: 'Invalid Scoring - Do Not Use',
      message: 'Text-only model (phi4) scored higher than vision model (llava-13b) in vision benchmark.'
    },
    {
      type: 'biased-judge',
      judge: 'phi4',
      suggestedJudge: 'qwen2.5:7b',
      message: 'phi4 judge rewards helpfulness over correctness (58.3% non-answer reward rate)'
    },
    {
      type: 'missing-timestamp',
      file: 'runs/test-run/index.html'
    }
  ];
  
  const generatedFixes = generateFixes(exampleIssues);
  applyFixes(generatedFixes, dryRun);
}

main();
