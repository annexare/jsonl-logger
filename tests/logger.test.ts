import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { errorInfo, Logger } from '../src/index'
import { stripAnsi } from '../src/types'
import { VictoriaLogs } from '../src/victoria-logs'

let output: { stdout: string[]; stderr: string[] }

beforeEach(() => {
  output = { stdout: [], stderr: [] }
  // Mock process.stdout/stderr.write to capture output
  mock.module('../src/types', () => {
    const actual = require('../src/types')
    return {
      ...actual,
      write: (data: string, isError: boolean) => {
        if (isError) output.stderr.push(data)
        else output.stdout.push(data)
      },
    }
  })
})

afterEach(() => {
  mock.restore()
})

describe('Logger JSON mode', () => {
  test('info() writes JSON to stdout', () => {
    const logger = new Logger(undefined, { json: true })
    logger.info('Test message')

    expect(output.stdout.length).toBe(1)
    const parsed = JSON.parse(output.stdout[0])
    expect(parsed.message).toBe('Test message')
    expect(parsed.severity).toBe('INFO')
    expect(parsed.timestamp).toBeDefined()
  })

  test('error() writes JSON to stderr', () => {
    const logger = new Logger(undefined, { json: true })
    logger.error('Error message')

    expect(output.stderr.length).toBe(1)
    const parsed = JSON.parse(output.stderr[0])
    expect(parsed.message).toBe('Error message')
    expect(parsed.severity).toBe('ERROR')
  })

  test('fatal() writes JSON to stderr', () => {
    const logger = new Logger(undefined, { json: true })
    logger.fatal('Fatal message')

    expect(output.stderr.length).toBe(1)
    const parsed = JSON.parse(output.stderr[0])
    expect(parsed.message).toBe('Fatal message')
  })

  test('warn() writes JSON to stdout', () => {
    const logger = new Logger(undefined, { json: true })
    logger.warn('Warning')

    // warn goes to stdout via write() (not stderr — it's not error-level)
    // Actually warn is not in isErrorLevel, but let me check the code
    // isErrorLevel = { debug: false, info: false, warn: false, error: true, fatal: true }
    expect(output.stdout.length).toBe(1)
  })

  test('debug() writes when level allows', () => {
    const logger = new Logger(undefined, { json: true, level: 'debug' })
    logger.debug('Debug message')

    expect(output.stdout.length).toBe(1)
    const parsed = JSON.parse(output.stdout[0])
    expect(parsed.message).toBe('Debug message')
  })

  test('strips ANSI codes', () => {
    const logger = new Logger(undefined, { json: true })
    logger.info('\x1b[31mRed text\x1b[0m')

    const parsed = JSON.parse(output.stdout[0])
    expect(parsed.message).toBe('Red text')
  })

  test('includes metadata', () => {
    const logger = new Logger(undefined, { json: true })
    logger.info('Login', { userId: '123', role: 'admin' })

    const parsed = JSON.parse(output.stdout[0])
    expect(parsed.userId).toBe('123')
    expect(parsed.role).toBe('admin')
  })

  test('error() includes error details', () => {
    const logger = new Logger(undefined, { json: true })
    const err = new Error('Something went wrong')
    logger.error('Operation failed', { op: 'test' }, err)

    const parsed = JSON.parse(output.stderr[0])
    expect(parsed['error.name']).toBe('Error')
    expect(parsed['error.message']).toBe('Something went wrong')
    expect(parsed['error.stack']).toBeDefined()
  })

  test('fatal() includes error details', () => {
    const logger = new Logger(undefined, { json: true })
    const err = new Error('Critical')
    logger.fatal('Crash', { component: 'db' }, err)

    const parsed = JSON.parse(output.stderr[0])
    expect(parsed['error.name']).toBe('Error')
    expect(parsed['error.message']).toBe('Critical')
    expect(parsed.component).toBe('db')
  })

  test('uses custom formatter', () => {
    const logger = new Logger(undefined, {
      json: true,
      formatter: VictoriaLogs,
    })
    logger.info('VL test')

    const parsed = JSON.parse(output.stdout[0])
    expect(parsed._msg).toBe('VL test')
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBeUndefined()
  })
})

