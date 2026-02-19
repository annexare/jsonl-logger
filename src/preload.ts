import { googleCloud } from './google-cloud'
import { intercept } from './intercept'
import type { Formatter } from './types'
import { victoriaLogs } from './victoria-logs'

const formatters: Record<string, Formatter> = {
  'victoria-logs': victoriaLogs,
  'google-cloud': googleCloud,
}

const format = process.env.LOG_FORMAT || 'victoria-logs'
const formatter = formatters[format] ?? victoriaLogs
const level =
  (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | 'fatal') ||
  'info'

intercept({ formatter, level })
