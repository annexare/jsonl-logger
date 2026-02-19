import { GoogleCloudLogging } from './google-cloud-logging'
import { intercept } from './intercept'
import type { Formatter, FormatterName } from './types'
import { VictoriaLogs } from './victoria-logs'

const formatters: Record<FormatterName, Formatter> = {
  'google-cloud-logging': GoogleCloudLogging,
  'victoria-logs': VictoriaLogs,
}

const format = (process.env.LOG_FORMAT ||
  'google-cloud-logging') as FormatterName
const formatter = formatters[format] ?? GoogleCloudLogging
const level =
  (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | 'fatal') ||
  'info'

intercept({ formatter, level })
