# My Evals

**Run:** 2026-03-31T14-02-35
**Date:** 2026-03-31 14:04:50 UTC
**Cases:** 10 | **Models:** phi4, qwen-coder, qwen3-coder

## Leaderboard

| Rank | Model | Score | Accuracy | Complete | Concise | Latency | Cost | Win% |
|------|-------|-------|----------|----------|---------|---------|------|------|
| 1 | qwen3-coder | **9.56** | 9.9 | 9.6 | 8.8 | 6.2s | free | 30% |
| 2 | phi4 | **9.28** | 9.9 | 9.2 | 8.2 | 5.6s | free | 20% |
| 3 | qwen-coder | **9.24** | 9.6 | 9 | 9 | 4.7s | free | 50% |

## Cases

### gen-001

> What is the capital of France?

| Model | Score | Reasoning |
|-------|-------|-----------|
| phi4 | 8.4 | The response correctly identifies Paris as the capital of France and provides additional relevant information, but it includes more detail than necessary for a simple factual question. |
| qwen3-coder | 10 | The response correctly identifies Paris as the capital of France, fully addressing the question with no unnecessary information. |
| qwen-coder | 10 | The response correctly identifies Paris as the capital of France, fully addressing the question with no unnecessary information. |

### gen-002

> What does RAM stand for and what does it do?

| Model | Score | Reasoning |
|-------|-------|-----------|
| qwen-coder | 9.2 | The response accurately defines RAM and its function, addressing most criteria but slightly lacking in explicitly mentioning 'volatile storage'. |
| phi4 | 9.2 | The response accurately describes RAM's function, characteristics, and importance while covering most criteria but could be slightly more concise. |
| qwen3-coder | 9.2 | The response accurately describes RAM's function and characteristics, covering most key aspects but could be slightly more concise. |

### gen-003

> Explain the difference between a process and a thread in one paragraph.

| Model | Score | Reasoning |
|-------|-------|-----------|
| qwen-coder | 6.4 | The response correctly identifies basic differences but lacks detail on memory space, overhead, and specific use cases. |
| phi4 | 9.2 | The response accurately describes the differences in memory space, overhead, and use cases between processes and threads. |
| qwen3-coder | 9.2 | The response accurately describes the differences in memory space, resource sharing, and fault isolation between processes and threads while covering all evaluation criteria. |

### gen-004

> If all mammals are warm-blooded, and dolphins are mammals, what can we conclude about dolphins?

| Model | Score | Reasoning |
|-------|-------|-----------|
| qwen-coder | 9.8 | The response correctly applies deductive reasoning to conclude that dolphins are warm-blooded based on the premises provided. |
| phi4 | 9.8 | The response correctly applies deductive reasoning to conclude that dolphins are warm-blooded based on the given premises. |
| qwen3-coder | 9.8 | The response correctly applies deductive reasoning to conclude that dolphins are warm-blooded based on the premises provided. |

### gen-005

> List exactly 3 benefits of regular exercise. Numbered list. Max 12 words per item.

| Model | Score | Reasoning |
|-------|-------|-----------|
| qwen-coder | 10 | The response accurately lists three benefits of regular exercise, each under 12 words. |
| phi4 | 10 | The response accurately lists three benefits of regular exercise, each under 12 words. |
| qwen3-coder | 10 | The response accurately lists three benefits of regular exercise, each under 12 words. |

### gen-006

> Write a JavaScript function that returns the sum of all even numbers in an array.

| Model | Score | Reasoning |
|-------|-------|-----------|
| qwen-coder | 9.2 | The function correctly calculates the sum of even numbers, handles empty arrays by returning 0, and is concise but could be slightly more efficient using array methods. |
| phi4 | 9.2 | The response provides a correct and complete JavaScript function that meets all specified criteria, with clear explanation but slightly more detail than necessary. |
| qwen3-coder | 9.8 | The response provides correct implementations that meet all evaluation criteria, with a slight excess in providing multiple solutions. |

### gen-007

> What is the time complexity of binary search and why?

