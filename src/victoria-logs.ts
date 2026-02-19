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
    return entry
  },
}
