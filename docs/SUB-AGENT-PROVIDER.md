# Sub-Agent Provider for Verdict

**Status:** 🚧 Framework Complete - Integration Pending

Evaluate sub-agents as models in Verdict! Compare sub-agent performance vs direct API calls.

---

## Overview

The sub-agent provider enables Verdict to spawn sub-agents and evaluate their responses just like any other model.

**Use cases:**
- Compare sub-agents vs direct API calls
- Test if spawning helps quality
- Optimize sub-agent prompts
- Track sub-agent performance over time
- Measure latency/cost trade-offs

---

## Architecture

```
Verdict → Sub-Agent Provider → sessions_spawn → Sub-Agent → Response
                                      ↓
                              Wait for completion
                                      ↓
                              Extract response text
```

**Key difference from other providers:**
- Spawns an actual agent session
- Waits for push-based completion
- Extracts text from session history
- Tracks session metadata

---

## Configuration

### Basic Sub-Agent Model

```yaml
models:
  - id: subagent-sonnet
    provider: subagent
    model: anthropic/claude-sonnet-4-5
    runtime: subagent
    mode: run
    timeout_seconds: 300
    tags: [subagent, reasoning]
```

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | required | Must be `"subagent"` |
| `model` | string | required | Model to use in sub-agent |
| `runtime` | enum | `"subagent"` | `"subagent"` or `"acp"` |
| `mode` | enum | `"run"` | `"run"` or `"session"` |
| `agent_id` | string | optional | Which agent config to use |
| `timeout_seconds` | number | `300` | Max time to wait for response |

---

## Comparison Example

### Direct API vs Sub-Agent

```yaml
name: Sub-Agent vs Direct Comparison

models:
  # Direct API call (fast, cheap)
  - id: direct-sonnet
    provider: openclaw
    model: anthropic/claude-sonnet-4-5
    agent_id: ren
  
  # Via sub-agent (slower, but has tools?)
  - id: subagent-sonnet
    provider: subagent
    model: anthropic/claude-sonnet-4-5
    runtime: subagent
    mode: run
    timeout_seconds: 300
  
  # Local baseline
  - id: qwen-local
    provider: ollama
    model: qwen2.5-coder:7b

judge:
  model: direct-sonnet  # Use direct for judging

packs:
  - ./eval-packs/code-generation.yaml
```

**Run:**
```bash
verdict run -c subagent-comparison.yaml
```

**Expected insights:**
- Latency difference (sub-agent adds overhead)
- Quality difference (does spawning help?)
- Cost comparison (same model, different path)
- Tool usage (sub-agents can use OpenClaw tools)

---

## Use Cases

### 1. Latency Trade-off Analysis

**Question:** How much slower are sub-agents?

**Test:**
```yaml
models:
  - id: direct
    provider: openclaw
    model: anthropic/claude-haiku-4-5
  
  - id: subagent
    provider: subagent
    model: anthropic/claude-haiku-4-5
```

**Expected result:**
- Direct: ~2-3s
- Sub-agent: ~5-8s (spawn overhead + queue time)

**Insight:** Sub-agents add 2-5s overhead. Worth it if tools help.

### 2. Quality Improvement Test

**Question:** Do sub-agents produce better results?

**Hypothesis:** Sub-agents have access to tools (web search, code execution) that might improve quality.

**Test:**
```yaml
judge:
  model: direct-sonnet  # Fair judge

packs:
  - ./eval-packs/python-coding.yaml  # Complex tasks
```

**Metrics:**
- Accuracy: Does code work?
- Completeness: All requirements met?
- Tool usage: Did sub-agent use helpful tools?

### 3. Cost Analysis

**Question:** Are sub-agents more expensive?

**Factors:**
- Same model → Same API cost per token
- But: Sub-agents might use more tokens (tool calls, planning)
- Latency cost (time = money in production)

**Test:**
```yaml
settings:
  parallel: 1  # Sequential to measure real latency
```

**Metrics to compare:**
- Total cost (tokens used)
- Cost per successful answer
- Latency (time cost)

### 4. Prompt Optimization

**Question:** What prompt style works best for sub-agents?

**Test different task formulations:**
```yaml
cases:
  - id: direct-style
    prompt: "Write a Python function that..."
  
  - id: agent-style
    prompt: "You are a Python expert. Write a function that..."
  
  - id: tool-aware
    prompt: "Write a Python function (you can search docs if needed) that..."
```

**Insight:** Find which prompt style gets best sub-agent results.

---

## Implementation Status

### ✅ Complete

1. **Provider interface** - `src/providers/subagent.ts`
2. **Type definitions** - Added to schema
3. **Routing integration** - All call paths
4. **Judge support** - Sub-agents can be judges too
5. **Build passing** - TypeScript compilation works

### 🚧 Pending Integration

**Need to implement:**

