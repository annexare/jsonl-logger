import { resolveFormatter } from './formatters.js'
import { intercept } from './intercept.js'
import { defaultFormat } from './types.js'

if (defaultFormat) {
  const formatter = resolveFormatter(defaultFormat)
  const level =
    (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | 'fatal') ||
    'info'

  intercept({ formatter, level })
}
