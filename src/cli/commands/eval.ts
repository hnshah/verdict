import chalk from 'chalk'
import {
  registryAdd,
  registryRemove,
  registryList,
  registerBuiltinPacks,
  getRegistryPath,
} from '../../core/registry.js'

export async function evalAddCommand(name: string, packPath: string): Promise<void> {
  try {
    const abs = registryAdd(name, packPath)
    console.log(chalk.green(`  registered '${name}' → ${abs}`))
  } catch (err) {
    console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }
}

export async function evalRemoveCommand(name: string): Promise<void> {
  const removed = registryRemove(name)
  if (removed) {
    console.log(chalk.green(`  removed '${name}' from registry`))
  } else {
    console.error(chalk.red(`  '${name}' is not registered`))
    process.exit(1)
  }
}

export async function evalListCommand(): Promise<void> {
  const registry = registryList()
  const entries = Object.entries(registry)

  if (entries.length === 0) {
    console.log(chalk.dim('  no evals registered'))
    console.log(chalk.dim(`  run 'verdict eval add <name> <path>' to register one`))
    console.log(chalk.dim(`  or  'verdict eval init' to register built-in packs`))
    return
  }

  console.log()
  console.log(chalk.bold('  Registered evals'))
  console.log()
  for (const [name, packPath] of entries) {
    console.log(`  ${chalk.cyan(name.padEnd(30))} ${chalk.dim(packPath)}`)
  }
  console.log()
  console.log(chalk.dim(`  registry: ${getRegistryPath()}`))
  console.log()
}

export async function evalInitCommand(): Promise<void> {
  const added = registerBuiltinPacks()
  if (added > 0) {
    console.log(chalk.green(`  registered ${added} built-in eval pack(s)`))
  } else {
    console.log(chalk.dim('  all built-in packs already registered'))
  }
}
