export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type LogContext = Record<string, unknown>

export type ErrorInfo = {
  name: string
  message: string
  stack?: string
  cause?: ErrorInfo
}

export type TraceContext = {
  traceId: string
  spanId: string
  traceFlags?: number
}

export type LogRecord = {
  level: LogLevel
  message: string
  timestamp: string
  context: LogContext
  error?: ErrorInfo
  trace?: TraceContext
}

export type Formatter = {
  format: (record: LogRecord) => Record<string, unknown>
  messageKey: string
}

export type LabelStyle = 'icon' | 'none' | 'text'

export const defaultLabelStyle: LabelStyle =
  (process.env.LOG_LABELS as LabelStyle) === 'text'
    ? 'text'
    : (process.env.LOG_LABELS as LabelStyle) === 'none'
      ? 'none'
      : 'icon'

export type LoggerOptions = {
  formatter?: Formatter
  json?: boolean
  labels?: LabelStyle
  level?: LogLevel
  traceContext?: () => TraceContext | undefined
}

export type FormatterName = 'ecs' | 'google-cloud-logging' | 'victoria-logs'

export const defaultFormat = process.env.LOG_FORMAT as FormatterName | undefined
export const isJsonMode = !!defaultFormat

export type InterceptOptions = {
  formatter?: Formatter
  filter?: (level: LogLevel, message: string) => boolean
  level?: LogLevel
  traceContext?: () => TraceContext | undefined
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

export function flattenError(
  entry: Record<string, unknown>,
  error: ErrorInfo,
  prefix = 'error',
): void {
  entry[`${prefix}.name`] = error.name
  entry[`${prefix}.message`] = error.message
  if (error.stack) entry[`${prefix}.stack`] = error.stack
  if (error.cause) flattenError(entry, error.cause, `${prefix}.cause`)
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
