# Social Media Post — Model Comparison Results

## Twitter Thread (7 tweets)

**Tweet 1/7 (Hook):**
I benchmarked 3 local coding models on my Mac Studio.

The winner surprised me: the 14B model beat the 30B.

Here's what I learned 🧵

**Tweet 2/7 (The Setup):**
Tested:
• qwen2.5-coder:14b
• phi4:14b  
• qwen3-coder:30b

10 test cases. 2 runs. All local. $0 cost.

Hardware: Mac Studio M2 Ultra

Tool: verdict CLI (github.com/hnshah/verdict)

**Tweet 3/7 (The Paradox):**
Here's the paradox:

qwen-coder (14B):
• Lowest score (9.24/10)
• Won 60% of head-to-head matchups
• Fastest (4.1s avg)

qwen3-coder (30B):
• Highest score (9.56/10)
• Won only 20% of matchups
• Slowest (6.2s — 51% slower)

Most wins ≠ highest score.

**Tweet 4/7 (Why This Happens):**
The judge (phi4) favors completeness over conciseness.

qwen-coder gives concise, correct answers → wins matchups
qwen3-coder gives verbose, thorough answers → scores higher

Lesson: Scoring methodology matters. Different judges = different rankings.

**Tweet 5/7 (Speed Matters):**
For interactive coding, latency adds up:

qwen-coder: 4.1s
phi4: 5.6s  
qwen3-coder: 6.2s

2 extra seconds per response = 20 seconds over 10 responses.

When you're in flow, speed matters.

**Tweet 6/7 (The Insight):**
Size isn't everything.

A well-trained 14B model:
✅ Beats 30B in real-world matchups
✅ Runs 32% faster
✅ Uses half the VRAM
✅ Good enough quality (9.24/10)

You don't always need the biggest model.

**Tweet 7/7 (Recommendation + CTA):**
My recommendation for local coding:

🥇 qwen2.5-coder:14b — fast, wins most, half the size
🥈 phi4:14b — balanced
🥉 qwen3-coder:30b — highest quality when speed doesn't matter

Full results + reproducible config:
github.com/hnshah/verdict

Try it yourself! 🚀

---

## LinkedIn Post (Long-Form)

**Title:** I Benchmarked 3 Local Coding Models — The 14B Model Won

**Body:**

I spent yesterday benchmarking local coding models on my Mac Studio.

The winner? qwen2.5-coder:14b — a 14B parameter model that beat the 30B version in real-world tasks.

Here's what I learned about model selection, evaluation methodology, and why size isn't everything.

**The Setup**

I tested three models:
• qwen2.5-coder:14b
• phi4:14b
• qwen3-coder:30b

All running locally on a Mac Studio (M2 Ultra). No API calls. No rate limits. Zero cost.

I used verdict CLI (a tool I've been contributing to) to run 10 test cases covering factual knowledge, technical concepts, code generation, and creative tasks.

**The Paradox**

The results surprised me:

qwen-coder (14B):
✗ Lowest overall score (9.24/10)
✓ Won 60% of head-to-head matchups
✓ Fastest response time (4.1s avg)

qwen3-coder (30B):
✓ Highest overall score (9.56/10)
✗ Won only 20% of matchups
✗ Slowest (6.2s — 51% slower than 14B)

How can the model with the lowest score win the most matchups?

**The Answer: Judge Bias**

The judge model (phi4) favored completeness and thoroughness over conciseness.

qwen-coder gave concise, correct answers → won head-to-head
qwen3-coder gave verbose, comprehensive answers → scored higher overall

This taught me something important: evaluation methodology matters just as much as model capability.

Different judges would produce different rankings.

**Why This Matters for AI Tool Builders**

If you're building AI coding tools, you need to understand:

1. **Bigger ≠ Better for Real-World Tasks**  
   The 14B model won 60% of matchups despite being half the size of the 30B.

2. **Speed Compounds**  
   2 extra seconds per response = 20 seconds over 10 responses. When you're in flow, that matters.

3. **Test With Your Judge**  
   If your product uses a specific model to evaluate outputs, benchmark against that — not against generic scores.

4. **Local Models Are Production-Ready**  
   All three models scored 9.2+/10. You don't need GPT-4 or Claude for coding tasks anymore.

**My Recommendation**

For local coding:

🥇 **qwen2.5-coder:14b** — Fast, wins most matchups, half the VRAM  
🥈 **phi4:14b** — Balanced quality and speed  
🥉 **qwen3-coder:30b** — Use when quality matters more than speed

**The Bigger Lesson**

This isn't just about model selection. It's about understanding:

• How evaluation shapes perception of quality
• Why synthetic benchmarks don't always predict real-world performance
• The importance of testing in your actual use case

We're entering a world where you can run GPT-3.5-class models on a laptop. The question isn't "which model is best?" — it's "which model is best for *this specific task*?"

**Try It Yourself**

All results, configs, and methodology are open source:
github.com/hnshah/verdict

The eval pack, judge config, and raw data are in the repo. You can reproduce this on your own hardware.

If you're building AI tools or evaluating models, I'd love to hear what you find.

---

## HackerNews Post

**Title:** I benchmarked 3 local coding models – the 14B beat the 30B

**URL:** github.com/hnshah/verdict/blob/main/PUBLIC-MODEL-COMPARISON.md

**Comment (optional context):**

I've been contributing to verdict (a local model eval tool) and wanted to test whether bigger models are actually better for coding tasks.

Tested qwen2.5-coder:14b, phi4:14b, and qwen3-coder:30b on a Mac Studio. All local, $0 cost.

The 14B model won 60% of head-to-head matchups despite having the lowest overall score. Why? Judge bias toward completeness over conciseness.

Key takeaway: For interactive coding, a fast 14B model beats a slow 30B in real-world use, even if the 30B scores higher on synthetic benchmarks.

Full methodology, configs, and raw data are in the repo. Reproducible on any Mac with Ollama.

---

## Reddit Post (r/LocalLLaMA)

**Title:** [Benchmark] qwen2.5-coder:14b vs phi4:14b vs qwen3-coder:30b — The 14B won!

**Body:**

I benchmarked three local coding models on my Mac Studio to see if bigger models are actually better for coding tasks.

**TL;DR:** qwen2.5-coder:14b (14B) won 60% of matchups despite scoring lowest overall. Speed + conciseness > size for interactive coding.

**Setup:**
- Models: qwen2.5-coder:14b, phi4:14b, qwen3-coder:30b
- Hardware: Mac Studio M2 Ultra
- Tool: verdict CLI
- Cost: $0 (all local via Ollama)
- Test cases: 10 (factual, technical, code gen, creative)

**Results:**

| Model | Score | Win% | Latency | Size |
|-------|-------|------|---------|------|
| qwen-coder | 9.24 | 60% | 4.1s | 14B |
| phi4 | 9.28 | 20% | 5.6s | 14B |
| qwen3-coder | 9.56 | 20% | 6.2s | 30B |

**The Paradox:**
- Lowest score but most wins
- 14B beats 30B in real-world matchups
- 32% faster response time

**Why?**
Judge (phi4) favored completeness. qwen-coder gave concise answers that won head-to-head but scored lower overall.

**Key Insight:**
For interactive coding, you want fast + concise. The 30B is only 3.5% better on score but 51% slower.

**Recommendation:**
- Most tasks: qwen2.5-coder:14b
- High quality: qwen3-coder:30b
- Balanced: phi4:14b

**Full results:** github.com/hnshah/verdict/blob/main/PUBLIC-MODEL-COMPARISON.md

All configs and raw data in repo. Reproducible!

---

