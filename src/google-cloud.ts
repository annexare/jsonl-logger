import type { Formatter, LogLevel, LogRecord } from './types'

const severityMap: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
}

export const googleCloud: Formatter = {
  messageKey: 'message',
  format(record: LogRecord): Record<string, unknown> {
    const entry: Record<string, unknown> = {
      message: record.message,
      timestamp: record.timestamp,
      severity: severityMap[record.level],
      ...record.context,
    }
    if (record.error) {
      entry['error.name'] = record.error.name
      entry['error.message'] = record.error.message
      if (record.error.stack) entry['error.stack'] = record.error.stack
    }
    return entry
  },
}
