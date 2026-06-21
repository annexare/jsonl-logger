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

  test('context cannot override canonical fields', () => {
    const out = VictoriaLogs.format(
      record({
        message: 'real',
        context: { _msg: 'spoofed', level: 'spoofed', userId: '42' },
      }),
    )
    expect(out._msg).toBe('real')
    expect(out.level).toBe('info')
    expect(out.userId).toBe('42') // non-canonical context still passes through
  })

  test('all log levels are passed through', () => {
    for (const level of ['debug', 'info', 'warn', 'error', 'fatal'] as const) {
      const out = VictoriaLogs.format(record({ level }))
      expect(out.level).toBe(level)
    }
  })

  test('includes trace_id and span_id when record.trace is set', () => {
    const out = VictoriaLogs.format(
      record({
        trace: { traceId: 'abc123', spanId: 'span456', traceFlags: 1 },
      }),
    )
    expect(out.trace_id).toBe('abc123')
    expect(out.span_id).toBe('span456')
    expect(out.trace_flags).toBe(1)
  })

  test('omits trace_flags when undefined', () => {
    const out = VictoriaLogs.format(
      record({ trace: { traceId: 'abc', spanId: 'def' } }),
    )
    expect(out.trace_id).toBe('abc')
    expect(out.span_id).toBe('def')
    expect(out.trace_flags).toBeUndefined()
  })

  test('no trace fields when record.trace is undefined', () => {
    const out = VictoriaLogs.format(record())
    expect(out.trace_id).toBeUndefined()
    expect(out.span_id).toBeUndefined()
    expect(out.trace_flags).toBeUndefined()
  })

  test('flattens record.error into error.* fields', () => {
    const out = VictoriaLogs.format(
      record({
        error: {
          name: 'TypeError',
          message: 'boom',
          stack: 'TypeError: boom\n    at x',
          cause: { name: 'Error', message: 'root' },
        },
      }),
    )
    expect(out['error.name']).toBe('TypeError')
    expect(out['error.message']).toBe('boom')
    expect(out['error.stack']).toBe('TypeError: boom\n    at x')
    expect(out['error.cause.name']).toBe('Error')
    expect(out['error.cause.message']).toBe('root')
  })

  test('no error fields when record.error is undefined', () => {
    const out = VictoriaLogs.format(record())
    expect(out['error.name']).toBeUndefined()
    expect(out['error.message']).toBeUndefined()
  })
})