describe('Logger plain mode', () => {
  let consoleSpy: Record<string, ReturnType<typeof mock>>

  beforeEach(() => {
    consoleSpy = {
      log: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }
    console.log = consoleSpy.log
    console.debug = consoleSpy.debug
    console.warn = consoleSpy.warn
    console.error = consoleSpy.error
  })

  test('info() outputs colored format', () => {
    const logger = new Logger(undefined, { json: false })
    logger.info('Dev message')

    expect(consoleSpy.log).toHaveBeenCalled()
    const out = consoleSpy.log.mock.calls[0]?.[0] as string
    expect(out).toContain('Dev message')
    expect(out).toContain('\x1b[')
  })

  test('warn() uses console.warn', () => {
    const logger = new Logger(undefined, { json: false })
    logger.warn('Warning')

    expect(consoleSpy.warn).toHaveBeenCalled()
  })

  test('error() uses console.error', () => {
    const logger = new Logger(undefined, { json: false })
    logger.error('Error')

    expect(consoleSpy.error).toHaveBeenCalled()
  })

  test('debug() uses console.debug', () => {
    const logger = new Logger(undefined, { json: false, level: 'debug' })
    logger.debug('Debug')

    expect(consoleSpy.debug).toHaveBeenCalled()
  })

  test('includes metadata in output', () => {
    const logger = new Logger(undefined, { json: false })
    logger.info('With meta', { key: 'value' })

    const out = consoleSpy.log.mock.calls[0]?.[0] as string
    expect(out).toContain('key')
    expect(out).toContain('value')
  })
})

describe('log level filtering', () => {
  test('debug is filtered at info level', () => {
    const logger = new Logger(undefined, { json: true, level: 'info' })
    logger.debug('Should not appear')

    expect(output.stdout.length).toBe(0)
    expect(output.stderr.length).toBe(0)
  })

  test('info is filtered at warn level', () => {
    const logger = new Logger(undefined, { json: true, level: 'warn' })
    logger.info('Should not appear')

    expect(output.stdout.length).toBe(0)
  })

  test('warn passes at warn level', () => {
    const logger = new Logger(undefined, { json: true, level: 'warn' })
    logger.warn('Should appear')

    expect(output.stdout.length).toBe(1)
  })
})

describe('child logger', () => {
  test('inherits context', () => {
    const logger = new Logger(undefined, { json: true })
    const child = logger.child({ requestId: 'abc-123' })
    child.info('Request started')

    const parsed = JSON.parse(output.stdout[0])
    expect(parsed.message).toBe('Request started')
    expect(parsed.requestId).toBe('abc-123')
  })

  test('merges nested context', () => {
    const logger = new Logger(undefined, { json: true })
    const child1 = logger.child({ service: 'api' })
    const child2 = child1.child({ requestId: 'xyz' })
    child2.info('Nested')

    const parsed = JSON.parse(output.stdout[0])
    expect(parsed.service).toBe('api')
    expect(parsed.requestId).toBe('xyz')
  })

  test('inherits json setting', () => {
    const logger = new Logger(undefined, { json: true })
    const child = logger.child({ service: 'api' })
    child.info('Test')

    expect(output.stdout.length).toBe(1)
    // Should be valid JSON (not plain text)
    expect(() => JSON.parse(output.stdout[0])).not.toThrow()
  })

  test('inherits formatter', () => {
    const logger = new Logger(undefined, {
      json: true,
      formatter: VictoriaLogs,
    })
    const child = logger.child({ service: 'api' })
    child.info('Test')

    const parsed = JSON.parse(output.stdout[0])
    expect(parsed._msg).toBe('Test')
    expect(parsed.level).toBe('info')
  })
})

