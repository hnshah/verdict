# Comprehensive Verdict Eval Run Matrix

**Hardware:** Apple M2 Max, 64GB RAM (macs164)  
**Date:** 2026-03-31  
**Author:** Rak

---

## Strategy

**Goal:** Populate Verdict dashboard with comprehensive local model data across all pack types.

**Approach:**
1. **HuggingFace Benchmarks** - Validate our contributed packs
2. **Existing Verdict Packs** - Show platform versatility
3. **Specialized Runs** - Code, reasoning, knowledge, creative
4. **Cross-Pack Comparisons** - Same models, different tasks
5. **Model Specialization** - Test specialists on their domains

---

## Model Inventory (Available on macs164)

### General Purpose (Strong All-Around)
- **qwen2.5:7b** - Fast, reliable baseline (7B)
- **qwen2.5:32b** - High quality, our flagship (32B)
- **qwen3.5:4b** - New, fast, smaller (4B)
- **gemma3:12b** - Google's latest (12B)

### Code Specialists
- **deepseek-coder:6.7b** - Code generation specialist
- **deepseek-coder:14b** - Larger code model
- **qwen2.5-coder:7b** - Qwen code variant
- **codestral:22b** - Mistral code model

### Reasoning & Math
- **cogito:8b** - Reasoning specialist
- **qwq:32b** - Math reasoning focus
- **deepthink:1b** - Tiny reasoning model

### Creative & Writing
- **llama3.3:70b** - Large creative model (if fits)
- **command-r:35b** - RAG + creative

### Vision (if needed)
- **llama3.2-vision:11b**
- **llava:7b**

---

## Pack Inventory (30 Available)

### Our Contributed Packs (HF Benchmarks)
1. **gsm8k.yaml** - 50 math word problems
2. **humaneval.yaml** - 164 Python coding problems
3. **mbpp.yaml** - 100 entry-level Python

### Existing Verdict Packs (Categorized)

**General/Workflow:**
- general-workflow.yaml (8 cases)
- general.yaml (~20 cases)

**Code:**
- coding.yaml (~20 cases)
- code-generation.yaml
- python-coding.yaml
- python-elite.yaml
- cli-building.yaml
- oss-contribution.yaml

**Reasoning:**
- reasoning.yaml (~20 cases)
- failure-modes.yaml
- hallucination-robustness.yaml

**Knowledge/Data:**
- data-analysis.yaml
- json-extraction.yaml
- jsonschema-scorer.yaml
- ocr-extraction.yaml

**Creative/Writing:**
- creative-writing.yaml
- writing-quality.yaml
- summarization.yaml
- technical-documentation.yaml

**Domain-Specific:**
- customer-support.yaml
- instruction-following.yaml
- multi-turn.yaml
- moe.yaml (mixture of experts)
- performance-benchmark.yaml
- quantization.yaml

---

## Planned Runs (60+ Total)

### Phase 1: HuggingFace Benchmarks (Runs 1-12)

#### Math (GSM8K)
- **Run 1:** ✅ IN PROGRESS - GSM8K × 5 general models
- **Run 2:** GSM8K × 3 reasoning specialists (cogito, qwq, deepthink)
- **Run 3:** GSM8K × 2 large models (llama3.3:70b, command-r:35b)

#### Code (HumanEval)
- **Run 4:** HumanEval × 4 code specialists (deepseek-coder 6.7b/14b, qwen-coder, codestral)
- **Run 5:** HumanEval × 3 general models (qwen 7b/32b, gemma3)
- **Run 6:** HumanEval × 1 tiny model (deepthink:1b) - failure mode test

#### Code (MBPP)
- **Run 7:** MBPP × 4 code specialists
- **Run 8:** MBPP × 3 general models
- **Run 9:** MBPP × 2 reasoning models (cogito, qwq)

#### Cross-Benchmark (Same Models, All 3 Packs)
- **Run 10:** qwen2.5:7b × (GSM8K + HumanEval + MBPP)
- **Run 11:** deepseek-coder:6.7b × (GSM8K + HumanEval + MBPP)
- **Run 12:** qwen2.5:32b × (GSM8K + HumanEval + MBPP)

---

### Phase 2: Code Packs (Runs 13-24)

#### Existing Code Packs
- **Run 13:** coding.yaml × 5 code specialists
- **Run 14:** python-coding.yaml × 4 code specialists
- **Run 15:** python-elite.yaml × 2 best coders (deepseek-14b, codestral)
- **Run 16:** code-generation.yaml × 5 general models
- **Run 17:** cli-building.yaml × 3 code specialists
- **Run 18:** oss-contribution.yaml × 3 code specialists

#### Code Specialist Sweep (All Code Packs)
- **Run 19:** deepseek-coder:6.7b × (all 6 code packs)
- **Run 20:** deepseek-coder:14b × (all 6 code packs)
- **Run 21:** qwen-coder:7b × (all 6 code packs)
- **Run 22:** codestral:22b × (all 6 code packs)

#### General vs Specialist (Code)
- **Run 23:** qwen2.5:32b vs deepseek:14b × (coding + python-coding + humaneval)
- **Run 24:** gemma3:12b vs qwen-coder:7b × (coding + python-coding + mbpp)

---

### Phase 3: Reasoning & Knowledge (Runs 25-36)

#### Reasoning Packs
- **Run 25:** reasoning.yaml × 5 reasoning models (cogito, qwq, qwen-32b, gemma3, deepthink)
- **Run 26:** failure-modes.yaml × 5 models (test robustness)
- **Run 27:** hallucination-robustness.yaml × 5 models

#### Knowledge/Data Packs
- **Run 28:** data-analysis.yaml × 4 models (qwen-7b/32b, gemma3, command-r)
- **Run 29:** json-extraction.yaml × 5 models
- **Run 30:** jsonschema-scorer.yaml × 5 models
- **Run 31:** ocr-extraction.yaml × vision models (llama3.2-vision, llava)

