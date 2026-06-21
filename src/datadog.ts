import type { ErrorInfo, Formatter, LogLevel, LogRecord } from './types'

// Datadog log status (severity) names.
const statusMap: Record<LogLevel, string> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
  fatal: 'critical',
}

function flattenDatadogError(
  entry: Record<string, unknown>,
  error: ErrorInfo,
  prefix = 'error',
): void {
  entry[`${prefix}.kind`] = error.name
  entry[`${prefix}.message`] = error.message
  if (error.stack) entry[`${prefix}.stack`] = error.stack
  if (error.cause) flattenDatadogError(entry, error.cause, `${prefix}.cause`)
}

/**
 * Datadog formatter — stdout JSON for collection by the Datadog Agent.
 *
 * Trace/span IDs are emitted verbatim from the `traceContext` getter (no
 * conversion). Datadog APM log-trace correlation expects Datadog-format IDs:
 * dd-trace-js already supplies these, so its IDs correlate as-is. 128-bit hex
 * IDs from an OpenTelemetry SDK may need matching formats on both sides — see
 * the README. If conversion is ever needed, it would ship as a separate
 * `datadog-otel` formatter (its own `LOG_FORMAT` value), leaving this one as-is.
 */
export const Datadog: Formatter = {
  messageKey: 'message',
  format(record: LogRecord): Record<string, unknown> {
    const entry: Record<string, unknown> = {
      ...record.context,
      status: statusMap[record.level],
      message: record.message,
      timestamp: record.timestamp,
    }
    if (record.trace) {
      // Pass-through (see above). A future `datadog-otel` formatter would
      // convert OTel hex → Datadog decimal here instead.
      entry['dd.trace_id'] = record.trace.traceId
      entry['dd.span_id'] = record.trace.spanId
    }
    if (record.error) flattenDatadogError(entry, record.error)
    return entry
  },
}