describe('errorInfo()', () => {
  test('extracts name, message, stack', () => {
    const err = new Error('boom')
    const info = errorInfo(err)
    expect(info.name).toBe('Error')
    expect(info.message).toBe('boom')
    expect(info.stack).toBeDefined()
    expect(info.cause).toBeUndefined()
  })

  test('extracts cause chain', () => {
    const inner = new Error('root cause')
    const outer = new Error('wrapper', { cause: inner })
    const info = errorInfo(outer)
    expect(info.name).toBe('Error')
    expect(info.message).toBe('wrapper')
    expect(info.cause).toBeDefined()
    expect(info.cause!.name).toBe('Error')
    expect(info.cause!.message).toBe('root cause')
    expect(info.cause!.stack).toBeDefined()
    expect(info.cause!.cause).toBeUndefined()
  })

  test('ignores non-Error cause', () => {
    const err = new Error('with string cause', { cause: 'not an error' })
    const info = errorInfo(err)
    expect(info.cause).toBeUndefined()
  })

  test('extracts deep cause chain (3 levels)', () => {
    const c = new Error('root')
    const b = new Error('middle', { cause: c })
    const a = new Error('top', { cause: b })
    const info = errorInfo(a)
    expect(info.message).toBe('top')
    expect(info.cause!.message).toBe('middle')
    expect(info.cause!.cause!.message).toBe('root')
    expect(info.cause!.cause!.cause).toBeUndefined()
  })

  test('handles circular cause chain without crashing', () => {
    const a = new Error('A')
    const b = new Error('B', { cause: a })
    // Create cycle: a.cause -> b -> a -> ...
    a.cause = b
    const info = errorInfo(a)
    expect(info.name).toBe('Error')
    expect(info.message).toBe('A')
    expect(info.cause).toBeDefined()
    expect(info.cause!.message).toBe('B')
    // Cycle broken — b's cause (a) was already visited
    expect(info.cause!.cause).toBeUndefined()
  })
})

describe('JSON mode error.cause', () => {
  test('error() includes cause in JSON output', () => {
    const logger = new Logger(undefined, { json: true })
    const inner = new Error('db connection failed')
    const outer = new Error('query failed', { cause: inner })
    logger.error('Operation failed', undefined, outer)

    const parsed = JSON.parse(output.stderr[0])
    expect(parsed['error.name']).toBe('Error')
    expect(parsed['error.message']).toBe('query failed')
    expect(parsed['error.cause.name']).toBe('Error')
    expect(parsed['error.cause.message']).toBe('db connection failed')
    expect(parsed['error.cause.stack']).toBeDefined()
  })

  test('flattens 3-level cause chain', () => {
    const logger = new Logger(undefined, { json: true })
    const c = new Error('root')
    const b = new Error('middle', { cause: c })
    const a = new Error('top', { cause: b })
    logger.error('deep', undefined, a)

    const parsed = JSON.parse(output.stderr[0])
    expect(parsed['error.message']).toBe('top')
    expect(parsed['error.cause.message']).toBe('middle')
    expect(parsed['error.cause.cause.message']).toBe('root')
    expect(parsed['error.cause.cause.cause.name']).toBeUndefined()
  })

  test('includes cause fields with VictoriaLogs formatter', () => {
    const logger = new Logger(undefined, {
      json: true,
      formatter: VictoriaLogs,
    })
    const inner = new Error('db failed')
    const outer = new Error('query failed', { cause: inner })
    logger.error('Op failed', undefined, outer)

    const parsed = JSON.parse(output.stderr[0])
    expect(parsed._msg).toBe('Op failed')
    expect(parsed['error.name']).toBe('Error')
    expect(parsed['error.message']).toBe('query failed')
    expect(parsed['error.cause.name']).toBe('Error')
    expect(parsed['error.cause.message']).toBe('db failed')
  })

  test('error without cause omits cause fields', () => {
    const logger = new Logger(undefined, { json: true })
    logger.error('simple error', undefined, new Error('oops'))

    const parsed = JSON.parse(output.stderr[0])
    expect(parsed['error.name']).toBe('Error')
    expect(parsed['error.cause.name']).toBeUndefined()
  })
})

