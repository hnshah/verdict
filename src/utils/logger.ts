import chalk from 'chalk'

export type LogLevel = 'info' | 'verbose' | 'debug'

let currentLevel: LogLevel = 'info'

const levelPriority: Record<LogLevel, number> = {
  info: 0,
  verbose: 1,
  debug: 2,
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

export function getLogLevel(): LogLevel {
  return currentLevel
}

export function log(level: LogLevel, msg: string, data?: unknown): void {
  if (levelPriority[level] > levelPriority[currentLevel]) return

  const prefix = level === 'debug'
    ? chalk.magenta('[debug] ')
    : level === 'verbose'
      ? chalk.blue('[verbose] ')
      : ''

  process.stderr.write(`  ${prefix}${msg}\n`)

  if (data !== undefined && currentLevel === 'debug') {
    const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    const truncated = str.length > 500 ? str.slice(0, 500) + chalk.dim('... (truncated)') : str
    process.stderr.write(`  ${chalk.dim(truncated)}\n`)
  }
}
