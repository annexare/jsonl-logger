import { resolveFormatter } from './formatters'
import { intercept } from './intercept'
import { defaultFormat } from './types'

if (defaultFormat) {
  const formatter = resolveFormatter(defaultFormat)
  const level =
    (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | 'fatal') ||
    'info'

  intercept({ formatter, level })
}