describe('trace context', () => {
  const traceContext = () => ({
    traceId: 'abc123',
    spanId: 'span456',
    traceFlags: 1,
  })

  test('trace fields appear in JSON output when getter returns a value', () => {
    const logger = new Logger(undefined, { json: true, traceContext })
    logger.info('traced')

    const parsed = JSON.parse(output.stdout[0])
    expect(parsed['logging.googleapis.com/trace']).toBe('abc123')
    expect(parsed['logging.googleapis.com/spanId']).toBe('span456')
    expect(parsed['logging.googleapis.com/trace_sampled']).toBe(true)
  })

  test('trace fields absent when getter returns undefined', () => {
    const logger = new Logger(undefined, {
      json: true,
      traceContext: () => undefined,
    })
    logger.info('no trace')

    const parsed = JSON.parse(output.stdout[0])
    expect(parsed['logging.googleapis.com/trace']).toBeUndefined()
    expect(parsed['logging.googleapis.com/spanId']).toBeUndefined()
  })

  test('child logger inherits traceContext', () => {
    const logger = new Logger(undefined, { json: true, traceContext })
    const child = logger.child({ service: 'api' })
    child.info('child traced')

    const parsed = JSON.parse(output.stdout[0])
    expect(parsed['logging.googleapis.com/trace']).toBe('abc123')
    expect(parsed.service).toBe('api')
  })

  test('traceContext not called when level is filtered out', () => {
    let called = false
    const logger = new Logger(undefined, {
      json: true,
      level: 'warn',
      traceContext: () => {
        called = true
        return { traceId: 'x', spanId: 'y' }
      },
    })
    logger.debug('filtered')

    expect(called).toBe(false)
    expect(output.stdout.length).toBe(0)
  })
})

describe('plain mode stack traces', () => {
  let consoleSpy: Record<string, ReturnType<typeof mock>>

  beforeEach(() => {
    consoleSpy = {
      log: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }
    console.log = consoleSpy.log
    console.debug = consoleSpy.debug
    console.warn = consoleSpy.warn
    console.error = consoleSpy.error
  })

  test('error() shows stack trace in plain mode', () => {
    const logger = new Logger(undefined, { json: false })
    const err = new Error('something broke')
    logger.error('Handler failed', undefined, err)

    const out = consoleSpy.error.mock.calls[0]?.[0] as string
    expect(out).toContain('Handler failed')
    expect(out).toContain('Error: something broke')
    expect(out).toContain('at ')
  })

  test('error() shows cause chain in plain mode', () => {
    const logger = new Logger(undefined, { json: false })
    const inner = new Error('ECONNREFUSED')
    const outer = new Error('fetch failed', { cause: inner })
    logger.error('API error', undefined, outer)

    const out = consoleSpy.error.mock.calls[0]?.[0] as string
    expect(out).toContain('API error')
    expect(out).toContain('Error: fetch failed')
    expect(out).toContain('Caused by:')
    expect(out).toContain('ECONNREFUSED')
  })

  test('shows full cause chain (3 levels) in plain mode', () => {
    const logger = new Logger(undefined, { json: false })
    const c = new Error('root')
    const b = new Error('middle', { cause: c })
    const a = new Error('top', { cause: b })
    logger.error('Deep error', undefined, a)

    const out = consoleSpy.error.mock.calls[0]?.[0] as string
    expect(out).toContain('Error: top')
    expect(out).toContain('Caused by:')
    expect(out).toContain('middle')
    expect(out).toContain('root')
  })

  test('error without stack shows name: message fallback', () => {
    const logger = new Logger(undefined, { json: false })
    const err = new Error('no stack')
    err.stack = undefined
    logger.error('Broken', undefined, err)

    const out = consoleSpy.error.mock.calls[0]?.[0] as string
    expect(out).toContain('Error: no stack')
  })
})

