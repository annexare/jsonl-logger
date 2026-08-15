import { resolveFormatter } from './formatters'
import type {
  ErrorInfo,
  Formatter,
  LabelStyle,
  LogContext,
  LoggerOptions,
  LogLevel,
  LogRecord,
  TimeStyle,
  TraceContext,
} from './types'
import {
  defaultColors,
  defaultFormat,
  defaultLabelStyle,
  defaultTimeStyle,
  isJsonMode,
  logLevelValues,
  stripAnsi,
  write,
} from './types'

export type {
  ErrorInfo,
  Formatter,
  FormatterName,
  InterceptOptions,
  LabelStyle,
  LogContext,
  LoggerOptions,
  LogLevel,
  LogRecord,
  TimeStyle,
  TraceContext,
} from './types'
export { flattenError, logLevelValues, stripAnsi } from './types'

const defaultFormatter = resolveFormatter(defaultFormat)

const defaultJson = isJsonMode
const defaultLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ||
  (defaultJson ? 'info' : 'debug')

const isErrorLevel: Record<LogLevel, boolean> = {
  debug: false,
  info: false,
  warn: false,
  error: true,
  fatal: true,
}

function extractErrorInfo(err: Error, visited: WeakSet<Error>): ErrorInfo {
  visited.add(err)
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...(err.cause instanceof Error && !visited.has(err.cause)
      ? { cause: extractErrorInfo(err.cause, visited) }
      : {}),
  }
}

export function errorInfo(err: Error): ErrorInfo {
  return extractErrorInfo(err, new WeakSet())
}

const levelIcons: Record<LogLevel, string> = {
  debug: '◆',
  info: '●',
  warn: '▲',
  error: '✖',
  fatal: '‼',
}

const levelColors: Record<LogLevel, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
}
const resetColor = '\x1b[0m'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Render the plain-text timestamp prefix.
 * `iso` reuses the record's own UTC timestamp verbatim (matching JSON output);
 * `time` and `datetime` render in local time.
 */
function formatTimestamp(timestamp: string, style: TimeStyle): string {
  if (style === 'iso') return timestamp

  const date = new Date(timestamp)
  const time = date.toLocaleTimeString('en-US', { hour12: false })
  if (style === 'time') return time

  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  return `${day} ${time}`
}

export class Logger {
  private ctx: LogContext
  private min: number
  private json: boolean
  private fmt: Formatter
  private labels: LabelStyle
  private time: TimeStyle
  private colorize: boolean
  private tc?: () => TraceContext | undefined

  constructor(context?: LogContext, options?: LoggerOptions) {
    this.ctx = context || {}
    this.json = options?.json ?? defaultJson
    this.fmt = options?.formatter ?? defaultFormatter
    this.labels = options?.labels ?? defaultLabelStyle
    this.time = options?.time ?? defaultTimeStyle
    this.colorize = options?.colors ?? defaultColors
    this.tc = options?.traceContext
    const level: LogLevel = options?.level ?? defaultLevel
    this.min = logLevelValues[level] ?? logLevelValues.info
  }

  child(context: LogContext): Logger {
    const child = new Logger(
      { ...this.ctx, ...context },
      {
        json: this.json,
        formatter: this.fmt,
        labels: this.labels,
        time: this.time,
        colors: this.colorize,
        traceContext: this.tc,
      },
    )
    child.min = this.min
    return child
  }

  private emit(
    level: LogLevel,
    message: string,
    meta?: LogContext,
    err?: Error,
    neutral?: boolean,
  ): void {
    if (logLevelValues[level] < this.min) return

    const record: LogRecord = {
      level,
      message: this.json ? stripAnsi(message).trim() : message,
      timestamp: new Date().toISOString(),
      context: meta ? { ...this.ctx, ...meta } : this.ctx,
    }

    if (this.tc) {
      record.trace = this.tc()
    }

    if (err) {
      record.error = errorInfo(err)
    }

    if (this.json) {
      const formatted = this.fmt.format(record)
      write(JSON.stringify(formatted), isErrorLevel[level])
    } else {
      this.logPlain(level, record, neutral)
    }
  }

  private logPlain(
    level: LogLevel,
    record: LogRecord,
    neutral?: boolean,
  ): void {
    const color = this.colorize ? levelColors[level] : ''
    const reset = this.colorize ? resetColor : ''

    const time = formatTimestamp(record.timestamp, this.time)

    let label: string
    if (this.labels === 'none') {
      label = ''
    } else if (this.labels === 'text') {
      label = neutral ? '      ' : ` ${level.toUpperCase().padEnd(5)}`
    } else {
      label = neutral ? '  ' : ` ${levelIcons[level]}`
    }

    const ctx = record.context
    const metaStr = Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : ''

    let errStr = ''
    if (record.error) {
      let current: ErrorInfo | undefined = record.error
      let isRoot = true
      while (current) {
        if (current.stack) {
          errStr += isRoot
            ? `\n${current.stack}`
            : `\nCaused by: ${current.stack}`
        } else {
          errStr += isRoot
            ? `\n  ${current.name}: ${current.message}`
            : `\nCaused by: ${current.name}: ${current.message}`
        }
        current = current.cause
        isRoot = false
      }
    }

    const output = `${color}${time}${label}${reset} ${record.message}${metaStr}${errStr}`

    switch (level) {
      case 'debug':
        console.debug(output)
        break
      case 'warn':
        console.warn(output)
        break
      case 'error':
      case 'fatal':
        console.error(output)
        break
      default:
        console.log(output)
    }
  }

  log(message: string, meta?: LogContext): void {
    this.emit('info', message, meta, undefined, true)
  }

  debug(message: string, meta?: LogContext): void {
    this.emit('debug', message, meta)
  }

  info(message: string, meta?: LogContext): void {
    this.emit('info', message, meta)
  }

  warn(message: string, meta?: LogContext): void {
    this.emit('warn', message, meta)
  }

  error(message: string, meta?: LogContext, error?: Error): void {
    this.emit('error', message, meta, error)
  }

  fatal(message: string, meta?: LogContext, error?: Error): void {
    this.emit('fatal', message, meta, error)
  }
}

export const logger = new Logger()
