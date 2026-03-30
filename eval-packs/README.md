# Verdict Eval Packs

Comprehensive evaluation suites for testing model capabilities.

---

## Available Packs

### 🐍 python-coding.yaml (NEW!)
**15 cases** | Python scripting excellence

**Coverage:**
- Data processing (JSON, CSV, files)
- API clients with retry logic
- CLI tools with argparse
- Async/await patterns
- Context managers
- Testing with pytest
- OOP and class design
- Functional programming
- Database operations (SQLite)
- Error handling patterns
- Regular expressions
- Memory-efficient generators

**Difficulty:** Medium to Hard  
**Best for:** Evaluating Python coding ability comprehensively

**Usage:**
```bash
verdict run -c config.yaml -p eval-packs/python-coding.yaml
```

---

### 💻 code-generation.yaml
**8 cases** | Multi-language coding

**Coverage:**
- TypeScript interfaces
- Bug fixes
- Python data processing
- Error handling
- Test case writing
- Refactoring
- API design
- Documentation

**Difficulty:** Medium  
**Best for:** General coding ability across languages

---

### ⚡ quick-test.yaml
**2 cases** | Fast smoke test

**Coverage:**
- Simple math
- Basic reasoning

**Difficulty:** Easy  
**Best for:** Quick validation that eval system works

---

### 🎯 general.yaml
**Multiple cases** | General reasoning

**Coverage:**
- Various reasoning tasks

**Difficulty:** Medium  
**Best for:** General intelligence testing

---

## Creating Custom Eval Packs

### Structure

```yaml
name: Your Pack Name
description: What this tests

cases:
  - id: unique-case-id
    prompt: |
      The task or question
    
    criteria: |
      What makes a good answer:
      - Point 1
      - Point 2
      - Point 3
    
    tags: [category, difficulty]
```

### Best Practices

**1. Clear Criteria**
- Use "MUST HAVE" and "QUALITY" sections
- List specific requirements
- Include error cases

**2. Realistic Tasks**
- Test actual use cases
- Not toy problems
- Include edge cases

**3. Testable Outputs**
- Clear success criteria
- Specific technical requirements
- Measurable quality indicators

**4. Progressive Difficulty**
- Start simple
- Build complexity
- Test edge cases last

---

## Scoring Guide

### Judge Criteria

**Accuracy (40%):**
- Correct syntax
- Proper logic
- No errors
- Handles edge cases

**Completeness (40%):**
- All requirements met
- Error handling included
- Edge cases covered
- Full implementation

**Conciseness (20%):**
- Clear code
- No unnecessary complexity
- Good naming
- Appropriate length

### Score Ranges

- **9-10:** Excellent - Production-ready
- **7-8:** Good - Minor improvements needed
- **5-6:** Adequate - Works but has issues
- **3-4:** Poor - Significant problems
- **0-2:** Failed - Doesn't work

---

## Running Evaluations

### Single Pack
```bash
verdict run -c config.yaml -p eval-packs/python-coding.yaml
```

### Multiple Models
```bash
verdict run -c config.yaml -m model1 -m model2 -m model3
```

### Limit Cases (for testing)
```bash
verdict run -c config.yaml --limit 3
```

### Resume from Checkpoint
```bash
verdict run -c config.yaml --resume
```

---

## Example Configs

### Python Specialist Test
```yaml
name: Python Coding Test

models:
  - id: qwen-coder
    provider: ollama
    model: qwen2.5-coder:7b

judge:
  model: sonnet-openclaw
  rubric:
    accuracy: 0.4
    completeness: 0.4
    conciseness: 0.2

packs:
  - ./eval-packs/python-coding.yaml
```

### Multi-Model Comparison
```yaml
name: Coding Comparison

models:
  - id: qwen-local
    provider: ollama
    model: qwen2.5-coder:7b
  
  - id: haiku-openclaw
    provider: openclaw
    model: anthropic/claude-haiku-4-5
  
  - id: sonnet-openclaw
    provider: openclaw
    model: anthropic/claude-sonnet-4-5

judge:
  model: sonnet-openclaw

packs:
  - ./eval-packs/python-coding.yaml
  - ./eval-packs/code-generation.yaml
```

---

## Contributing

### Adding New Cases

1. Identify gap in coverage
2. Write clear prompt
3. Define specific criteria
4. Test with at least 2 models
5. Add to appropriate pack

### Pack Guidelines

- Minimum 5 cases per pack
- Clear theme/focus
- Progressive difficulty
- Real-world relevance
- Testable criteria

---

## Results & Analysis

### View Results
```bash
verdict leaderboard
open docs/index.html
```

### Compare Models
```bash
verdict report --model qwen-local --compare haiku-openclaw
```

### Publish Results
```bash
verdict publish
git add results/public/ docs/
git commit -m "Add benchmark results"
git push
```

---

## Pack Roadmap

**Coming Soon:**
- `data-science.yaml` - NumPy, Pandas, ML tasks
- `web-scraping.yaml` - BeautifulSoup, Selenium, APIs
- `system-admin.yaml` - Shell scripts, automation
- `algorithm.yaml` - Classic algorithms, data structures
- `security.yaml` - Input validation, SQL injection, XSS

**Future:**
- `frontend.yaml` - React, TypeScript, CSS
- `backend.yaml` - FastAPI, Flask, Django
- `devops.yaml` - Docker, K8s, CI/CD
- `mobile.yaml` - React Native, Swift, Kotlin

---

**For questions or suggestions, check the main Verdict README or open an issue!**
