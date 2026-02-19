import { GoogleCloudLogging } from './google-cloud-logging'
import type {
  ErrorInfo,
  Formatter,
  FormatterName,
  LogContext,
  LoggerOptions,
  LogLevel,
  LogRecord,
  TraceContext,
} from './types'
import {
  defaultFormat,
  flattenError,
  isJsonMode,
  logLevelValues,
  stripAnsi,
  write,
} from './types'
import { VictoriaLogs } from './victoria-logs'

export type {
  ErrorInfo,
  Formatter,
  FormatterName,
  InterceptOptions,
  LogContext,
  LoggerOptions,
  LogLevel,
  LogRecord,
  TraceContext,
} from './types'
export { logLevelValues, stripAnsi } from './types'

const formatters: Record<FormatterName, Formatter> = {
  'google-cloud-logging': GoogleCloudLogging,
  'victoria-logs': VictoriaLogs,
}
const defaultFormatter =
  (defaultFormat && formatters[defaultFormat]) || GoogleCloudLogging

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

export class Logger {
  private ctx: LogContext
  private min: number
  private json: boolean
  private fmt: Formatter
  private tc?: () => TraceContext | undefined

  constructor(context?: LogContext, options?: LoggerOptions) {
    this.ctx = context || {}
    this.json = options?.json ?? defaultJson
    this.fmt = options?.formatter ?? defaultFormatter
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
        traceContext: this.tc,
      },
    )
    child.min = this.min
    return child
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: LogContext,
    err?: Error,
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
      if (record.error) flattenError(formatted, record.error)
      write(JSON.stringify(formatted), isErrorLevel[level])
    } else {
      this.logPlain(level, record)
    }
  }

  private logPlain(level: LogLevel, record: LogRecord): void {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      fatal: '\x1b[35m',
    }
    const reset = '\x1b[0m'
    const color = colors[level]

    const time = new Date(record.timestamp).toLocaleTimeString('en-US', {
      hour12: false,
    })
    const levelStr = level.toUpperCase().padEnd(5)

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

    const output = `${color}${time} ${levelStr}${reset} ${record.message}${metaStr}${errStr}`

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

  debug(message: string, meta?: LogContext): void {
    this.log('debug', message, meta)
  }

  info(message: string, meta?: LogContext): void {
    this.log('info', message, meta)
  }

  warn(message: string, meta?: LogContext): void {
    this.log('warn', message, meta)
  }

  error(message: string, meta?: LogContext, error?: Error): void {
    this.log('error', message, meta, error)
  }

  fatal(message: string, meta?: LogContext, error?: Error): void {
    this.log('fatal', message, meta, error)
  }
}

export const logger = new Logger()
