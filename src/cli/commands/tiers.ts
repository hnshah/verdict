/**
 * `verdict tiers` — list hardware-tier presets.
 * `verdict tiers show <name>` — print the models a tier resolves to.
 */

import chalk from 'chalk'
import { TIERS, findTier } from '../../core/tiers.js'

export function tiersListCommand(): void {
  console.log()
  console.log(chalk.bold('  verdict') + chalk.dim(' tiers'))
  console.log()
  console.log(chalk.dim('  Hardware-tier presets — pass `--tier <name>` to `verdict run`.'))
  console.log()

  const colWidths = { name: 8, ram: 8, models: 8 }
  console.log(
    '  ' +
    chalk.dim('TIER'.padEnd(colWidths.name)) +
    chalk.dim('RAM'.padEnd(colWidths.ram)) +
    chalk.dim('MODELS'.padEnd(colWidths.models)) +
    chalk.dim('DESCRIPTION')
  )

  for (const tier of TIERS) {
    const aliasPart = tier.aliases && tier.aliases.length > 0
      ? chalk.dim(` (${tier.aliases.join(', ')})`)
      : ''
    console.log(
      '  ' +
      chalk.cyan(tier.name.padEnd(colWidths.name)) +
      chalk.white(`${tier.ram_gb}GB`.padEnd(colWidths.ram)) +
      chalk.white(String(tier.models.length).padEnd(colWidths.models)) +
      chalk.dim(tier.description) +
      aliasPart
    )
  }
  console.log()
  console.log(chalk.dim('  → ') + chalk.cyan('verdict tiers show 24gb') + chalk.dim(' to see what a tier resolves to'))
  console.log()
}

export function tiersShowCommand(name: string): void {
  const tier = findTier(name)
  if (!tier) {
    console.error(chalk.red(`  Unknown tier: ${name}`))
    console.error(chalk.dim(`  Run \`verdict tiers\` to see available presets.`))
    process.exit(1)
  }

  console.log()
  console.log(chalk.bold('  ' + tier.name) + chalk.dim(` · ${tier.description}`))
  if (tier.aliases && tier.aliases.length > 0) {
    console.log(chalk.dim(`  aliases: ${tier.aliases.join(', ')}`))
  }
  console.log()
  console.log(chalk.dim('  RAM envelope: ') + chalk.white(`~${tier.ram_gb} GB`))
  console.log(chalk.dim('  Judge:        ') + chalk.cyan(tier.judge_id))
  console.log()

  console.log(
    '  ' +
    chalk.dim('MODEL'.padEnd(28)) +
    chalk.dim('PROVIDER'.padEnd(12)) +
    chalk.dim('SIZE'.padEnd(10)) +
    chalk.dim('NOTES')
  )
  for (const m of tier.models) {
    console.log(
      '  ' +
      chalk.white(m.id.padEnd(28)) +
      chalk.cyan(m.provider.padEnd(12)) +
      chalk.white(`${m.size_gb} GB`.padEnd(10)) +
      chalk.dim(m.notes ?? '')
    )
  }

  if (tier.frontier && tier.frontier.length > 0) {
    console.log()
    console.log('  ' + chalk.yellow('frontier (benchmark-only — not for 24/7 use):'))
    for (const m of tier.frontier) {
      console.log(
        '  ' +
        chalk.white(m.id.padEnd(28)) +
        chalk.cyan(m.provider.padEnd(12)) +
        chalk.white(`${m.size_gb} GB`.padEnd(10)) +
        chalk.dim(m.notes ?? '')
      )
    }
  }

  console.log()
  console.log(chalk.dim('  Pull the missing ones with:'))
  const allModels = [...tier.models, ...(tier.frontier ?? [])]
  for (const m of allModels) {
    if (m.provider === 'ollama') {
      console.log(chalk.dim('    ollama pull ') + chalk.white(m.model))
    }
  }
  console.log()
  console.log(chalk.dim('  Then run:'))
  console.log('    ' + chalk.cyan(`verdict run --tier ${tier.name}`))
  if (tier.frontier && tier.frontier.length > 0) {
    console.log('    ' + chalk.cyan(`verdict run --tier ${tier.name} --frontier`) + chalk.dim('   # include frontier candidates'))
  }
  console.log()
}
