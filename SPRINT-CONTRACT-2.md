# Sprint Contract: verdict feature issues #6 #7 #8 #9

**Question:** Can verdict evaluate vision, tool calling, JSON schema compliance, and multi-turn conversations?

---

## Feature #8: jsonschema scorer (simplest — do first)

Add `scorer: jsonschema` + inline `schema:` field to case config.

**Case format:**
```yaml
- id: extract-001
  prompt: "Extract name and price from: 'Blue widget, $12.99'"
  scorer: jsonschema
  schema:
    type: object
    required: [name, price]
    properties:
      name: { type: string }
      price: { type: number, minimum: 0 }
  criteria: "Output must match schema"
```

**Scoring:**
- All required fields present + correct types: 10/10
- Each missing required field: -2pts
- Each field with wrong type: -1pt
- Valid JSON but zero required fields: 2/10
- Invalid JSON: 0/10

**Files:**
- `src/judge/deterministic.ts` — add `scoreJsonSchema(output, schema)` function
- `src/types/index.ts` — add `schema?: Record<string, unknown>` to EvalCase
- `isDeterministic()` — add `jsonschema` to the list

No external JSON Schema library needed — implement lightweight field/type checking directly.

---

## Feature #9: Multi-turn conversations

Add optional `turns` array to case config. When present, runner sends the full conversation history and scores the final model response.

**Case format:**
```yaml
- id: context-001
  turns:
    - role: user
      content: "My name is Alex and I'm building a SaaS for lawyers."
    - role: assistant
      content: "__model__"   # model responds here
    - role: user
      content: "What was my name and what am I building?"
  criteria: "Correctly recalls Alex and SaaS for lawyers"
  scorer: contains
  expected: "Alex"
```

**How it works:**
- Runner detects `turns` vs `prompt` on a case
- For `__model__` turns: call the model with conversation history up to that point, inject the response
- Final user turn is the one that gets scored
- Use the last assistant response as the scored output

**Files:**
- `src/types/index.ts` — add `turns?: Array<{role: 'user'|'assistant', content: string}>` to EvalCase
- `src/providers/compat.ts` — add `callModelMultiTurn(config, messages)` that accepts full message array
- `src/core/runner.ts` — detect `case.turns`, call multi-turn path, extract final response for scoring
- Existing scorers (json, exact, contains, llm judge) all work unchanged on the final response

---

## Feature #6: Vision support

Add optional `image` field to case config (local file path or URL). When present, sends as base64 image alongside the text prompt.

**Case format:**
```yaml
- id: design-001
  prompt: "Score this homepage design for conversion effectiveness. What are the top 3 friction points?"
  image: ./screenshots/homepage-v1.png
  criteria: "Identifies CTA placement, above-fold clarity, and trust signals"
```

**How it works:**
- In `callModel()`: if `case.image` is set, read file (or fetch URL) → base64 encode → send as multipart content:
  ```json
  { "role": "user", "content": [
    { "type": "text", "text": "prompt" },
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
  ]}
  ```
- If model doesn't support vision (no response or API error on vision content): log warning, skip image, retry with text-only
- `image` path is resolved relative to the eval pack file location

**Files:**
- `src/types/index.ts` — add `image?: string` to EvalCase; add `imagePath?: string` to resolved case
- `src/core/config.ts` — resolve image path relative to pack file location at load time
- `src/providers/compat.ts` — in `callModel()`, check for image, encode, build multipart content array
- `src/cli/commands/run.ts` — pass pack dir to runner for image resolution

---

## Feature #7: Tool calling eval

Add `tools` array and `scorer: tool_call` to case config. Runner passes tools to model via OpenAI tools API, captures tool_calls from response, scores on name + params.

**Case format:**
```yaml
- id: tool-001
  prompt: "Get the weather in San Francisco"
  tools:
    - name: get_weather
      description: "Get current weather for a city"
      parameters:
        type: object
        required: [city]
        properties:
          city: { type: string, description: "City name" }
  scorer: tool_call
  expected_tool: get_weather
  expected_args:
    city: "San Francisco"
```

**Scoring (scorer: tool_call):**
- Correct tool name called: +4pts
- Each expected arg present + correct: +2pts each (up to 4pts total)
- Valid tool_calls format: +2pts
- No tool called at all: 0/10
- Wrong tool called: 2/10

**Files:**
- `src/types/index.ts` — add `tools?`, `expected_tool?`, `expected_args?` to EvalCase; new `ToolDef` type
- `src/providers/compat.ts` — add `callModelWithTools(config, prompt, tools)` — passes tools to API, returns tool_calls array
- `src/judge/deterministic.ts` — add `scoreToolCall(toolCalls, expectedTool, expectedArgs)` function
- `src/core/runner.ts` — detect `scorer === 'tool_call'`, call tool path, score deterministically
- `isDeterministic()` — add `tool_call`

---

## Acceptance criteria

| # | Criterion | Feature |
|---|-----------|---------|
| 1 | `scorer: jsonschema` with valid schema passes correct output | #8 |
| 2 | `scorer: jsonschema` fails when required field missing | #8 |
| 3 | `scorer: jsonschema` gives partial credit for partial compliance | #8 |
| 4 | `turns` case runs multi-turn, scores final response | #9 |
| 5 | `__model__` placeholder is replaced by actual model response | #9 |
| 6 | Multi-turn works with existing scorers (contains, json, llm) | #9 |
| 7 | `image` field loads local PNG and sends as base64 | #6 |
| 8 | Vision case works with Ollama llava / GPT-4o | #6 |
| 9 | Non-vision model gracefully skips image with warning | #6 |
| 10 | `tools` case passes tool definitions to model API | #7 |
| 11 | `scorer: tool_call` scores correct tool + args | #7 |
| 12 | Wrong tool called = 2/10, no tool called = 0/10 | #7 |
| 13 | All existing cases still work unchanged | all |
| 14 | `npm run typecheck` passes clean | all |

## Definition of done

All 14 criteria pass. `npm run typecheck` clean. Changes committed to `feature/issues-6-7-8-9`. No breaking changes.
