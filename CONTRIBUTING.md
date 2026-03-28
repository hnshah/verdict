# Contributing to Verdict

Thanks for your interest in improving Verdict! This guide will help you contribute effectively.

---

## Quick Start

```bash
# 1. Fork the repo
gh repo fork yourusername/verdict

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
- See [issues labeled `bug`](https://github.com/yourusername/verdict/labels/bug)

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

- Browse [open issues](https://github.com/yourusername/verdict/issues)
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
- Run `npm run typecheck` before submitting

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
# Type-check
npm run typecheck

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
  daemon/       # Background daemon
  db/           # Database layer
  judge/        # Judge logic
  providers/    # Model providers (ollama, mlx, OpenAI-compat)
  reporter/     # Output formatting
  router/       # Model routing
  types/        # TypeScript types
```

**Provider layout:**
- `compat.ts` — universal OpenAI-compatible inference (`callModel`, `callModelMultiTurn`, etc.)
- `ollama.ts` — Ollama-specific discovery and helpers
- `mlx.ts` — MLX-specific discovery and helpers

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
import { discoverOllama } from '../providers/ollama.js';

describe('discoverOllama', () => {
  it('returns an array of discovered models', async () => {
    const models = await discoverOllama();
    expect(models).toBeInstanceOf(Array);
  });
});
```

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

Verdict uses a **functional architecture** — no provider base classes. All inference goes
through the universal OpenAI-compatible client in `src/providers/compat.ts` (`callModel`).
Provider-specific files only handle **discovery** (finding running instances and listing
available models).

**Example: Adding LM Studio discovery**

### 1. Create Discovery File

```typescript
// src/providers/lmstudio.ts

import http from 'http'
import type { DiscoveredModel } from '../types/index.js'

const DEFAULT_PORT = 1234

function httpGet(port: number, path: string, timeoutMs = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port, path, method: 'GET', timeout: timeoutMs,
    }, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => resolve(body))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

export async function discoverLMStudio(
  port: number = DEFAULT_PORT
): Promise<DiscoveredModel[]> {
  try {
    const body = await httpGet(port, '/v1/models')
    const data = JSON.parse(body) as { data?: Array<{ id: string }> }
    const base_url = `http://localhost:${port}/v1`

    return (data.data ?? []).map(m => ({
      provider: 'lmstudio' as const,
      id: m.id.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
      model: m.id,
      base_url,
      tags: ['local', 'free'],
    }))
  } catch {
    return [] // LM Studio not running
  }
}
```

Inference already works — any model discovered with a `base_url` pointing at an
OpenAI-compatible endpoint is called via `callModel` in `compat.ts`.

### 2. Add Tests

```typescript
// src/providers/lmstudio.test.ts

import { discoverLMStudio } from './lmstudio.js'

describe('discoverLMStudio', () => {
  it('returns an empty array when LM Studio is not running', async () => {
    const models = await discoverLMStudio(19999) // unlikely port
    expect(models).toEqual([])
  })
})
```

### 3. Update Docs

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
npm run typecheck
npm test
npm run build
```

### 4. Publish

```bash
npm publish
git push --tags
```

---

## Getting Help

**Stuck? Ask us!**

- 💬 [Discord](https://discord.gg/verdict)
- 🐛 [GitHub Issues](https://github.com/yourusername/verdict/issues)
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
