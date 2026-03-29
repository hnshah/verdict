# Contributing to Verdict

Thanks for your interest in improving Verdict! This guide will help you contribute effectively.

---

## Quick Start

```bash
# 1. Fork the repo
gh repo fork hnshah/verdict

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/verdict.git
cd verdict

# 3. Install dependencies
npm install

# 4. Build
npm run build

# 5. Run tests
npm test

# 6. Try it locally
./dist/cli/index.js models
```

---

## What We're Looking For

### 🎯 High Priority

**Provider Integrations:**
- LM Studio auto-discovery (currently manual config only)
- llama.cpp server detection
- vLLM support
- Other OpenAI-compat servers

**Eval Pack Templates:**
- Domain-specific packs (legal, medical, finance, etc.)
- Real-world task examples
- Common regression tests

**Documentation:**
- Video tutorials
- Blog posts explaining use cases
- Translation to other languages

**Bug Fixes:**
- See [issues labeled `bug`](https://github.com/hnshah/verdict/labels/bug)

### 💡 Medium Priority

**Features:**
- Multi-judge consensus (2+ judges vote, take median/average)
- Web UI dashboard
- Export to HTML/PDF reports
- GitHub Actions integration

**Performance:**
- Faster model discovery
- Parallel execution improvements
- Caching optimizations

### ⏸️ Lower Priority

**Major changes** - Please open an issue first to discuss:
- New eval formats (beyond YAML)
- Breaking API changes
- New core dependencies
- Architecture rewrites

---

## Development Workflow

### 1. Pick an Issue

- Browse [open issues](https://github.com/hnshah/verdict/issues)
- Look for `good first issue` or `help wanted` labels
- Comment saying you'd like to work on it

### 2. Create a Branch

```bash
git checkout -b fix/issue-123-description
# or
git checkout -b feat/new-feature-name
```

**Branch naming:**
- `fix/` - Bug fixes
- `feat/` - New features
- `docs/` - Documentation
- `perf/` - Performance improvements
- `refactor/` - Code cleanup

### 3. Make Your Changes

**Code style:**
- TypeScript for all source code
- ESLint for linting (run `npm run lint`)
- Prettier for formatting (run `npm run format`)

**Commit messages:**
```bash
# Good
git commit -m "fix: Handle empty model list in discovery"
git commit -m "feat: Add LM Studio auto-discovery"
git commit -m "docs: Update quick start guide"

# Bad
git commit -m "updates"
git commit -m "fixed stuff"
```

### 4. Test Your Changes

```bash
# Run test suite
npm test

# Build
npm run build

# Test CLI locally
./dist/cli/index.js run --dry-run

# Test with real models
./dist/cli/index.js models discover
./dist/cli/index.js run -p quick-test
```

### 5. Submit PR

```bash
git push origin your-branch-name
gh pr create
```

**PR template:**
```markdown
## What

Describe what this PR does (1-2 sentences)

## Why

Explain the problem this solves or feature it adds

## How

Brief technical overview (if complex)

## Testing

How did you test this?
- [ ] Unit tests pass
- [ ] Manual testing done
- [ ] Tested on: [Mac/Linux/Windows]

## Screenshots

(If UI changes)

## Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG.md updated (if user-facing change)
```

---

## Code Guidelines

### TypeScript

**Use strict typing:**
```typescript
// Good ✅
function parseConfig(path: string): Config | null {
  // ...
}

// Bad ❌
function parseConfig(path: any): any {
  // ...
}
```

**Prefer interfaces over types:**
```typescript
// Good ✅
interface ModelConfig {
  id: string;
  provider: string;
  model: string;
}

// Bad ❌
type ModelConfig = {
  id: string;
  provider: string;
  model: string;
};
```

**Use async/await, not callbacks:**
```typescript
// Good ✅
async function runEval(config: Config): Promise<Results> {
  const models = await discoverModels();
  return await benchmarkModels(models);
}

// Bad ❌
function runEval(config: Config, callback: Function) {
  discoverModels((models) => {
    benchmarkModels(models, callback);
  });
}
```

### Error Handling

**Always handle errors:**
```typescript
// Good ✅
try {
  const result = await model.infer(prompt);
  return result;
} catch (error) {
  console.error(`Model ${model.id} failed:`, error);
  return { status: 'error', message: error.message };
}

// Bad ❌
const result = await model.infer(prompt);  // Can crash!
return result;
```

**Provide helpful error messages:**
```typescript
// Good ✅
throw new Error(
  `Model "${modelId}" not found in config. ` +
  `Available models: ${availableIds.join(', ')}`
);

// Bad ❌
throw new Error('Model not found');
```

### File Organization

```
src/
  cli/          # CLI commands
  core/         # Core eval engine
  providers/    # Model providers (ollama, openai, etc.)
  judge/        # Judge logic
  router/       # Model routing
  reporter/     # Output formatting
  types/        # TypeScript types
```

**One concern per file:**
- `ollama-provider.ts` - Ollama integration only
- `openai-provider.ts` - OpenAI integration only
- Don't mix providers in one file

---

## Testing

### Unit Tests

```bash
npm test
```

**Write tests for:**
- ✅ New features
- ✅ Bug fixes
- ✅ Edge cases
- ✅ Error handling

**Example:**
```typescript
describe('OllamaProvider', () => {
  it('discovers installed models', async () => {
    const provider = new OllamaProvider();
    const models = await provider.discover();
    
    expect(models).toBeInstanceOf(Array);
    expect(models.length).toBeGreaterThan(0);
  });

  it('handles connection errors gracefully', async () => {
    const provider = new OllamaProvider({ baseUrl: 'http://invalid' });
    
    await expect(provider.discover()).rejects.toThrow();
  });
});
```

### Integration Tests

```bash
npm run test:integration
```

**Test real workflows:**
- Model discovery
- Running evals end-to-end
- Config parsing
- Provider communication

### Manual Testing

Before submitting PR:

1. **Test discovery:**
   ```bash
   ./dist/cli/index.js models discover
   ```

2. **Test dry run:**
   ```bash
   ./dist/cli/index.js run --dry-run
   ```

3. **Test real run:**
   ```bash
   ./dist/cli/index.js run -p quick-test
   ```

4. **Test on different OS** (if possible):
   - Mac, Linux, Windows
   - Different shells (bash, zsh, fish)

---

## Adding a Provider

**Example: Adding LM Studio**

### 1. Create Provider File

```typescript
// src/providers/lmstudio-provider.ts

import { BaseProvider } from './base.js';
import type { Model, InferRequest, InferResponse } from '../types/index.js';

export class LMStudioProvider extends BaseProvider {
  constructor(
    private baseUrl: string = 'http://localhost:1234'
  ) {
    super('lmstudio');
  }

  async discover(): Promise<Model[]> {
    // Auto-detect running models
    const response = await fetch(`${this.baseUrl}/v1/models`);
    const data = await response.json();
    
    return data.data.map((model: any) => ({
      id: model.id,
      provider: 'lmstudio',
      name: model.id,
      base_url: this.baseUrl,
    }));
  }

  async infer(request: InferRequest): Promise<InferResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
      }),
    });
    
    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      usage: data.usage,
    };
  }
}
```

### 2. Register Provider

```typescript
// src/providers/index.ts

export { LMStudioProvider } from './lmstudio-provider.js';
```

### 3. Add Tests

```typescript
// src/providers/lmstudio-provider.test.ts

describe('LMStudioProvider', () => {
  it('discovers models', async () => {
    const provider = new LMStudioProvider();
    const models = await provider.discover();
    expect(models).toBeInstanceOf(Array);
  });
});
```

### 4. Update Docs

Add to README.md:
```markdown
| LM Studio | ✅ Full | Yes | Auto-detects port 1234 |
```

---

## Documentation

### When to Update Docs

- ✅ New feature → Update README + add example
- ✅ New CLI command → Update CLI Reference section
- ✅ Breaking change → Update CHANGELOG + migration guide
- ✅ Bug fix → Update CHANGELOG (if user-visible)

### Writing Good Docs

**Show, don't tell:**
```markdown
<!-- Good ✅ -->
## Quick Start
`bash
verdict init
verdict run
`

<!-- Bad ❌ -->
To get started, you should first initialize Verdict
by running the init command, then you can run evals.
```

**Use real examples:**
```markdown
<!-- Good ✅ -->
`bash
verdict run --models "qwen2.5:7b,sonnet"
`

<!-- Bad ❌ -->
Run specific models with the --models flag
```

**Include expected output:**
```markdown
<!-- Good ✅ -->
`bash
verdict models

✅ qwen2.5:7b (ollama, 250ms)
✅ sonnet (openrouter, 820ms)
`

<!-- Bad ❌ -->
This command will check all your models.
```

---

## Release Process

(For maintainers only)

### 1. Update Version

```bash
npm version patch  # 0.2.0 → 0.2.1
npm version minor  # 0.2.1 → 0.3.0
npm version major  # 0.3.0 → 1.0.0
```

### 2. Update CHANGELOG

```markdown
## [0.3.0] - 2026-03-26

### Added
- LM Studio auto-discovery
- Multi-judge consensus mode

### Fixed
- Model discovery timeout on slow networks

### Changed
- Router now defaults to local models (cost optimization)
```

### 3. Build & Test

```bash
npm run build
npm test
npm run test:integration
```

### 4. Publish

```bash
npm publish
git push --tags
```

---

## Getting Help

**Stuck? Ask us!**

- 🐛 [GitHub Issues](https://github.com/hnshah/verdict/issues)
- 📧 Email: verdictdevs@example.com

**Before asking:**
- [ ] Checked existing issues
- [ ] Read this guide
- [ ] Tried building locally

---

## Code of Conduct

Be kind. Be respectful. Be collaborative.

- ✅ Helpful code reviews
- ✅ Constructive feedback
- ✅ Assume good intent

- ❌ Rude comments
- ❌ Dismissive reviews
- ❌ Personal attacks

We're all here to build something useful together!

---

## License

By contributing, you agree your code is licensed under MIT.

---

**Questions?** Open an issue or join our Discord!

**Ready to contribute?** Pick an issue and send a PR! 🚀
