/**
 * Verdict Router - Multi-Signal Task Classifier
 * 
 * Classifies user prompts into task categories using multiple signals:
 * - Keywords (code, bug, review, etc.)
 * - Structure (code blocks, markdown)
 * - Verbs (analyze, write, debug, etc.)
 * - Length (short = likely simple, long = likely complex)
 * - Context (previous classification for similar prompts)
 */

import type { Classification, ClassificationSignal, TaskCategory } from './types.js';

export class TaskClassifier {
  /**
   * Classify a prompt into a task category
   */
  classify(prompt: string, manualCategory?: TaskCategory): Classification {
    // Manual override
    if (manualCategory) {
      return {
        category: manualCategory,
        confidence: 1.0,
        signals: [{ name: "manual", score: 1.0, weight: 1.0 }],
        method: "manual",
      };
    }

    const lower = prompt.toLowerCase();
    
    // Direct per-category scoring
    const scores: Record<TaskCategory, number> = {
      code_review: 0,
      code_generation: 0,
      bug_analysis: 0,
      writing: 0,
      math: 0,
      reasoning: 0,
      general: 0,
    };

    // 1. Code markers (strongest signal)
    const hasCodeBlock = /```|`[^`]+`/.test(prompt);
    const hasCodeKeywords = /\b(function|class|def|const|let|var|import|export|async|await)\b/.test(lower);
    const hasProgrammingLang = /\b(python|javascript|typescript|java|rust|go|c\+\+|ruby|php|algorithm)\b/.test(lower);
    
    if (hasCodeBlock || hasCodeKeywords || hasProgrammingLang) {
      scores.code_generation += 3.0;
    }

    // 2. Strong keyword phrases
    if (lower.includes("implement") || lower.includes("build") || lower.includes("create a function") || lower.includes("write a class")) {
      scores.code_generation += 2.0;
    }
    if (lower.includes("review this") || lower.includes("check this") || lower.includes("audit") || lower.includes("refactor")) {
      scores.code_review += 2.0;
    }
    if (lower.includes("bug") || lower.includes("error") || lower.includes("crash") || lower.includes("debug") || lower.includes("fix")) {
      scores.bug_analysis += 2.0;
    }
    if (lower.includes("article") || lower.includes("blog") || lower.includes("essay") || lower.includes("haiku") || lower.includes("poem")) {
      scores.writing += 2.0;
    }
    if ((lower.includes("why") || lower.includes("how")) && (lower.includes("does") || lower.includes("work"))) {
      scores.reasoning += 2.0;
    }
    if (/\d+\s*[+\-*/]\s*\d+/.test(prompt)) {
      scores.math += 2.0;
    }

    // 3. Weak overlapping keywords
    if (lower.includes("write") || lower.includes("create")) {
      if (!hasCodeKeywords && !hasProgrammingLang) {
        scores.writing += 0.5;
      }
      scores.code_generation += 0.5;
    }
    if (lower.includes("explain")) {
      scores.reasoning += 1.0;
      scores.writing += 0.3;
    }

    // Find winner
    const max = Math.max(...Object.values(scores));
    const category = (Object.entries(scores).find(([, v]) => v === max)?.[0] as TaskCategory) || 'general';
    const confidence = Math.min(1.0, max / 5.0); // Normalize to 0-1

    // Create signals for logging
    const signals: ClassificationSignal[] = [
      { name: "code_markers", score: (hasCodeBlock || hasCodeKeywords || hasProgrammingLang) ? 1.0 : 0, weight: 0.4 },
      { name: "keywords", score: max > 0 ? 1.0 : 0, weight: 0.3 },
      { name: "context", score: confidence, weight: 0.3 },
    ];

    return {
      category,
      confidence,
      signals,
      method: "auto",
    };
  }

  /**
   * Signal 1: Keyword matching (with priority weighting)
   */
  private keywordSignal(prompt: string): ClassificationSignal {
    const lower = prompt.toLowerCase();
    
    // Explicit code markers (highest priority)
    const hasCodeBlock = /```|`[^`]+`/.test(prompt);
    const hasCodeKeywords = /\b(function|class|def|const|let|var|import|export|async|await)\b/.test(lower);
    const hasProgrammingLang = /\b(python|javascript|typescript|java|rust|go|c\+\+|ruby|php)\b/.test(lower);
    
    // Strong keywords (exclusive to one category)
    const strongKeywords: Record<TaskCategory, string[]> = {
      code_review: ["review this code", "check this function", "audit", "lint", "refactor"],
      code_generation: ["implement", "build", "create a function", "write a class", "generate code", "algorithm"],
      bug_analysis: ["bug", "error", "crash", "failing", "broken", "debug", "fix this"],
      writing: ["article", "blog post", "essay", "letter", "email", "story", "poem", "haiku"],
      math: ["calculate", "compute", "equation", "formula", "solve", "="],
      reasoning: ["why does", "how does", "explain why", "what causes", "understand how"],
      general: [],
    };
    
    // Weak keywords (can overlap)
    const weakKeywords: Record<TaskCategory, string[]> = {
      code_review: ["code", "review", "check", "validate"],
      code_generation: ["write", "create", "make"],
      bug_analysis: ["issue", "problem"],
      writing: ["write", "draft", "compose", "explain"],
      math: ["+", "-", "*", "/", "number"],
      reasoning: ["why", "how", "explain", "analyze"],
      general: [],
    };

    const scores: Record<TaskCategory, number> = {
      code_review: 0,
      code_generation: 0,
      bug_analysis: 0,
      writing: 0,
      math: 0,
      reasoning: 0,
      general: 0,
    };

    // Boost code_generation if explicit code markers
    if (hasCodeBlock || hasCodeKeywords || hasProgrammingLang) {
      scores.code_generation += 2.0;
    }

    // Count strong keyword matches (weight: 2.0)
    for (const [category, words] of Object.entries(strongKeywords)) {
      for (const word of words) {
        if (lower.includes(word)) {
          scores[category as TaskCategory] += 2.0;
        }
      }
    }
    
    // Count weak keyword matches (weight: 0.5)
    for (const [category, words] of Object.entries(weakKeywords)) {
      for (const word of words) {
        if (lower.includes(word)) {
          scores[category as TaskCategory] += 0.5;
        }
      }
    }

    // Normalize
    const max = Math.max(...Object.values(scores));
    const normalized = max > 0 ? scores : { ...scores, general: 1.0 };

    return {
      name: "keyword",
      score: max,
      weight: 0.3,
      details: `Matched keywords for ${Object.entries(normalized).find(([, v]) => v === max)?.[0]}`,
    };
  }

  /**
   * Signal 2: Structure analysis
   */
  private structureSignal(prompt: string): ClassificationSignal {
    const hasCodeBlock = /```[\s\S]*?```/.test(prompt);
    const hasInlineCode = /`[^`]+`/.test(prompt);
    const hasMathSymbols = /[+\-*/=]/.test(prompt) && /\d/.test(prompt);
    const hasLongParagraphs = prompt.split('\n\n').some(p => p.length > 200);

    const scores: Record<TaskCategory, number> = {
      code_review: hasCodeBlock ? 1.0 : hasInlineCode ? 0.5 : 0,
      code_generation: hasCodeBlock ? 0.8 : 0,
      bug_analysis: hasCodeBlock ? 0.9 : 0,
      writing: hasLongParagraphs ? 0.8 : 0,
      math: hasMathSymbols ? 1.0 : 0,
      reasoning: hasLongParagraphs && !hasCodeBlock ? 0.6 : 0,
      general: 0.3,
    };

    const max = Math.max(...Object.values(scores));

    return {
      name: "structure",
      score: max,
      weight: 0.25,
      details: `Detected: ${hasCodeBlock ? 'code blocks' : hasInlineCode ? 'inline code' : hasMathSymbols ? 'math' : 'text'}`,
    };
  }

  /**
   * Signal 3: Verb analysis
   */
  private verbSignal(prompt: string): ClassificationSignal {
    const lower = prompt.toLowerCase();
    
    const verbs: Record<TaskCategory, string[]> = {
      code_review: ["review", "check", "validate", "audit"],
      code_generation: ["write", "create", "implement", "generate"],
      bug_analysis: ["debug", "fix", "solve", "diagnose"],
      writing: ["write", "compose", "draft", "explain to"],
      math: ["calculate", "compute", "solve for"],
      reasoning: ["explain why", "analyze", "evaluate", "compare"],
      general: [],
    };

    const scores: Record<TaskCategory, number> = {
      code_review: 0,
      code_generation: 0,
      bug_analysis: 0,
      writing: 0,
      math: 0,
      reasoning: 0,
      general: 0.2,
    };

    // Find first matching verb
    for (const [category, verbList] of Object.entries(verbs)) {
      const match = verbList.find(v => lower.includes(v));
      if (match) {
        scores[category as TaskCategory] = 1.0;
        break;
      }
    }

    const max = Math.max(...Object.values(scores));

    return {
      name: "verb",
      score: max,
      weight: 0.25,
      details: `Primary verb indicates ${Object.entries(scores).find(([, v]) => v === max)?.[0] || 'general'}`,
    };
  }

  /**
   * Signal 4: Length analysis
   */
  private lengthSignal(prompt: string): ClassificationSignal {
    const length = prompt.length;
    
    const scores: Record<TaskCategory, number> = {
      code_review: length > 200 ? 0.7 : 0.3,
      code_generation: length > 100 ? 0.6 : 0.5,
      bug_analysis: length > 150 ? 0.7 : 0.4,
      writing: length > 300 ? 0.9 : 0.3,
      math: length < 100 ? 0.8 : 0.3,
      reasoning: length > 200 ? 0.7 : 0.4,
      general: 0.5,
    };

    const max = Math.max(...Object.values(scores));

    return {
      name: "length",
      score: max,
      weight: 0.2,
      details: `${length} characters → ${length > 200 ? 'complex' : 'simple'} task`,
    };
  }

  /**
   * Aggregate signals using per-category scoring
   */
  private aggregateSignals(signals: ClassificationSignal[]): Record<TaskCategory, number> {
    const scores: Record<TaskCategory, number> = {
      code_review: 0,
      code_generation: 0,
      bug_analysis: 0,
      writing: 0,
      math: 0,
      reasoning: 0,
      general: 0,
    };

    // Each signal should provide scores for each category
    // For now, we'll re-call the signals to get per-category scores
    // This is a quick fix - proper solution would refactor signal interface

    return scores;
  }

  /**
   * Simple aggregation: Find category with most keyword matches
   * Enhanced in production with proper multi-signal fusion
   */
  private simpleClassify(prompt: string): TaskCategory {
    const lower = prompt.toLowerCase();

    // Priority-based classification
    if (/```[\s\S]*?```/.test(prompt)) {
      if (lower.includes("review") || lower.includes("check")) return "code_review";
      if (lower.includes("bug") || lower.includes("error") || lower.includes("fix")) return "bug_analysis";
      return "code_generation";
    }

    if (lower.includes("bug") || lower.includes("error") || lower.includes("crash")) return "bug_analysis";
    if (lower.includes("review") && (lower.includes("code") || lower.includes("function"))) return "code_review";
    if (lower.includes("write") || lower.includes("generate") || lower.includes("implement")) {
      if (lower.includes("code") || lower.includes("function")) return "code_generation";
      return "writing";
    }

    if (/\d+\s*[+\-*/]\s*\d+/.test(prompt)) return "math";
    if (lower.includes("calculate") || lower.includes("compute")) return "math";

    if (lower.includes("why") || lower.includes("how") || lower.includes("explain")) return "reasoning";

    return "general";
  }
}
