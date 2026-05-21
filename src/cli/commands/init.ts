import fs from 'fs'
import readline from 'readline'
import chalk from 'chalk'
import { loadPrefs, enable, disable } from '../../utils/telemetry.js'
import {
  ENV_EXAMPLE,
  GENERAL_PACK,
  MOE_PACK,
  renderVerdictYaml,
} from '../../onboarding/templates.js'

/**
 * Render the default verdict.yaml that mirrors what users have seen in
 * `verdict init` historically: one local Ollama model (qwen2.5:7b) +
 * one cloud OpenRouter model (haiku-3-5), judge = cloud mini.
 *
 * The template is the same one used by `verdict onboarding` —
 * `src/onboarding/templates.ts` is the single source of truth.
 */
function defaultConfig(): string {
  return renderVerdictYaml({
    name: 'My Evals',
    ollamaModels: [
      { id: 'local-fast', model: 'qwen2.5:7b', tags: ['local', 'free', 'fast'] },
    ],
    cloudModels: [
      {
        id: 'cloud-mini',
        base_url: 'https://openrouter.ai/api/v1',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        model: 'anthropic/claude-haiku-3-5',
        costPer1mInput: 0.8,
        costPer1mOutput: 4.0,
        tags: ['cloud', 'cheap', 'fast'],
      },
    ],
    judgeModelId: 'cloud-mini',
  })
}

export async function initCommand(opts: { yes?: boolean; telemetry?: 'on' | 'off' }): Promise<void> {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' init'))
  console.log()

  if (fs.existsSync('./verdict.yaml') && !opts.yes) {
    console.log(chalk.yellow('  verdict.yaml already exists. Use --yes to overwrite.'))
    return
  }

  fs.mkdirSync('./eval-packs', { recursive: true })
  fs.mkdirSync('./results', { recursive: true })
  fs.writeFileSync('./verdict.yaml', defaultConfig())
  fs.writeFileSync('./eval-packs/general.yaml', GENERAL_PACK)
  fs.writeFileSync('./eval-packs/moe.yaml', MOE_PACK)

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

  fs.writeFileSync('./.env.example', ENV_EXAMPLE)

  console.log(chalk.green('  verdict.yaml created'))
  console.log(chalk.green('  eval-packs/general.yaml (10 cases)'))
  console.log(chalk.green('  eval-packs/moe.yaml (5 MoE benchmark cases)'))
  console.log(chalk.green('  eval-packs/quantization.yaml (10 cases, deterministic JSON scoring)'))
  console.log(chalk.green('  .env.example'))
  console.log()

  // Telemetry consent — opt-in, default off, one-time prompt.
  await maybePromptTelemetry(opts.telemetry)

  console.log(chalk.bold('  Next:'))
  console.log(chalk.dim('  verdict models discover   # see what local models you have'))
  console.log(chalk.dim('  verdict models            # ping configured models'))
  console.log(chalk.dim('  verdict run               # run your first eval'))
  console.log()
}

async function maybePromptTelemetry(flag?: 'on' | 'off'): Promise<void> {
  // Explicit flag wins, no prompt.
  if (flag === 'on') { enable(); console.log(chalk.dim('  telemetry: on (--telemetry on)')); return }
  if (flag === 'off') { disable(); console.log(chalk.dim('  telemetry: off (--telemetry off)')); return }

  // Already decided? Don't re-prompt.
  if (loadPrefs() !== null) return

  // Non-interactive (CI, no TTY)? Default to off, don't prompt.
  if (!process.stdin.isTTY) { disable(); return }

  console.log(chalk.bold('  Anonymous telemetry (opt-in)'))
  console.log(chalk.dim('  Help measure how many machines run Verdict. Per run we would send:'))
  console.log(chalk.dim('    install_id (random uuid), day, models_count, packs_count, version.'))
  console.log(chalk.dim('  Never sent: prompts, scores, model names, paths, hostnames.'))
  console.log(chalk.dim('  You can change this anytime with `verdict telemetry on|off`.'))
  const answer = await prompt('  Enable? [y/N]: ')
  if (/^y(es)?$/i.test(answer.trim())) {
    enable()
    console.log(chalk.green('  ✓ telemetry enabled'))
  } else {
    disable()
    console.log(chalk.dim('  telemetry: off'))
  }
  console.log()
}

function prompt(q: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(q, (ans) => { rl.close(); resolve(ans) })
  })
}
