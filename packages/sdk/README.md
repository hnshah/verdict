# @verdict/sdk

Programmatic SDK for [Verdict](https://verdict.sh) - LLM evaluation and smart routing.

## Installation

```bash
npm install @verdict/sdk
```

## Quick Start

```typescript
import { VerdictClient } from '@verdict/sdk';

const client = new VerdictClient();

// Get model statistics
const model = await client.getModel('qwen2.5-coder:32b');
console.log(`${model.name}: ${model.avgScore}/10, ${model.winRate}% win rate`);

// Smart routing - get best model for your task
const route = await client.route({
  prompt: "Write a Python function to reverse a string",
  domain: "coding"
});

console.log(`Recommended: ${route.recommendedModel}`);
console.log(`Reasoning: ${route.reasoning}`);
```

## Features

- ✅ **Model Stats** - Get performance data for any model
- ✅ **Leaderboards** - View top models overall or by domain
- ✅ **Smart Routing** - Auto-select best model for your prompt
- ✅ **Eval Results** - Access full benchmark results
- 🚧 **Run Evals** - Coming soon (use CLI for now)

## API Reference

### VerdictClient

```typescript
const client = new VerdictClient({
  apiUrl?: string;    // Default: 'https://api.verdict.sh'
  apiKey?: string;    // Optional API key
});
```

### Methods

#### `getModel(modelName: string): Promise<ModelStats>`

Get statistics for a specific model.

```typescript
const stats = await client.getModel('qwen2.5:32b');
```

#### `listModels(): Promise<ModelStats[]>`

Get all models with statistics.

```typescript
const models = await client.listModels();
```

#### `route(request: RouterRequest): Promise<RouterResponse>`

Get best model recommendation for a task.

```typescript
const route = await client.route({
  prompt: "Explain quantum computing",
  domain: "knowledge",
  constraints: {
    maxLatency: 5000,  // Max 5 seconds
    minScore: 8.5      // Min 8.5/10 avg score
  }
});

console.log(route.recommendedModel);
console.log(route.confidence);
console.log(route.alternatives);
```

#### `getLeaderboard(options?): Promise<ModelStats[]>`

Get model leaderboard.

```typescript
// Overall leaderboard
const top = await client.getLeaderboard({ limit: 10 });

// Domain-specific
const codingTop = await client.getLeaderboard({ 
  domain: 'coding',
  limit: 5
});
```

#### `getResult(runId: string): Promise<EvalResult>`

Get detailed eval result by ID.

```typescript
const result = await client.getResult('2026-04-01T14-51-35');
```

#### `listRuns(options?): Promise<EvalResult[]>`

List eval runs with pagination.

```typescript
const recent = await client.listRuns({ 
  limit: 20,
  offset: 0
});
```

## Types

All TypeScript types are exported:

```typescript
import type {
  EvalResult,
  ModelStats,
  RouterRequest,
  RouterResponse,
  // ... and more
} from '@verdict/sdk';
```

## Examples

### Find Best Coding Model

```typescript
const route = await client.route({
  prompt: "Implement a binary search tree in Python",
  domain: "coding"
});

// Use the recommended model
console.log(`Use ${route.recommendedModel} - ${route.reasoning}`);
```

### Compare Models

```typescript
const models = await client.listModels();

const coding = models
  .filter(m => m.domains.coding)
  .sort((a, b) => b.domains.coding.avgScore - a.domains.coding.avgScore)
  .slice(0, 5);

console.log('Top 5 coding models:');
coding.forEach((m, i) => {
  console.log(`${i+1}. ${m.name} - ${m.domains.coding.avgScore}/10`);
});
```

### Build a Routing Layer

```typescript
class SmartLLM {
  private verdict = new VerdictClient();
  
  async complete(prompt: string, domain?: string) {
    // Get best model
    const route = await this.verdict.route({ prompt, domain });
    
    // Call that model (using your LLM client)
    return yourLLMClient.complete({
      model: route.recommendedModel,
      prompt
    });
  }
}
```

## License

MIT

## Links

- [Dashboard](https://verdict.sh)
- [Documentation](https://verdict.sh/docs)
- [GitHub](https://github.com/hnshah/verdict)
- [NPM](https://npmjs.com/package/@verdict/sdk)
