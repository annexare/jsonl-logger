import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { Logger } from '../src/index'
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
