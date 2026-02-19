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

export type FormatterName = 'google-cloud-logging' | 'victoria-logs'

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
 * Detect runtime once, resolve streams at call time.
 * Stream lookup is deferred so tests/runtime can replace process.stdout.
 */
const runtime: 'node' | 'deno' | 'browser' =
  typeof process !== 'undefined' &&
  process.stdout &&
  typeof process.stdout.write === 'function'
    ? 'node'
    : // @ts-expect-error Deno global
      typeof Deno !== 'undefined' && Deno.stdout
      ? 'deno'
      : 'browser'

const denoEncoder = runtime === 'deno' ? new TextEncoder() : null

export function write(data: string, isError: boolean): void {
  if (runtime === 'node') {
    const stream = isError ? (process.stderr ?? process.stdout) : process.stdout
    stream.write(`${data}\n`)
  } else if (runtime === 'deno' && denoEncoder) {
    const bytes = denoEncoder.encode(`${data}\n`)
    // @ts-expect-error Deno global
    if (isError) Deno.stderr.writeSync(bytes)
    // @ts-expect-error Deno global
    else Deno.stdout.writeSync(bytes)
  } else {
    if (isError) console.error(data)
    else console.log(data)
  }
}
