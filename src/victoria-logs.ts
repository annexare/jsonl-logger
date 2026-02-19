import type { Formatter, LogRecord } from './types'

export const VictoriaLogs: Formatter = {
  messageKey: '_msg',
  format(record: LogRecord): Record<string, unknown> {
    const entry: Record<string, unknown> = {
      _msg: record.message,
      _time: record.timestamp,
      level: record.level,
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
