import fs from 'fs'
import chalk from 'chalk'

export async function initCommand(opts: { yes?: boolean }): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' init'))
  console.log()

  if (fs.existsSync('./verdict.yaml') && !opts.yes) {
    console.log(chalk.yellow('  verdict.yaml already exists. Use --yes to overwrite.'))
    return
  }

  const config = `# verdict.yaml
# All values support \${ENV_VAR} and \${ENV_VAR:-default} substitution.
version: "1.0"
name: "My Evals"

models:
  # Local models via Ollama
  # Run 'verdict models discover' to see what you have installed.
  - id: local-fast
    provider: ollama
    model: qwen2.5:7b
    host: "\${OLLAMA_HOST:-localhost:11434}"
    tags: [local, free, fast]

  # Local models via MLX (Apple Silicon)
  # Start: mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit --port 8080
  # - id: local-mlx
  #   provider: mlx
  #   model: mlx-community/Llama-3.2-3B-Instruct-4bit
  #   port: "\${MLX_PORT:-8080}"
  #   tags: [local, free, mlx, apple-silicon]

  # MoE model via Ollama (run: ollama pull deepseek-r1:7b)
  # - id: local-moe
  #   provider: ollama
  #   model: deepseek-r1:7b
  #   tags: [local, free, moe]

  # Cloud via OpenRouter (one key, access every model)
  - id: cloud-mini
    base_url: "https://openrouter.ai/api/v1"
    api_key: "\${OPENROUTER_API_KEY}"
    model: "anthropic/claude-haiku-3-5"
    cost_per_1m_input: 0.80
    cost_per_1m_output: 4.00
    tags: [cloud, cheap, fast]

judge:
  model: cloud-mini   # use any model id from above
  blind: true         # model names never shown to the judge
  rubric:
    accuracy: 0.4
    completeness: 0.4
    conciseness: 0.2

packs:
  - ./eval-packs/general.yaml

run:
  concurrency: 3
  retries: 2
  cache: true

output:
  dir: ./results
  formats: [json, markdown]
`

  const generalPack = `# eval-packs/general.yaml
name: General
version: 1.0.0
description: 10 general-purpose cases covering factual recall, reasoning, coding, and instruction following

cases:
  - id: gen-001
    prompt: "What is the capital of France?"
    criteria: "Single correct answer: Paris"
    tags: [factual, easy]

  - id: gen-002
    prompt: "What does RAM stand for and what does it do?"
    criteria: "Random Access Memory, volatile storage that holds running programs and data"
    tags: [factual, cs]

  - id: gen-003
    prompt: "Explain the difference between a process and a thread in one paragraph."
    criteria: "Covers: separate memory space vs shared, overhead difference, use cases for each"
    tags: [technical, cs]

  - id: gen-004
    prompt: "If all mammals are warm-blooded, and dolphins are mammals, what can we conclude about dolphins?"
    criteria: "Correct deductive conclusion: dolphins are warm-blooded. Clear reasoning shown."
    tags: [reasoning, logic]

  - id: gen-005
    prompt: "List exactly 3 benefits of regular exercise. Numbered list. Max 12 words per item."
    criteria: "Exactly 3 items, numbered list format, each under 12 words"
    tags: [instruction-following]

  - id: gen-006
    prompt: "Write a JavaScript function that returns the sum of all even numbers in an array."
    criteria: "Working JS function, handles empty array, filters even numbers with % 2 === 0, returns sum"
    tags: [coding, javascript]

  - id: gen-007
    prompt: "What is the time complexity of binary search and why?"
    criteria: "O(log n), correct explanation of halving the search space each iteration"
    tags: [cs, algorithms]

  - id: gen-008
    prompt: "Explain what a transformer model is in 2-3 sentences for a software engineer who knows ML basics."
    criteria: "Covers attention mechanism, parallel processing (vs RNN), why it improved NLP. Appropriate depth."
    tags: [ml, explanation]

  - id: gen-009
    prompt: "Write a haiku about debugging code."
    criteria: "5-7-5 syllable structure, references debugging or code, coherent meaning"
    tags: [creative, instruction-following]

  - id: gen-010
    prompt: "What is the CAP theorem and what does it mean for distributed systems design?"
    criteria: "Consistency, Availability, Partition tolerance, can only guarantee 2 of 3, tradeoffs for system design"
    tags: [cs, distributed-systems]
`

  const moePack = `# eval-packs/moe.yaml
name: MoE Benchmark
version: 1.0.0
description: Tasks that highlight Mixture-of-Experts model strengths. MoE models activate different experts per token, excelling at tasks that require switching between domains.

cases:
  - id: moe-001
    prompt: "Explain how mRNA vaccines work, then write a Python function that simulates a simple S-curve adoption model."
    criteria: "Correct mRNA mechanism (spike protein, immune training). Working Python S-curve function (sigmoid or logistic), accepts time parameter."
    tags: [multi-domain, biology, coding]

  - id: moe-002
    prompt: "Solve: if x^2 - 5x + 6 = 0, find x. Then describe one real-world system this equation could model."
    criteria: "Correct roots: x=2, x=3. Reasonable real-world application (spring, projectile, population model, etc.)"
    tags: [math, reasoning, applied]

  - id: moe-003
    prompt: "Translate this Python code to TypeScript, then explain the main type safety difference: def add(a, b): return a + b"
    criteria: "Correct TypeScript with type annotations (number params + return type). Explanation mentions static typing."
    tags: [coding, multi-language]

  - id: moe-004
    prompt: "Describe the French Revolution in 3 sentences, then identify 2 parallels to a modern political movement."
    criteria: "Historically accurate summary. Two specific, defensible modern parallels named."
    tags: [history, analysis, reasoning]

  - id: moe-005
    prompt: "Write a SQL query to find the top 3 customers by revenue from an orders table (customer_id, amount, date). Then explain what index would speed it up."
    criteria: "Correct SQL with GROUP BY, SUM, ORDER BY DESC, LIMIT 3. Reasonable index suggestion (customer_id or composite)."
    tags: [coding, sql, performance]
`

  fs.mkdirSync('./eval-packs', { recursive: true })
  fs.mkdirSync('./results', { recursive: true })
  fs.writeFileSync('./verdict.yaml', config)
  fs.writeFileSync('./eval-packs/general.yaml', generalPack)
  fs.writeFileSync('./eval-packs/moe.yaml', moePack)

  // Try to copy quantization.yaml from the package if available, else write inline stub
  const pkgQuantPath = new URL('../../../eval-packs/quantization.yaml', import.meta.url)
  try {
    const { readFileSync } = await import('fs')
    const quantContent = readFileSync(pkgQuantPath, 'utf8')
    fs.writeFileSync('./eval-packs/quantization.yaml', quantContent)
  } catch {
    // Package not installed (dev mode) - write a pointer comment
    fs.writeFileSync('./eval-packs/quantization.yaml',
      '# See https://github.com/hnshah/verdict/blob/main/eval-packs/quantization.yaml\n')
  }

  fs.writeFileSync('./.env.example',
    '# verdict environment variables\n' +
    'OPENROUTER_API_KEY=your_key_here\n' +
    '# OPENAI_API_KEY=sk-...\n' +
    '# GROQ_API_KEY=gsk_...\n' +
    '# OLLAMA_HOST=localhost:11434\n' +
    '# MLX_PORT=8080\n'
  )

  console.log(chalk.green('  verdict.yaml created'))
  console.log(chalk.green('  eval-packs/general.yaml (10 cases)'))
  console.log(chalk.green('  eval-packs/moe.yaml (5 MoE benchmark cases)'))
  console.log(chalk.green('  eval-packs/quantization.yaml (10 cases, deterministic JSON scoring)'))
  console.log(chalk.green('  .env.example'))
  console.log()
  console.log(chalk.bold('  Next:'))
  console.log(chalk.dim('  verdict models discover   # see what local models you have'))
  console.log(chalk.dim('  verdict models            # ping configured models'))
  console.log(chalk.dim('  verdict run               # run your first eval'))
  console.log()
}