| Model | Score | Reasoning |
|-------|-------|-----------|
| qwen-coder | 9.8 | The response accurately explains the time complexity of binary search and why it is O(log n) by detailing how the search space is halved each iteration. |
| phi4 | 9.2 | The response accurately explains the time complexity of binary search and its halving mechanism, but could briefly mention that it assumes random access data structures. |
| qwen3-coder | 9.2 | The response accurately explains the time complexity of binary search and provides a clear, detailed explanation of why it is O(log n) by describing how the search space is halved each iteration. |

### gen-008

> Explain what a transformer model is in 2-3 sentences for a software engineer who knows ML basics.

| Model | Score | Reasoning |
|-------|-------|-----------|
| phi4 | 8.2 | The response accurately describes the transformer model's architecture and its reliance on self-attention mechanisms, but it could briefly mention why transformers improved NLP by highlighting their ability to handle long-range dependencies more effectively than RNNs. |
| qwen-coder | 8.8 | The response accurately describes the transformer model's use of self-attention and parallel processing, explaining its advantages over RNNs in NLP tasks. |
| qwen3-coder | 9.2 | The response accurately describes the transformer model's architecture, attention mechanism, and advantages over RNNs, but could briefly mention its impact on NLP improvements. |

### gen-009

> Write a haiku about debugging code.

| Model | Score | Reasoning |
|-------|-------|-----------|
| qwen-coder | 10 | The haiku follows the 5-7-5 syllable structure, references debugging and code, and conveys a coherent meaning. |
| phi4 | 9.8 | The haiku adheres to the 5-7-5 syllable structure, references debugging through 'errors' and 'tangled lines', and conveys a coherent meaning about achieving clarity. |
| qwen3-coder | 10 | The haiku follows the 5-7-5 syllable structure, references debugging through 'tangled thoughts untangle,' and conveys a coherent meaning about finding clarity in code. |

### gen-010

> What is the CAP theorem and what does it mean for distributed systems design?

| Model | Score | Reasoning |
|-------|-------|-----------|
| qwen-coder | 9.2 | The response accurately explains the CAP theorem and its implications for distributed systems, covering all key aspects with relevant examples. |
| qwen3-coder | 9.2 | The response accurately explains the CAP theorem, covers all necessary aspects including trade-offs and real-world implications, but could be slightly more concise. |
| phi4 | 9.8 | The response accurately explains the CAP theorem, its implications for distributed systems design, and covers all evaluation criteria effectively with minimal padding. |

---

## Analysis

### Key Findings

**1. Size ≠ Quality**
- 30B model (qwen3-coder) only marginally better than 14B models
- qwen-coder (14B) fastest and won most cases despite lowest score

**2. Speed vs Quality Trade-off**
- qwen-coder: 4.7s avg (fastest) - 50% wins
- phi4: 5.6s avg (middle) - 20% wins  
- qwen3-coder: 6.2s avg (slowest) - 30% wins

**3. Judge Bias**
- phi4 judge favors completeness/accuracy over conciseness
- Most wins ≠ highest score
- qwen-coder's concise answers score lower but win more

**4. Specialization Matters**
- All three are "coder" models, scores very close (9.24-9.56)
- Small differences in approach (verbose vs concise)
- Task type didn't differentiate (all general knowledge questions)

### Recommendations

**For Speed:** qwen-coder (14B)
- Fastest (4.7s)
- Most wins (50%)
- Half the size of qwen3-coder

**For Quality:** qwen3-coder (30B)
- Highest score (9.56)
- Most complete responses
- But: 32% slower, 2× the size

**For Balance:** phi4 (14B)
- Good all-around (9.28)
- Moderate speed (5.6s)
- Same size as qwen-coder

### Next Steps

**Run on actual code tasks:**
- This eval used general knowledge questions
- Need code generation, debugging, refactoring tasks
- Would show true coder model differences

**Test with different judge:**
- Current judge (phi4) may bias results
- Try qwen3-coder as judge
- Compare score differences

**Add more models:**
- deepseek-r1 (reasoning specialist)
- llama3.3:70b (larger generalist)
- Compare specialists vs generalists

---

**Generated:** 2026-03-31 07:12 PT  
**Models Tested:** phi4:14b, qwen2.5-coder:14b, qwen3-coder:30b  
**Cases:** 10 from general.yaml  
**Judge:** phi4:14b  
**Config:** verdict-fixed.yaml
