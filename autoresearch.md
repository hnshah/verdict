# Autoresearch: Fix gemma4 Model Empty Responses in Verdict

## Objective
Diagnose and fix why gemma4:26b returns empty responses and gemma4:31b times out when running through verdict's evaluation framework, while the same models work fine with direct curl API calls.

## Metrics
- **Primary**: successful_responses (count, higher is better) - number of non-empty responses from gemma4:26b and gemma4:31b
- **Secondary**: 
  - avg_response_length (chars, higher is better)
  - avg_latency_ms (milliseconds, lower is better for 31b)
  - test_pass_rate (percentage, higher is better)

## How to Run
`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope
- `dist/*.js` - verdict's compiled JavaScript (if we need to patch runtime)
- `eval-packs/gemma-4-cro-benchmark.yaml` - test configuration
- Any configuration files that control API timeout/format

## Off Limits
- Core verdict source code structure (we're debugging, not rewriting)
- Existing working models (qwen, llama)
- The benchmark cases themselves

## Constraints
- Must preserve backward compatibility with working models
- Changes should be minimal and surgical
- Tests must validate the fix actually works

## What's Been Tried
### Initial Discovery (2026-04-03)
- **Symptom**: gemma4:26b returns empty strings ("") despite 22-28s latency
- **Symptom**: gemma4:31b extremely slow (178-515s) and returns truncated/empty responses
- **Verified**: Both models work fine with direct curl to Ollama API
- **Verified**: Using /v1/chat/completions endpoint directly works for both models
- **Root cause hypothesis**: verdict's API client has timeout or response handling bug for these specific models

### Tested API Endpoints (2026-04-03)
- `/api/generate` with gemma4:26b → works (returns response)
- `/api/generate` with gemma4:31b → works but slow (3+ min)
- `/v1/chat/completions` with gemma4:26b → works (returns partial response)
- `/v1/chat/completions` with gemma4:31b → works (returns partial response)

**Current hypothesis**: Verdict may have different timeout handling or response parsing for different model sizes. Need to inspect actual API calls verdict makes.
