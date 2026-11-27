import { resolveFormatter } from './formatters.ts'
import { intercept } from './intercept.ts'
import { defaultFormat } from './types.ts'

if (defaultFormat) {
  const formatter = resolveFormatter(defaultFormat)
  const level =
    (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | 'fatal') ||
    'info'

  intercept({ formatter, level })
}
