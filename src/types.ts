export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type LogContext = Record<string, unknown>

export type LogRecord = {
  level: LogLevel
  message: string
  timestamp: string
  context: LogContext
  error?: { name: string; message: string; stack?: string }
}

export type Formatter = {
  format: (record: LogRecord) => Record<string, unknown>
  messageKey: string
}

export type LoggerOptions = {
  formatter?: Formatter
  json?: boolean
  level?: LogLevel
}

export type InterceptOptions = {
  formatter?: Formatter
  filter?: (level: LogLevel, message: string) => boolean
  level?: LogLevel
}

export const logLevelValues: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: needed to strip ANSI color codes
const ansiPattern = /\x1b\[[0-9;]*m/g

export function stripAnsi(str: string): string {
  return str.replace(ansiPattern, '')
}

/**
 * Detect runtime and return the fastest available write functions.
 * Called once at module load — result is cached.
 */
function detectWriter(): (data: string, isError: boolean) => void {
  // Bun: process.stdout.write exists and is fast
  // Node.js: process.stdout.write exists
  // Deno: Deno.stdout.writeSync exists
  // Fallback: console.log/console.error

  if (
    typeof process !== 'undefined' &&
    process.stdout &&
    typeof process.stdout.write === 'function'
  ) {
    const stdout = process.stdout
    const stderr = process.stderr ?? stdout
    return (data, isError) => {
      if (isError) stderr.write(`${data}\n`)
      else stdout.write(`${data}\n`)
    }
  }

  // @ts-expect-error Deno global
  if (typeof Deno !== 'undefined' && Deno.stdout) {
    const encoder = new TextEncoder()
    // @ts-expect-error Deno global
    const stdout = Deno.stdout
    // @ts-expect-error Deno global
    const stderr = Deno.stderr ?? stdout
    return (data, isError) => {
      const bytes = encoder.encode(`${data}\n`)
      if (isError) stderr.writeSync(bytes)
      else stdout.writeSync(bytes)
    }
  }

  // Browser / unknown runtime fallback
  return (data, isError) => {
    if (isError) console.error(data)
    else console.log(data)
  }
}

export const write = detectWriter()
