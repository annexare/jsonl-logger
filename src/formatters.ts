import { Datadog } from './datadog'
import { ElasticCommonSchema } from './elastic-common-schema'
import { GoogleCloudLogging } from './google-cloud-logging'
import { Pino } from './pino'
import type { Formatter, FormatterName } from './types'
import { VictoriaLogs } from './victoria-logs'

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