1. **`spawnSubAgent()` function**
   - Call actual `sessions_spawn` tool
   - Handle spawn failures
   - Extract session key and run ID

2. **`waitForSubAgentCompletion()` function**
   - Poll `sessions_history` for completion
   - Extract text from assistant message
   - Handle timeouts gracefully

3. **Error handling**
   - Spawn failures
   - Timeouts
   - Session errors
   - Message extraction failures

**Code locations to update:**
```typescript
// In src/providers/subagent.ts

// Replace placeholder with actual call:
async function spawnSubAgent(params) {
  return await sessions_spawn({
    task: params.task,
    runtime: params.runtime,
    mode: params.mode,
    model: params.model,
    runTimeoutSeconds: params.runTimeoutSeconds
  })
}

// Replace placeholder with actual polling:
async function waitForSubAgentCompletion(sessionKey, timeoutSeconds) {
  while (Date.now() - startTime < timeoutMs) {
    const history = await sessions_history({ 
      sessionKey, 
      limit: 1 
    })
    
    if (history.messages.length > 0) {
      const lastMessage = history.messages[history.messages.length - 1]
      if (lastMessage.role === 'assistant') {
        return { message: extractTextFromMessage(lastMessage) }
      }
    }
    
    await sleep(1000)
  }
  
  throw new Error(`Timeout after ${timeoutSeconds}s`)
}
```

---

## Testing Plan

### Phase 1: Smoke Test (5 min)
```yaml
models:
  - id: subagent-haiku
    provider: subagent
    model: anthropic/claude-haiku-4-5
    mode: run

packs:
  - ./eval-packs/quick-test.yaml  # 2 simple cases
```

**Expected:** Works or clear error message

### Phase 2: Comparison (30 min)
```yaml
models:
  - id: direct-haiku
    provider: openclaw
    model: anthropic/claude-haiku-4-5
  
  - id: subagent-haiku
    provider: subagent
    model: anthropic/claude-haiku-4-5

packs:
  - ./eval-packs/python-quick.yaml  # 3 cases
```

**Expected:**
- Both work
- Sub-agent slower
- Quality comparable

### Phase 3: Comprehensive (2 hours)
```yaml
models:
  - id: direct-sonnet
    provider: openclaw
    model: anthropic/claude-sonnet-4-5
  
  - id: subagent-sonnet
    provider: subagent
    model: anthropic/claude-sonnet-4-5
  
  - id: qwen-local
    provider: ollama
    model: qwen2.5-coder:7b

packs:
  - ./eval-packs/python-coding.yaml  # 15 cases
```

**Expected:** Full performance comparison with statistical significance

---

## Debugging

### Enable Debug Logging

```bash
export VERDICT_DEBUG=1
verdict run -c config.yaml
```

### Common Issues

**1. Spawn fails**
```
Error: Sub-agent spawn failed: rejected
```

**Fix:** Check agent_id, model availability, OpenClaw running

**2. Timeout**
```
Error: Sub-agent timeout after 300s
```

**Fix:** Increase `timeout_seconds` or check if sub-agent is stuck

**3. Empty response**
```
Error: No assistant message found
```

**Fix:** Check sub-agent actually responded (view session history manually)

### Manual Testing

```bash
# Test spawn manually
openclaw agent ren --task "Write hello world in Python"

# Check if it works, then try in Verdict
```

---

## Future Enhancements

### Streaming Support
```yaml
- id: subagent-streaming
  provider: subagent
  stream: true  # Stream tokens as they arrive
```

### Tool Usage Tracking
```typescript
metadata: {
  tools_used: ['web_search', 'read'],
  tool_call_count: 3
}
```

### Parallel Sub-Agents
```yaml
settings:
  parallel: 3  # Spawn 3 sub-agents concurrently
```

### Sub-Agent Chains
```yaml
- id: subagent-researcher
  provider: subagent
  runtime: acp
  agent_id: researcher

- id: subagent-coder
  provider: subagent
  runtime: acp
  agent_id: coder
```

---

## Example Results (Expected)

```
Model                 Score   Latency   Cost      Win%
----------------------------------------------------------------
direct-sonnet         9.2     2.3s      $0.012    60%
subagent-sonnet       9.4     7.8s      $0.015    70%
qwen-local           8.8     4.1s      free      40%

Insight: Sub-agent 2% better quality but 3.4x slower
Trade-off: Worth it for complex tasks, not simple ones
```

---

## Contributing

**To complete integration:**

1. Implement `spawnSubAgent()` with actual `sessions_spawn`
2. Implement `waitForSubAgentCompletion()` with polling
3. Add error handling
4. Test with real sub-agents
5. Document any gotchas
6. Add to main README

**Questions?** Check main Verdict docs or open an issue!

---

**Status:** Framework complete, integration pending. Ready for `sessions_spawn` tool access!
