import { GoogleCloudLogging } from './google-cloud-logging'
import type {
  Formatter,
  LogContext,
  LoggerOptions,
  LogLevel,
  LogRecord,
} from './types'
import { logLevelValues, stripAnsi, write } from './types'

export type {
  Formatter,
  FormatterName,
  InterceptOptions,
  LogContext,
  LoggerOptions,
  LogLevel,
  LogRecord,
} from './types'
export { logLevelValues, stripAnsi } from './types'

const defaultJson = process.env.JSON_LOGS === 'true'
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

export class Logger {
  private ctx: LogContext
  private min: number
  private json: boolean
  private fmt: Formatter

  constructor(context?: LogContext, options?: LoggerOptions) {
    this.ctx = context || {}
    this.json = options?.json ?? defaultJson
    this.fmt = options?.formatter ?? GoogleCloudLogging
    const level: LogLevel = options?.level ?? defaultLevel
    this.min = logLevelValues[level] ?? logLevelValues.info
  }

  child(context: LogContext): Logger {
    const child = new Logger(
      { ...this.ctx, ...context },
      {
        json: this.json,
        formatter: this.fmt,
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

    if (err) {
      record.error = { name: err.name, message: err.message, stack: err.stack }
    }

    if (this.json) {
      write(JSON.stringify(this.fmt.format(record)), isErrorLevel[level])
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

    const errStr = record.error
      ? ` [${record.error.name}: ${record.error.message}]`
      : ''

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
