import { describe, expect, test } from 'bun:test'

import { ElasticCommonSchema } from '../src/elastic-common-schema'
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

describe('ElasticCommonSchema formatter', () => {
  test('messageKey is message', () => {
    expect(ElasticCommonSchema.messageKey).toBe('message')
  })

  test('formats basic record with ECS fields', () => {
    const out = ElasticCommonSchema.format(record())
    expect(out['@timestamp']).toBe('2025-01-01T00:00:00.000Z')
    expect(out['log.level']).toBe('info')
    expect(out.message).toBe('test')
    expect(out['ecs.version']).toBe('8.11.0')
  })

  test('includes context fields at top level', () => {
    const out = ElasticCommonSchema.format(
      record({ context: { userId: '42', service: 'api' } }),
    )
    expect(out.userId).toBe('42')
    expect(out.service).toBe('api')
  })

  test('context cannot override canonical ECS fields', () => {
    const out = ElasticCommonSchema.format(
      record({
        message: 'real',
        context: {
          message: 'spoofed',
          'log.level': 'spoofed',
          'ecs.version': 'spoofed',
          userId: '42',
        },
      }),
    )
    expect(out.message).toBe('real')
    expect(out['log.level']).toBe('info')
    expect(out['ecs.version']).toBe('8.11.0')
    expect(out.userId).toBe('42') // non-canonical context still passes through
  })

  test('maps trace to trace.id and span.id', () => {
    const out = ElasticCommonSchema.format(
      record({
        trace: { traceId: 'abc123', spanId: 'span456', traceFlags: 1 },
      }),
    )
    expect(out['trace.id']).toBe('abc123')
    expect(out['span.id']).toBe('span456')
  })

  test('no trace fields when record.trace is undefined', () => {
    const out = ElasticCommonSchema.format(record())
    expect(out['trace.id']).toBeUndefined()
    expect(out['span.id']).toBeUndefined()
  })

  test('maps error to ECS error.type / error.stack_trace (incl. cause)', () => {
    const out = ElasticCommonSchema.format(
      record({
        error: {
          name: 'TypeError',
          message: 'boom',
          stack: 'TypeError: boom\n    at x',
          cause: { name: 'Error', message: 'root' },
        },
      }),
    )
    expect(out['error.type']).toBe('TypeError')
    expect(out['error.message']).toBe('boom')
    expect(out['error.stack_trace']).toBe('TypeError: boom\n    at x')
    expect(out['error.cause.type']).toBe('Error')
    expect(out['error.cause.message']).toBe('root')
  })

  test('does not emit GCL/VL error field names', () => {
    const out = ElasticCommonSchema.format(
      record({ error: { name: 'E', message: 'm' } }),
    )
    expect(out.severity).toBeUndefined()
    expect(out._msg).toBeUndefined()
    expect(out['error.name']).toBeUndefined() // ECS uses error.type
    expect(out['error.stack']).toBeUndefined() // ECS uses error.stack_trace
  })
})
