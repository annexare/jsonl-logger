import { Datadog } from './datadog.js'
import { ElasticCommonSchema } from './elastic-common-schema.js'
import { GoogleCloudLogging } from './google-cloud-logging.js'
import { Pino } from './pino.js'
import type { Formatter, FormatterName } from './types.js'
import { VictoriaLogs } from './victoria-logs.js'

/** Registry of built-in JSON formatters, keyed by `LOG_FORMAT` value. */
export const formatters: Record<FormatterName, Formatter> = {
  datadog: Datadog,
  ecs: ElasticCommonSchema,
  'google-cloud-logging': GoogleCloudLogging,
  pino: Pino,
  'victoria-logs': VictoriaLogs,
}

/** Resolve a formatter by `LOG_FORMAT` name, falling back to GoogleCloudLogging. */
export function resolveFormatter(name?: FormatterName): Formatter {
  return (name && formatters[name]) || GoogleCloudLogging
}
