import type { Formatter, LogLevel, LogRecord } from './types'

const severityMap: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
}

export const GoogleCloudLogging: Formatter = {
  messageKey: 'message',
  format(record: LogRecord): Record<string, unknown> {
    const entry: Record<string, unknown> = {
      message: record.message,
      timestamp: record.timestamp,
      severity: severityMap[record.level],
      ...record.context,
    }
    if (record.trace) {
      entry['logging.googleapis.com/trace'] = record.trace.traceId
      entry['logging.googleapis.com/spanId'] = record.trace.spanId
      if (record.trace.traceFlags !== undefined) {
        entry['logging.googleapis.com/trace_sampled'] =
          (record.trace.traceFlags & 1) === 1
      }
    }
    return entry
  },
}