#### Reasoning Specialist Sweep
- **Run 32:** cogito:8b × (gsm8k + reasoning + failure-modes)
- **Run 33:** qwq:32b × (gsm8k + reasoning + failure-modes)
- **Run 34:** qwen2.5:32b × (gsm8k + reasoning + data-analysis)

#### General Workflow (All Models Baseline)
- **Run 35:** general-workflow.yaml × 10 models (baseline for all)
- **Run 36:** general.yaml × 10 models

---

### Phase 4: Creative & Writing (Runs 37-45)

#### Writing Packs
- **Run 37:** creative-writing.yaml × 4 models (llama3.3, command-r, qwen-32b, gemma3)
- **Run 38:** writing-quality.yaml × 4 models
- **Run 39:** summarization.yaml × 5 models (include qwen-7b for speed)
- **Run 40:** technical-documentation.yaml × 4 models

#### Creative Specialist Tests
- **Run 41:** llama3.3:70b × (all 4 writing packs)
- **Run 42:** command-r:35b × (all 4 writing packs)
- **Run 43:** qwen2.5:32b × (all 4 writing packs)

#### Multi-Turn & Instructions
- **Run 44:** multi-turn.yaml × 5 models
- **Run 45:** instruction-following.yaml × 5 models

---

### Phase 5: Domain-Specific (Runs 46-54)

#### Customer Support
- **Run 46:** customer-support.yaml × 4 models (command-r, qwen-32b, gemma3, llama3.3)

#### Performance & Quantization
- **Run 47:** performance-benchmark.yaml × 5 models (speed comparison)
- **Run 48:** quantization.yaml × different quant levels (if available)

#### Mixture of Experts
- **Run 49:** moe.yaml × 3 models

#### Domain Sweep (Best Model Per Pack)
- **Run 50:** qwen2.5:32b × (customer-support + instruction + multi-turn)
- **Run 51:** command-r:35b × (customer-support + instruction + multi-turn)

#### Tiny Model Challenge
- **Run 52:** deepthink:1b × (general + reasoning + gsm8k) - failure analysis
- **Run 53:** qwen3.5:4b × (general + coding + gsm8k) - speed king
- **Run 54:** cogito:8b × (reasoning + gsm8k + failure-modes) - specialist deep-dive

---

### Phase 6: Comprehensive Model Profiles (Runs 55-65)

Each top model gets a comprehensive profile across all task types.

#### Top Model Deep-Dives
- **Run 55:** qwen2.5:7b × 10 diverse packs (general baseline)
- **Run 56:** qwen2.5:32b × 10 diverse packs (quality baseline)
- **Run 57:** deepseek-coder:6.7b × 10 packs (code + general)
- **Run 58:** gemma3:12b × 10 packs (Google's best)
- **Run 59:** cogito:8b × 10 packs (reasoning + general)

#### Large Model Profiles (If They Fit)
- **Run 60:** llama3.3:70b × 10 packs (creative + general + reasoning)
- **Run 61:** command-r:35b × 10 packs (RAG + creative + general)
- **Run 62:** codestral:22b × 8 code packs (code specialist profile)

#### Cross-Size Comparison (Same Family)
- **Run 63:** qwen family (4b, 7b, 32b) × (gsm8k + coding + reasoning)
- **Run 64:** deepseek-coder family (6.7b, 14b) × (humaneval + mbpp + coding)
- **Run 65:** All models × general-workflow (universal baseline)

---

## Execution Strategy

### Priority Order
1. **Phase 1 first** - Validate our contributed packs (Runs 1-12)
2. **Run 35 & 65** - Universal baselines (general-workflow × all models)
3. **Phase 2 & 3** - Populate code + reasoning categories
4. **Phase 4 & 5** - Creative + domain-specific
5. **Phase 6** - Comprehensive model profiles

### Parallel Execution
- Can run multiple small packs in parallel (different terminals)
- Large packs (HumanEval, TruthfulQA) run solo
- Coordinate to avoid OOM on 64GB RAM

### Time Estimates

**Fast runs (< 30 min):**
- general-workflow, general, coding (small packs)
- Any pack × 1-2 models

**Medium runs (30-90 min):**
- GSM8K × multiple models
- MBPP × multiple models
- Most single-pack runs

**Long runs (2-4 hours):**
- HumanEval × multiple models
- Large model × many packs
- Comprehensive profiles

**Very long (4+ hours):**
- Run 60-62 (large models × 10 packs)
- Run 65 (all models × general-workflow)

### Estimated Total Time
- **Fast runs (30):** ~15-20 hours
- **Medium runs (25):** ~40-50 hours
- **Long runs (10):** ~30-40 hours
---
**TOTAL: 85-110 hours of compute**

Spread over days/weeks, can run 2-3 per day = ~3-4 weeks for full matrix.

---

## Dashboard Impact

**After completion:**
- **65 eval runs** contributed
- **~15-20 unique models** profiled
- **~25-30 packs** validated
- **1,000+ individual evaluations**

**Value:**
- Most comprehensive local model data on Verdict
- Proves platform works across all pack types
- Hardware tag: "64GB can run 32B+ models"
- Model comparison: specialists vs generalists
- Size comparison: 1B to 70B models

---

## Next Steps

1. ✅ Run 1 in progress (GSM8K × 5 models)
2. Create all 65 config files
3. Run in priority order
4. Contribute after each completion
5. Monitor dashboard population

**Want me to:**
- Generate all 65 config files now?
- Start with Priority Runs (1-12, 35, 65)?
- Focus on specific phases first?

🔭 **Rak ready to generate configs...**
