import type { Formatter, LogRecord } from './types'
import { flattenError } from './types'

export const VictoriaLogs: Formatter = {
  messageKey: '_msg',
  format(record: LogRecord): Record<string, unknown> {
    const entry: Record<string, unknown> = {
      ...record.context,
      _msg: record.message,
      _time: record.timestamp,
      level: record.level,
    }
    if (record.trace) {
      entry.trace_id = record.trace.traceId
      entry.span_id = record.trace.spanId
      if (record.trace.traceFlags !== undefined) {
        entry.trace_flags = record.trace.traceFlags
      }
    }
    if (record.error) flattenError(entry, record.error)
    return entry
  },
}
