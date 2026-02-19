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

  test('includes error fields with dot notation', () => {
    const out = GoogleCloudLogging.format(
      record({
        error: {
          name: 'RangeError',
          message: 'out of bounds',
          stack: 'at bar:2',
        },
      }),
    )
    expect(out['error.name']).toBe('RangeError')
    expect(out['error.message']).toBe('out of bounds')
    expect(out['error.stack']).toBe('at bar:2')
  })

  test('does not include _msg or _time fields', () => {
    const out = GoogleCloudLogging.format(record())
    expect(out._msg).toBeUndefined()
    expect(out._time).toBeUndefined()
  })
})
