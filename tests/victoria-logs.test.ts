import { describe, expect, test } from 'bun:test'

import type { LogRecord } from '../src/types'
import { VictoriaLogs } from '../src/victoria-logs'

function record(overrides?: Partial<LogRecord>): LogRecord {
  return {
    level: 'info',
    message: 'test',
    timestamp: '2025-01-01T00:00:00.000Z',
    context: {},
    ...overrides,
  }
}

describe('VictoriaLogs formatter', () => {
  test('messageKey is _msg', () => {
    expect(VictoriaLogs.messageKey).toBe('_msg')
  })

  test('formats basic record', () => {
    const out = VictoriaLogs.format(record())
    expect(out._msg).toBe('test')
    expect(out._time).toBe('2025-01-01T00:00:00.000Z')
    expect(out.level).toBe('info')
  })

  test('includes context fields at top level', () => {
    const out = VictoriaLogs.format(
      record({ context: { userId: '42', service: 'api' } }),
    )
    expect(out.userId).toBe('42')
    expect(out.service).toBe('api')
  })

  test('includes error fields with dot notation', () => {
    const out = VictoriaLogs.format(
      record({
        error: { name: 'TypeError', message: 'bad', stack: 'at foo:1' },
      }),
    )
    expect(out['error.name']).toBe('TypeError')
    expect(out['error.message']).toBe('bad')
    expect(out['error.stack']).toBe('at foo:1')
  })

  test('omits error.stack when undefined', () => {
    const out = VictoriaLogs.format(
      record({
        error: { name: 'Error', message: 'oops' },
      }),
    )
    expect(out['error.name']).toBe('Error')
    expect(out['error.stack']).toBeUndefined()
  })

  test('includes error.cause fields', () => {
    const out = VictoriaLogs.format(
      record({
        error: {
          name: 'Error',
          message: 'outer',
          stack: 'at foo:1',
          cause: {
            name: 'RangeError',
            message: 'inner',
            stack: 'at baz:3',
          },
        },
      }),
    )
    expect(out['error.cause.name']).toBe('RangeError')
    expect(out['error.cause.message']).toBe('inner')
    expect(out['error.cause.stack']).toBe('at baz:3')
  })

  test('omits error.cause fields when no cause', () => {
    const out = VictoriaLogs.format(
      record({
        error: { name: 'Error', message: 'no cause' },
      }),
    )
    expect(out['error.cause.name']).toBeUndefined()
  })

  test('all log levels are passed through', () => {
    for (const level of ['debug', 'info', 'warn', 'error', 'fatal'] as const) {
      const out = VictoriaLogs.format(record({ level }))
      expect(out.level).toBe(level)
    }
  })
})
