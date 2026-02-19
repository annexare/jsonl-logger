import { describe, expect, test } from 'bun:test'

import { GoogleCloudLogging } from '../src/google-cloud-logging'
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

describe('GoogleCloudLogging formatter', () => {
  test('messageKey is message', () => {
    expect(GoogleCloudLogging.messageKey).toBe('message')
  })

  test('formats basic record', () => {
    const out = GoogleCloudLogging.format(record())
    expect(out.message).toBe('test')
    expect(out.timestamp).toBe('2025-01-01T00:00:00.000Z')
    expect(out.severity).toBe('INFO')
  })

  test('severity mapping', () => {
    const cases: [LogRecord['level'], string][] = [
      ['debug', 'DEBUG'],
      ['info', 'INFO'],
      ['warn', 'WARNING'],
      ['error', 'ERROR'],
      ['fatal', 'CRITICAL'],
    ]
    for (const [level, expected] of cases) {
      const out = GoogleCloudLogging.format(record({ level }))
      expect(out.severity).toBe(expected)
    }
  })

  test('includes context fields', () => {
    const out = GoogleCloudLogging.format(
      record({ context: { requestId: 'abc' } }),
    )
    expect(out.requestId).toBe('abc')
  })

  test('does not include _msg or _time fields', () => {
    const out = GoogleCloudLogging.format(record())
    expect(out._msg).toBeUndefined()
    expect(out._time).toBeUndefined()
  })

  test('includes GCL trace fields when record.trace is set', () => {
    const out = GoogleCloudLogging.format(
      record({
        trace: { traceId: 'abc123', spanId: 'span456', traceFlags: 1 },
      }),
    )
    expect(out['logging.googleapis.com/trace']).toBe('abc123')
    expect(out['logging.googleapis.com/spanId']).toBe('span456')
    expect(out['logging.googleapis.com/trace_sampled']).toBe(true)
  })

  test('trace_sampled is false when traceFlags bit 0 is unset', () => {
    const out = GoogleCloudLogging.format(
      record({ trace: { traceId: 'abc', spanId: 'def', traceFlags: 0 } }),
    )
    expect(out['logging.googleapis.com/trace_sampled']).toBe(false)
  })

  test('omits trace_sampled when traceFlags is undefined', () => {
    const out = GoogleCloudLogging.format(
      record({ trace: { traceId: 'abc', spanId: 'def' } }),
    )
    expect(out['logging.googleapis.com/trace']).toBe('abc')
    expect(out['logging.googleapis.com/spanId']).toBe('def')
    expect(out['logging.googleapis.com/trace_sampled']).toBeUndefined()
  })

  test('no trace fields when record.trace is undefined', () => {
    const out = GoogleCloudLogging.format(record())
    expect(out['logging.googleapis.com/trace']).toBeUndefined()
    expect(out['logging.googleapis.com/spanId']).toBeUndefined()
    expect(out['logging.googleapis.com/trace_sampled']).toBeUndefined()
  })
})
