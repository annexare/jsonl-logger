import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import type { LogLevel } from '../src/types'

describe('intercept', () => {
  let captured: { stdout: string[]; stderr: string[] }
  let originalLog: typeof console.log
  let originalInfo: typeof console.info
  let originalWarn: typeof console.warn
  let originalError: typeof console.error
  let originalDebug: typeof console.debug

  beforeEach(() => {
    captured = { stdout: [], stderr: [] }
    originalLog = console.log
    originalInfo = console.info
    originalWarn = console.warn
    originalError = console.error
    originalDebug = console.debug

    // Clear the guard so intercept can run again
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

  async function loadAndIntercept(options?: Record<string, unknown>) {
    // We need to dynamically import to get fresh module state
    // But since write is cached at module load, we mock it by patching the console methods after intercept
    const { intercept } = await import('../src/intercept')
    intercept(options as never)
  }

  test('overrides console methods', async () => {
    await loadAndIntercept()

    // After interception, console.log should not be the original
    expect(console.log).not.toBe(originalLog)
    expect(console.info).not.toBe(originalInfo)
    expect(console.warn).not.toBe(originalWarn)
    expect(console.error).not.toBe(originalError)
    expect(console.debug).not.toBe(originalDebug)
  })

  test('idempotent — second call is a no-op', async () => {
    await loadAndIntercept()
    const afterFirst = console.log

    // Call again
    const { intercept } = await import('../src/intercept')
    intercept()

    expect(console.log).toBe(afterFirst)
  })

  test('exports originalConsole', async () => {
    const { originalConsole } = await import('../src/intercept')
    expect(typeof originalConsole.log).toBe('function')
    expect(typeof originalConsole.error).toBe('function')
  })

  test('passes through already-formatted JSON (VictoriaLogs)', async () => {
    await loadAndIntercept()

    // Capture what write() produces by spying on process.stdout.write
    const writes: string[] = []
    const origWrite = process.stdout.write
    process.stdout.write = ((data: string) => {
      writes.push(data)
      return true
    }) as typeof process.stdout.write

    const json =
      '{"_msg":"hello","_time":"2025-01-01T00:00:00.000Z","level":"info"}'
    console.log(json)

    process.stdout.write = origWrite

    // Should pass through as-is (with trailing newline)
    expect(writes.length).toBe(1)
    expect(writes[0]).toBe(`${json}\n`)
  })

  test('passes through already-formatted JSON (Google Cloud)', async () => {
    const { googleCloud } = await import('../src/google-cloud')
    ;(globalThis as Record<string, unknown>).__jsonlLoggerIntercepted =
      undefined
    await loadAndIntercept({ formatter: googleCloud })

    const writes: string[] = []
    const origWrite = process.stdout.write
    process.stdout.write = ((data: string) => {
      writes.push(data)
      return true
    }) as typeof process.stdout.write

    const json =
      '{"message":"hello","timestamp":"2025-01-01T00:00:00.000Z","severity":"INFO"}'
    console.log(json)

    process.stdout.write = origWrite

    expect(writes.length).toBe(1)
    expect(writes[0]).toBe(`${json}\n`)
  })

  test('converts plain console.log to JSON', async () => {
    await loadAndIntercept()

    const writes: string[] = []
    const origWrite = process.stdout.write
    process.stdout.write = ((data: string) => {
      writes.push(data)
      return true
    }) as typeof process.stdout.write

    console.log('hello world')

    process.stdout.write = origWrite

    expect(writes.length).toBe(1)
    const parsed = JSON.parse(writes[0])
    expect(parsed._msg).toBe('hello world')
    expect(parsed.level).toBe('info')
  })

  test('console.error maps to error level', async () => {
    await loadAndIntercept()

    const writes: string[] = []
    const origWrite = process.stderr.write
    process.stderr.write = ((data: string) => {
      writes.push(data)
      return true
    }) as typeof process.stderr.write

    console.error('bad thing')

    process.stderr.write = origWrite

    expect(writes.length).toBe(1)
    const parsed = JSON.parse(writes[0])
    expect(parsed._msg).toBe('bad thing')
    expect(parsed.level).toBe('error')
  })

  test('filter option suppresses messages', async () => {
    ;(globalThis as Record<string, unknown>).__jsonlLoggerIntercepted =
      undefined

    const filter = (level: LogLevel, message: string) =>
      !message.includes('skip-me')

    const { intercept } = await import('../src/intercept')
    intercept({ filter })

    const writes: string[] = []
    const origWrite = process.stdout.write
    process.stdout.write = ((data: string) => {
      writes.push(data)
      return true
    }) as typeof process.stdout.write

    console.log('keep-me')
    console.log('skip-me please')

    process.stdout.write = origWrite

    expect(writes.length).toBe(1)
    const parsed = JSON.parse(writes[0])
    expect(parsed._msg).toBe('keep-me')
  })

  test('strips ANSI from intercepted output', async () => {
    await loadAndIntercept()

    const writes: string[] = []
    const origWrite = process.stdout.write
    process.stdout.write = ((data: string) => {
      writes.push(data)
      return true
    }) as typeof process.stdout.write

    console.log('\x1b[31mRed text\x1b[0m')

    process.stdout.write = origWrite

    const parsed = JSON.parse(writes[0])
    expect(parsed._msg).toBe('Red text')
  })

  test('extracts Error objects', async () => {
    await loadAndIntercept()

    const writes: string[] = []
    const origWrite = process.stderr.write
    process.stderr.write = ((data: string) => {
      writes.push(data)
      return true
    }) as typeof process.stderr.write

    console.error('failure', new Error('boom'))

    process.stderr.write = origWrite

    const parsed = JSON.parse(writes[0])
    expect(parsed['error.name']).toBe('Error')
    expect(parsed['error.message']).toBe('boom')
  })

  test('extracts metadata objects', async () => {
    await loadAndIntercept()

    const writes: string[] = []
    const origWrite = process.stdout.write
    process.stdout.write = ((data: string) => {
      writes.push(data)
      return true
    }) as typeof process.stdout.write

    console.log('event', { userId: '42' })

    process.stdout.write = origWrite

    const parsed = JSON.parse(writes[0])
    expect(parsed.userId).toBe('42')
  })
})
