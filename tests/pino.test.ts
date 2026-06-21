import { describe, expect, test } from 'bun:test'

import { Pino } from '../src/pino'
import type { LogRecord } from '../src/types'

function record(overrides?: Partial<LogRecord>): LogRecord {
  return {
    level: 'info',
    message: 'test',
    timestamp: '2025-01-01T00:00:00.000Z',
    context: {},
    ...overrides,
  }
}

describe('Pino formatter', () => {
  test('messageKey is msg', () => {
    expect(Pino.messageKey).toBe('msg')
  })

  test('formats basic record with the pino shape', () => {
    const out = Pino.format(record())
    expect(out.level).toBe(30)
    expect(out.time).toBe(Date.parse('2025-01-01T00:00:00.000Z'))
    expect(out.msg).toBe('test')
  })

  test('maps each level to a numeric pino level', () => {
    const cases: [LogRecord['level'], number][] = [
      ['debug', 20],
      ['info', 30],
      ['warn', 40],
      ['error', 50],
      ['fatal', 60],
    ]
    for (const [level, n] of cases) {
      expect(Pino.format(record({ level })).level).toBe(n)
    }
  })

  test('time is epoch milliseconds', () => {
    const iso = '2025-06-01T12:34:56.789Z'
    const out = Pino.format(record({ timestamp: iso }))
    expect(out.time).toBe(Date.parse(iso))
    expect(typeof out.time).toBe('number')
  })

  test('spreads context (e.g. pid/hostname bindings) at top level', () => {
    const out = Pino.format(
      record({ context: { pid: 123, hostname: 'box', foo: 'bar' } }),
    )
    expect(out.pid).toBe(123)
    expect(out.hostname).toBe('box')
    expect(out.foo).toBe('bar')
  })

  test('context cannot override canonical fields', () => {
    const out = Pino.format(
      record({
        message: 'real',
        context: { level: 'spoofed', msg: 'spoofed', time: 'spoofed' },
      }),
    )
    expect(out.level).toBe(30)
    expect(out.msg).toBe('real')
    expect(out.time).toBe(Date.parse('2025-01-01T00:00:00.000Z'))
  })

  test('maps trace to trace_id / span_id / trace_flags', () => {
    const out = Pino.format(
      record({ trace: { traceId: 'abc', spanId: 'def', traceFlags: 1 } }),
    )
    expect(out.trace_id).toBe('abc')
    expect(out.span_id).toBe('def')
    expect(out.trace_flags).toBe(1)
  })

  test('omits trace_flags when undefined', () => {
    const out = Pino.format(
      record({ trace: { traceId: 'abc', spanId: 'def' } }),
    )
    expect(out.trace_id).toBe('abc')
    expect(out.trace_flags).toBeUndefined()
  })

  test('nests error under err with type/message/stack and recursive cause', () => {
    const out = Pino.format(
      record({
        error: {
          name: 'TypeError',
          message: 'boom',
          stack: 'TypeError: boom\n    at x',
          cause: { name: 'Error', message: 'root' },
        },
      }),
    )
    const err = out.err as Record<string, unknown>
    expect(err.type).toBe('TypeError')
    expect(err.message).toBe('boom')
    expect(err.stack).toBe('TypeError: boom\n    at x')
    const cause = err.cause as Record<string, unknown>
    expect(cause.type).toBe('Error')
    expect(cause.message).toBe('root')
  })

  test('does not emit other formatters field names', () => {
    const out = Pino.format(record({ error: { name: 'E', message: 'm' } }))
    expect(out.message).toBeUndefined() // pino uses msg
    expect(out.severity).toBeUndefined()
    expect(out['error.kind']).toBeUndefined() // pino nests under err
    expect(typeof out.level).toBe('number') // numeric, not a string
  })
})
