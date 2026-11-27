import { Datadog } from './datadog.ts'
import { ElasticCommonSchema } from './elastic-common-schema.ts'
import { GoogleCloudLogging } from './google-cloud-logging.ts'
import { Pino } from './pino.ts'
import type { Formatter, FormatterName } from './types.ts'
import { VictoriaLogs } from './victoria-logs.ts'

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