describe('icon labels (default)', () => {
  let consoleSpy: Record<string, ReturnType<typeof mock>>

  beforeEach(() => {
    consoleSpy = {
      log: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }
    console.log = consoleSpy.log
    console.debug = consoleSpy.debug
    console.warn = consoleSpy.warn
    console.error = consoleSpy.error
  })

  test('info() shows ● icon', () => {
    const logger = new Logger(undefined, { json: false })
    logger.info('Hello')

    const out = stripAnsi(consoleSpy.log.mock.calls[0]?.[0] as string)
    expect(out).toContain('● ')
    expect(out).toContain('Hello')
  })

  test('debug() shows ◆ icon', () => {
    const logger = new Logger(undefined, { json: false, level: 'debug' })
    logger.debug('Debug msg')

    const out = stripAnsi(consoleSpy.debug.mock.calls[0]?.[0] as string)
    expect(out).toContain('◆ ')
  })

  test('warn() shows ▲ icon', () => {
    const logger = new Logger(undefined, { json: false })
    logger.warn('Warn msg')

    const out = stripAnsi(consoleSpy.warn.mock.calls[0]?.[0] as string)
    expect(out).toContain('▲ ')
  })

  test('error() shows ✖ icon', () => {
    const logger = new Logger(undefined, { json: false })
    logger.error('Err msg')

    const out = stripAnsi(consoleSpy.error.mock.calls[0]?.[0] as string)
    expect(out).toContain('✖ ')
  })

  test('fatal() shows ‼ icon', () => {
    const logger = new Logger(undefined, { json: false })
    logger.fatal('Fatal msg')

    const out = stripAnsi(consoleSpy.error.mock.calls[0]?.[0] as string)
    expect(out).toContain('‼ ')
  })
})

describe('text labels', () => {
  let consoleSpy: Record<string, ReturnType<typeof mock>>

  beforeEach(() => {
    consoleSpy = {
      log: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }
    console.log = consoleSpy.log
    console.debug = consoleSpy.debug
    console.warn = consoleSpy.warn
    console.error = consoleSpy.error
  })

  test('info() shows INFO label', () => {
    const logger = new Logger(undefined, { json: false, labels: 'text' })
    logger.info('Hello')

    const out = stripAnsi(consoleSpy.log.mock.calls[0]?.[0] as string)
    expect(out).toContain('INFO ')
    expect(out).toContain('Hello')
  })

  test('warn() shows WARN label', () => {
    const logger = new Logger(undefined, { json: false, labels: 'text' })
    logger.warn('Warning')

    const out = stripAnsi(consoleSpy.warn.mock.calls[0]?.[0] as string)
    expect(out).toContain('WARN ')
  })

  test('error() shows ERROR label', () => {
    const logger = new Logger(undefined, { json: false, labels: 'text' })
    logger.error('Error')

    const out = stripAnsi(consoleSpy.error.mock.calls[0]?.[0] as string)
    expect(out).toContain('ERROR')
  })
})

describe('no labels (none)', () => {
  let consoleSpy: Record<string, ReturnType<typeof mock>>

  beforeEach(() => {
    consoleSpy = {
      log: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }
    console.log = consoleSpy.log
    console.debug = consoleSpy.debug
    console.warn = consoleSpy.warn
    console.error = consoleSpy.error
  })

  test('info() shows no icon or text label', () => {
    const logger = new Logger(undefined, { json: false, labels: 'none' })
    logger.info('Hello')

    const out = stripAnsi(consoleSpy.log.mock.calls[0]?.[0] as string)
    expect(out).not.toContain('●')
    expect(out).not.toContain('INFO')
    expect(out).toContain('Hello')
  })

  test('.log() also shows no label', () => {
    const logger = new Logger(undefined, { json: false, labels: 'none' })
    logger.log('Neutral')

    const out = stripAnsi(consoleSpy.log.mock.calls[0]?.[0] as string)
    expect(out).not.toContain('●')
    expect(out).not.toContain('INFO')
    expect(out).toContain('Neutral')
  })

  test('child inherits none labels', () => {
    const logger = new Logger(undefined, { json: false, labels: 'none' })
    const child = logger.child({ service: 'api' })
    child.warn('From child')

    const out = stripAnsi(consoleSpy.warn.mock.calls[0]?.[0] as string)
    expect(out).not.toContain('▲')
    expect(out).not.toContain('WARN')
    expect(out).toContain('From child')
  })
})

