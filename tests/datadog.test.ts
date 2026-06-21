import { describe, expect, test } from 'bun:test'

import { Datadog } from '../src/datadog'
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

describe('Datadog formatter', () => {
  test('messageKey is message', () => {
    expect(Datadog.messageKey).toBe('message')
  })

  test('formats basic record', () => {
    const out = Datadog.format(record())
    expect(out.status).toBe('info')
    expect(out.message).toBe('test')
    expect(out.timestamp).toBe('2025-01-01T00:00:00.000Z')
  })

  test('maps each level to a Datadog status', () => {
    const cases: [LogRecord['level'], string][] = [
      ['debug', 'debug'],
      ['info', 'info'],
      ['warn', 'warning'],
      ['error', 'error'],
      ['fatal', 'critical'],
    ]
    for (const [level, status] of cases) {
      expect(Datadog.format(record({ level })).status).toBe(status)
    }
  })

  test('includes context fields at top level', () => {
    const out = Datadog.format(
      record({ context: { userId: '42', env: 'prod' } }),
    )
    expect(out.userId).toBe('42')
    expect(out.env).toBe('prod')
  })

  test('context cannot override canonical fields', () => {
    const out = Datadog.format(
      record({
        message: 'real',
        context: { status: 'spoofed', message: 'spoofed', userId: '42' },
      }),
    )
    expect(out.message).toBe('real')
    expect(out.status).toBe('info')
    expect(out.userId).toBe('42')
  })

  test('maps trace to dd.trace_id / dd.span_id (pass-through)', () => {
    const out = Datadog.format(
      record({
        trace: { traceId: 'abc123', spanId: 'span456', traceFlags: 1 },
      }),
    )
    expect(out['dd.trace_id']).toBe('abc123')
    expect(out['dd.span_id']).toBe('span456')
  })

  test('no trace fields when record.trace is undefined', () => {
    const out = Datadog.format(record())
    expect(out['dd.trace_id']).toBeUndefined()
    expect(out['dd.span_id']).toBeUndefined()
  })

  test('maps error to error.kind / error.message / error.stack (incl. cause)', () => {
    const out = Datadog.format(
      record({
        error: {
          name: 'TypeError',
          message: 'boom',
          stack: 'TypeError: boom\n    at x',
          cause: { name: 'Error', message: 'root' },
        },
      }),
    )
    expect(out['error.kind']).toBe('TypeError')
    expect(out['error.message']).toBe('boom')
    expect(out['error.stack']).toBe('TypeError: boom\n    at x')
    expect(out['error.cause.kind']).toBe('Error')
    expect(out['error.cause.message']).toBe('root')
  })

  test('does not emit other formatters field names', () => {
    const out = Datadog.format(record({ error: { name: 'E', message: 'm' } }))
    expect(out.severity).toBeUndefined() // GCL
    expect(out._msg).toBeUndefined() // VL
    expect(out['log.level']).toBeUndefined() // ECS
    expect(out['error.name']).toBeUndefined() // Datadog uses error.kind
  })
})
