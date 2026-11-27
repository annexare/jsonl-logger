import type { ErrorInfo, Formatter, LogLevel, LogRecord } from './types'

// Pino's numeric levels (trace=10 has no equivalent here).
const levelMap: Record<LogLevel, number> = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

function pinoError(error: ErrorInfo): Record<string, unknown> {
  const err: Record<string, unknown> = {
    type: error.name,
    message: error.message,
  }
  if (error.stack) err.stack = error.stack
  if (error.cause) err.cause = pinoError(error.cause)
  return err
}

/**
 * Pino-compatible formatter — emits the line shape the Pino ecosystem
 * (pino-pretty, transports, processors) expects: numeric `level`, epoch-ms
 * `time`, `msg`, and a nested `err` object.
 *
 * `pid`/`hostname` are NOT added here — that keeps the library free of a
 * `node:os` import. Pino treats them as base bindings; supply them via the
 * logger context if you want them on every line:
 *
 *   import os from 'node:os'
 *   new Logger({ pid: process.pid, hostname: os.hostname() }, ...)
 */
export const Pino: Formatter = {
  messageKey: 'msg',
  format(record: LogRecord): Record<string, unknown> {
    const entry: Record<string, unknown> = {
      ...record.context,
      level: levelMap[record.level],
      time: Date.parse(record.timestamp),
      msg: record.message,
    }
    if (record.trace) {
      // Matches @opentelemetry/instrumentation-pino's injected fields.
      entry.trace_id = record.trace.traceId
      entry.span_id = record.trace.spanId
      if (record.trace.traceFlags !== undefined) {
        entry.trace_flags = record.trace.traceFlags
      }
    }
    if (record.error) entry.err = pinoError(record.error)
    return entry
  },
}
