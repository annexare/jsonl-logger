import { GoogleCloudLogging } from './google-cloud-logging'
import { errorInfo } from './index'
import type {
  Formatter,
  InterceptOptions,
  LogLevel,
  TraceContext,
} from './types'
import { logLevelValues, stripAnsi, write } from './types'

type ConsoleMethods = {
  log: typeof console.log
  info: typeof console.info
  warn: typeof console.warn
  error: typeof console.error
  debug: typeof console.debug
}

// Capture original methods once, before anything else runs
export const originalConsole: ConsoleMethods = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
}

function formatMessage(...args: unknown[]): string {
  let result = ''
  for (let i = 0; i < args.length; i++) {
    if (i > 0) result += ' '
    const arg = args[i]
    if (typeof arg === 'string') {
      result += stripAnsi(arg)
    } else if (arg instanceof Error) {
      result += arg.message
    } else {
      try {
        result += JSON.stringify(arg)
      } catch {
        result += String(arg)
      }
    }
  }
  return result.trim()
}

function extractMeta(...args: unknown[]): Record<string, unknown> | undefined {
  let merged: Record<string, unknown> | undefined
  for (const arg of args) {
    if (
      typeof arg === 'object' &&
      arg !== null &&
      !(arg instanceof Error) &&
      !Array.isArray(arg)
    ) {
      if (!merged) merged = {}
      Object.assign(merged, arg)
    }
  }
  return merged
}

function extractError(...args: unknown[]): Error | undefined {
  for (const arg of args) {
    if (arg instanceof Error) return arg
  }
}

const isErrorLevel = {
  debug: false,
  info: false,
  warn: false,
  error: true,
  fatal: true,
}

function createOverride(
  level: LogLevel,
  formatter: Formatter,
  minLevel: number,
  filter?: (level: LogLevel, message: string) => boolean,
  traceContext?: () => TraceContext | undefined,
): (...args: unknown[]) => void {
  const msgKey = `"${formatter.messageKey}"`

  return (...args: unknown[]) => {
    // Passthrough: already-formatted JSON from our Logger
    if (
      args.length === 1 &&
      typeof args[0] === 'string' &&
      args[0].charCodeAt(0) === 123 && // starts with '{'
      args[0].includes(msgKey)
    ) {
      write(args[0], isErrorLevel[level])
      return
    }

    if (logLevelValues[level] < minLevel) return

    const message = formatMessage(...args)

    if (filter && !filter(level, message)) return

    const meta = extractMeta(...args)
    const error = extractError(...args)

    const record = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: meta || {},
      error: error ? errorInfo(error) : undefined,
      trace: traceContext?.(),
    }

    const formatted = formatter.format(record)
    write(JSON.stringify(formatted), isErrorLevel[level])
  }
}

const guardKey = '__jsonlLoggerIntercepted'

export function intercept(options?: InterceptOptions): void {
  if ((globalThis as Record<string, unknown>)[guardKey]) return
  ;(globalThis as Record<string, unknown>)[guardKey] = true

  const formatter = options?.formatter ?? GoogleCloudLogging
  const minLevel = logLevelValues[options?.level ?? 'debug']
  const filter = options?.filter
  const traceContext = options?.traceContext

  const methodMap: [keyof ConsoleMethods, LogLevel][] = [
    ['log', 'info'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
    ['debug', 'debug'],
  ]

  for (const [method, level] of methodMap) {
    console[method] = createOverride(
      level,
      formatter,
      minLevel,
      filter,
      traceContext,
    )
  }
}