describe('.log() method', () => {
  let consoleSpy: Record<string, ReturnType<typeof mock>>

  beforeEach(() => {
    consoleSpy = {
      log: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }
    console.log = consoleSpy.log
    console.debug = consoleSpy.debug
    console.warn = consoleSpy.warn
    console.error = consoleSpy.error
  })

  test('shows 2-char pad (no icon) in icon mode', () => {
    const logger = new Logger(undefined, { json: false })
    logger.log('Neutral message')

    const out = consoleSpy.log.mock.calls[0]?.[0] as string
    const plain = stripAnsi(out)
    // Should not contain any level icons
    expect(plain).not.toContain('●')
    expect(plain).not.toContain('◆')
    expect(plain).not.toContain('▲')
    expect(plain).not.toContain('✖')
    expect(plain).not.toContain('‼')
    expect(plain).toContain('Neutral message')
    // After time there should be a single space (from format) + 1 space (levelStr) + reset + space + message
    // The levelStr is ' ' (1 space) so the gap between time and message is narrower
    expect(plain).toMatch(/\d{2}:\d{2}:\d{2}\s+Neutral message/)
  })

  test('shows 5-space pad in text mode', () => {
    const logger = new Logger(undefined, { json: false, labels: 'text' })
    logger.log('Neutral message')

    const out = consoleSpy.log.mock.calls[0]?.[0] as string
    const plain = stripAnsi(out)
    expect(plain).not.toContain('INFO')
    expect(plain).toContain('Neutral message')
    // 5 spaces for the label area
    expect(plain).toMatch(/\d{2}:\d{2}:\d{2}\s{5,}Neutral message/)
  })

  test('produces JSON with info severity in JSON mode', () => {
    const logger = new Logger(undefined, { json: true })
    logger.log('Neutral JSON')

    expect(output.stdout.length).toBe(1)
    const parsed = JSON.parse(output.stdout[0])
    expect(parsed.message).toBe('Neutral JSON')
    expect(parsed.severity).toBe('INFO')
  })

  test('includes metadata', () => {
    const logger = new Logger(undefined, { json: true })
    logger.log('With meta', { key: 'val' })

    const parsed = JSON.parse(output.stdout[0])
    expect(parsed.message).toBe('With meta')
    expect(parsed.key).toBe('val')
  })

  test('is filtered by log level', () => {
    const logger = new Logger(undefined, { json: true, level: 'warn' })
    logger.log('Should not appear')

    expect(output.stdout.length).toBe(0)
  })
})

describe('child logger labels', () => {
  let consoleSpy: Record<string, ReturnType<typeof mock>>

  beforeEach(() => {
    consoleSpy = {
      log: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }
    console.log = consoleSpy.log
    console.debug = consoleSpy.debug
    console.warn = consoleSpy.warn
    console.error = consoleSpy.error
  })

  test('child inherits text labels setting', () => {
    const logger = new Logger(undefined, { json: false, labels: 'text' })
    const child = logger.child({ service: 'api' })
    child.info('From child')

    const out = stripAnsi(consoleSpy.log.mock.calls[0]?.[0] as string)
    expect(out).toContain('INFO ')
    expect(out).toContain('From child')
  })

  test('child inherits icon labels setting', () => {
    const logger = new Logger(undefined, { json: false, labels: 'icon' })
    const child = logger.child({ service: 'api' })
    child.warn('From child')

    const out = stripAnsi(consoleSpy.warn.mock.calls[0]?.[0] as string)
    expect(out).toContain('▲ ')
  })
})
