import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import type { Formatter, LogLevel, LogRecord } from '../src/types'

function createSpyFormatter(): Formatter & { records: LogRecord[] } {
  const records: LogRecord[] = []
  return {
    messageKey: '_msg',
    records,
    format(record: LogRecord) {
      records.push(record)
      return {
        _msg: record.message,
        _time: record.timestamp,
        level: record.level,
        ...record.context,
        ...(record.error
          ? {
              'error.name': record.error.name,
              'error.message': record.error.message,
            }
          : {}),
      }
    },
  }
}

describe('intercept', () => {
  let originalLog: typeof console.log
  let originalInfo: typeof console.info
  let originalWarn: typeof console.warn
  let originalError: typeof console.error
  let originalDebug: typeof console.debug

  beforeEach(() => {
    originalLog = console.log
    originalInfo = console.info
    originalWarn = console.warn
    originalError = console.error
    originalDebug = console.debug

    ;(globalThis as Record<string, unknown>).__jsonlLoggerIntercepted =
      undefined
  })

  afterEach(() => {
    console.log = originalLog
    console.info = originalInfo
    console.warn = originalWarn
    console.error = originalError
    console.debug = originalDebug
    ;(globalThis as Record<string, unknown>).__jsonlLoggerIntercepted =
      undefined
  })

  async function setupIntercept(options?: Record<string, unknown>) {
    const spy = createSpyFormatter()
    const { intercept } = await import('../src/intercept')
    intercept({ formatter: spy, ...options } as never)
    return spy
  }

  test('overrides console methods', async () => {
    await setupIntercept()

    expect(console.log).not.toBe(originalLog)
    expect(console.info).not.toBe(originalInfo)
    expect(console.warn).not.toBe(originalWarn)
    expect(console.error).not.toBe(originalError)
    expect(console.debug).not.toBe(originalDebug)
  })

  test('idempotent — second call is a no-op', async () => {
    await setupIntercept()
    const afterFirst = console.log

    const { intercept } = await import('../src/intercept')
    intercept()

    expect(console.log).toBe(afterFirst)
  })

  test('exports originalConsole', async () => {
    const { originalConsole } = await import('../src/intercept')
    expect(typeof originalConsole.log).toBe('function')
    expect(typeof originalConsole.error).toBe('function')
  })

  test('passes through already-formatted JSON', async () => {
    const spy = await setupIntercept()

    const json =
      '{"_msg":"hello","_time":"2025-01-01T00:00:00.000Z","level":"info"}'
    console.log(json)

    // Passthrough — formatter should NOT be called
    expect(spy.records.length).toBe(0)
  })

  test('passes through with Google Cloud messageKey', async () => {
    ;(globalThis as Record<string, unknown>).__jsonlLoggerIntercepted =
      undefined

    const records: LogRecord[] = []
    const gclSpy: Formatter & { records: LogRecord[] } = {
      messageKey: 'message',
      records,
      format(record: LogRecord) {
        records.push(record)
        return { message: record.message, severity: 'INFO' }
      },
    }

    const { intercept } = await import('../src/intercept')
    intercept({ formatter: gclSpy })

    const json =
      '{"message":"hello","timestamp":"2025-01-01T00:00:00.000Z","severity":"INFO"}'
    console.log(json)

    // Passthrough — formatter should NOT be called
    expect(gclSpy.records.length).toBe(0)
  })

  test('converts plain console.log to structured log', async () => {
    const spy = await setupIntercept()

    console.log('hello world')

    expect(spy.records.length).toBe(1)
    expect(spy.records[0].message).toBe('hello world')
    expect(spy.records[0].level).toBe('info')
  })

  test('console.error maps to error level', async () => {
    const spy = await setupIntercept()

    console.error('bad thing')

    expect(spy.records.length).toBe(1)
    expect(spy.records[0].message).toBe('bad thing')
    expect(spy.records[0].level).toBe('error')
  })

  test('filter option suppresses messages', async () => {
    ;(globalThis as Record<string, unknown>).__jsonlLoggerIntercepted =
      undefined

    const spy = createSpyFormatter()
    const filter = (_level: LogLevel, message: string) =>
      !message.includes('skip-me')

    const { intercept } = await import('../src/intercept')
    intercept({ formatter: spy, filter })

    console.log('keep-me')
    console.log('skip-me please')

    expect(spy.records.length).toBe(1)
    expect(spy.records[0].message).toBe('keep-me')
  })

  test('strips ANSI from intercepted output', async () => {
    const spy = await setupIntercept()

    console.log('\x1b[31mRed text\x1b[0m')

    expect(spy.records[0].message).toBe('Red text')
  })

  test('extracts Error objects', async () => {
    const spy = await setupIntercept()

    console.error('failure', new Error('boom'))

    expect(spy.records[0].error?.name).toBe('Error')
    expect(spy.records[0].error?.message).toBe('boom')
  })

  test('extracts metadata objects', async () => {
    const spy = await setupIntercept()

    console.log('event', { userId: '42' })

    expect(spy.records[0].context.userId).toBe('42')
  })
})
