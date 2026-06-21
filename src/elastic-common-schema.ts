import type { ErrorInfo, Formatter, LogRecord } from './types'

// Pinned to the last stable ECS release before it merged into OTel SemConv.
const ECS_VERSION = '8.11.0'

function flattenEcsError(
  entry: Record<string, unknown>,
  error: ErrorInfo,
  prefix = 'error',
): void {
  entry[`${prefix}.type`] = error.name
  entry[`${prefix}.message`] = error.message
  if (error.stack) entry[`${prefix}.stack_trace`] = error.stack
  if (error.cause) flattenEcsError(entry, error.cause, `${prefix}.cause`)
}

/**
 * Elastic Common Schema formatter for the Elastic/ELK stack.
 * Emits stdout JSON shaped for Filebeat / Elastic Agent ingestion, using
 * flat dotted keys (Elastic expands them into nested objects on ingest).
 */
export const ElasticCommonSchema: Formatter = {
  messageKey: 'message',
  format(record: LogRecord): Record<string, unknown> {
    const entry: Record<string, unknown> = {
      ...record.context,
      '@timestamp': record.timestamp,
      'log.level': record.level,
      message: record.message,
      'ecs.version': ECS_VERSION,
    }
    if (record.trace) {
      entry['trace.id'] = record.trace.traceId
      entry['span.id'] = record.trace.spanId
    }
    if (record.error) flattenEcsError(entry, record.error)
    return entry
  },
}
