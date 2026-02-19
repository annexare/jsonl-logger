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
    return entry
  },
}
