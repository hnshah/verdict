#!/usr/bin/env node
/**
 * Multi-Judge Agreement Analyzer
 * 
 * Compares results from same eval run with different judges.
 * Calculates inter-judge agreement and identifies outliers.
 */

const fs = require('fs');
const path = require('path');

function calculateKendallTau(rankings1, rankings2) {
  // Simplified Kendall's Tau calculation
  let concordant = 0;
  let discordant = 0;
  
  const n = rankings1.length;
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sign1 = Math.sign(rankings1[i] - rankings1[j]);
      const sign2 = Math.sign(rankings2[i] - rankings2[j]);
      
      if (sign1 === sign2) concordant++;
      else if (sign1 !== 0 && sign2 !== 0) discordant++;
    }
  }
  
  return (concordant - discordant) / (concordant + discordant);
}

function analyzeJudgeResults(judgeResults) {
  const judges = Object.keys(judgeResults);
  const models = Object.keys(judgeResults[judges[0]].summary);
  
  console.log('🔍 Multi-Judge Agreement Analysis\n');
  console.log(`Judges tested: ${judges.length}`);
  console.log(`Models compared: ${models.join(', ')}\n`);
  
  // Extract rankings from each judge
  const rankings = {};
  judges.forEach(judge => {
    rankings[judge] = models.map(model => 
      judgeResults[judge].summary[model].avg_total
    );
  });
  
  // Calculate pairwise agreement
  console.log('='.repeat(60));
  console.log('\nINTER-JUDGE AGREEMENT (Kendall\'s Tau):\n');
  
  const agreements = [];
  for (let i = 0; i < judges.length; i++) {
    for (let j = i + 1; j < judges.length; j++) {
      const tau = calculateKendallTau(
        rankings[judges[i]],
        rankings[judges[j]]
      );
      
      agreements.push({
        judge1: judges[i],
        judge2: judges[j],
        tau: tau
      });
      
      const status = tau > 0.8 ? '✅' : tau > 0.5 ? '⚠️' : '❌';
      console.log(`  ${status} ${judges[i]} vs ${judges[j]}: τ = ${tau.toFixed(3)}`);
    }
  }
  
  const avgAgreement = agreements.reduce((sum, a) => sum + a.tau, 0) / agreements.length;
  console.log(`\nAverage Agreement: τ = ${avgAgreement.toFixed(3)}`);
  
  if (avgAgreement > 0.8) {
    console.log('  ✅ High agreement - judges are consistent\n');
  } else if (avgAgreement > 0.5) {
    console.log('  ⚠️  Moderate agreement - some disagreement\n');
  } else {
    console.log('  ❌ Low agreement - judges are inconsistent!\n');
  }
  
  // Model rankings by judge
  console.log('='.repeat(60));
  console.log('\nMODEL RANKINGS BY JUDGE:\n');
  
  judges.forEach(judge => {
    const sorted = models.map(model => ({
      model,
      score: judgeResults[judge].summary[model].avg_total
    })).sort((a, b) => b.score - a.score);
    
    console.log(`${judge}:`);
    sorted.forEach((m, i) => {
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '  ';
      console.log(`  ${medal} ${rank}. ${m.model}: ${m.score.toFixed(2)}/10`);
    });
    console.log('');
  });
  
  // Identify outlier judges
  console.log('='.repeat(60));
  console.log('\nOUTLIER DETECTION:\n');
  
  const judgeAgreementScores = judges.map(judge => {
    const otherJudges = judges.filter(j => j !== judge);
    const scores = otherJudges.map(other => {
      const agreement = agreements.find(a => 
        (a.judge1 === judge && a.judge2 === other) ||
        (a.judge2 === judge && a.judge1 === other)
      );
      return agreement ? agreement.tau : 0;
    });
    
    return {
      judge,
      avgAgreement: scores.reduce((sum, s) => sum + s, 0) / scores.length
    };
  }).sort((a, b) => b.avgAgreement - a.avgAgreement);
  
  console.log('Judge Reliability (based on agreement with others):\n');
  judgeAgreementScores.forEach((j, i) => {
    const status = j.avgAgreement > 0.8 ? '✅ Reliable' : 
                   j.avgAgreement > 0.5 ? '⚠️  Questionable' : 
                   '❌ Unreliable';
    console.log(`  ${i + 1}. ${j.judge}: ${j.avgAgreement.toFixed(3)} - ${status}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('\nRECOMMENDATIONS:\n');
  
  const mostReliable = judgeAgreementScores[0];
  const leastReliable = judgeAgreementScores[judgeAgreementScores.length - 1];
  
  if (mostReliable.avgAgreement > 0.8) {
    console.log(`  ✅ Use ${mostReliable.judge} as primary judge (τ = ${mostReliable.avgAgreement.toFixed(3)})`);
  }
  
  if (leastReliable.avgAgreement < 0.5) {
    console.log(`  ❌ Avoid ${leastReliable.judge} as judge (τ = ${leastReliable.avgAgreement.toFixed(3)})`);
  }
  
  if (avgAgreement < 0.6) {
    console.log('  ⚠️  Low overall agreement - consider revising criteria/prompts');
  }
  
  console.log('\n');
}

// Example usage (would load actual result files)
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node analyze-multi-judge.js <result1.json> <result2.json> ...');
    console.log('\nExample with mock data:\n');
    
    // Mock data for demonstration
    const mockResults = {
      'phi4': {
        summary: {
          'llava-13b': { avg_total: 8.0 },
          'phi4': { avg_total: 8.5 }
        }
      },
      'qwen2.5:7b': {
        summary: {
          'llava-13b': { avg_total: 9.2 },
          'phi4': { avg_total: 4.1 }
        }
      },
      'qwen3-coder': {
        summary: {
          'llava-13b': { avg_total: 9.5 },
          'phi4': { avg_total: 3.8 }
        }
      },
      'deepseek-r1': {
        summary: {
          'llava-13b': { avg_total: 9.0 },
          'phi4': { avg_total: 4.5 }
        }
      }
    };
    
    analyzeJudgeResults(mockResults);
    return;
  }
  
  // Load actual result files
  const judgeResults = {};
  args.forEach(filePath => {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const judgeName = path.basename(filePath, '.json');
    judgeResults[judgeName] = data;
  });
  
  analyzeJudgeResults(judgeResults);
}

main();
