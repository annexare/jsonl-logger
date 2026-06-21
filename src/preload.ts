import { ElasticCommonSchema } from './elastic-common-schema'
import { GoogleCloudLogging } from './google-cloud-logging'
import { intercept } from './intercept'
import type { Formatter, FormatterName } from './types'
import { defaultFormat } from './types'
import { VictoriaLogs } from './victoria-logs'

if (defaultFormat) {
  const formatters: Record<FormatterName, Formatter> = {
    ecs: ElasticCommonSchema,
    'google-cloud-logging': GoogleCloudLogging,
    'victoria-logs': VictoriaLogs,
  }

  const formatter = formatters[defaultFormat] ?? GoogleCloudLogging
  const level =
    (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | 'fatal') ||
    'info'

  intercept({ formatter, level })
}
