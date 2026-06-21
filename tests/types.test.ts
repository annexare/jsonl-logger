import { describe, expect, test } from 'bun:test'

import { detectColors, logLevelValues, stripAnsi, write } from '../src/types'

describe('stripAnsi', () => {
  test('removes single ANSI color code', () => {
    expect(stripAnsi('\x1b[31mRed\x1b[0m')).toBe('Red')
  })

  test('removes multiple ANSI codes', () => {
    expect(stripAnsi('\x1b[1m\x1b[36mBold Cyan\x1b[0m')).toBe('Bold Cyan')
  })

  test('returns plain string unchanged', () => {
    expect(stripAnsi('no colors here')).toBe('no colors here')
  })

  test('handles empty string', () => {
    expect(stripAnsi('')).toBe('')
  })

  test('removes SGR codes with multiple parameters', () => {
    // e.g. \x1b[38;5;196m (256-color red)
    expect(stripAnsi('\x1b[38;5;196mColored\x1b[0m')).toBe('Colored')
  })
})

describe('logLevelValues', () => {
  test('has correct ordering', () => {
    expect(logLevelValues.debug).toBeLessThan(logLevelValues.info)
    expect(logLevelValues.info).toBeLessThan(logLevelValues.warn)
    expect(logLevelValues.warn).toBeLessThan(logLevelValues.error)
    expect(logLevelValues.error).toBeLessThan(logLevelValues.fatal)
  })

  test('contains all five levels', () => {
    const levels = Object.keys(logLevelValues)
    expect(levels).toEqual(['debug', 'info', 'warn', 'error', 'fatal'])
  })
})

describe('detectColors', () => {
  function withEnv(
    vars: { FORCE_COLOR?: string; NO_COLOR?: string },
    fn: () => void,
  ): void {
    const orig = {
      FORCE_COLOR: process.env.FORCE_COLOR,
      NO_COLOR: process.env.NO_COLOR,
    }
    const set = (key: 'FORCE_COLOR' | 'NO_COLOR', value?: string): void => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    set('FORCE_COLOR', vars.FORCE_COLOR)
    set('NO_COLOR', vars.NO_COLOR)
    try {
      fn()
    } finally {
      set('FORCE_COLOR', orig.FORCE_COLOR)
      set('NO_COLOR', orig.NO_COLOR)
    }
  }

  test('FORCE_COLOR=1 enables color', () => {
    withEnv({ FORCE_COLOR: '1' }, () => expect(detectColors()).toBe(true))
  })

  test('FORCE_COLOR=0 disables color', () => {
    withEnv({ FORCE_COLOR: '0' }, () => expect(detectColors()).toBe(false))
  })

  test('FORCE_COLOR takes precedence over NO_COLOR', () => {
    withEnv({ FORCE_COLOR: '1', NO_COLOR: '1' }, () =>
      expect(detectColors()).toBe(true),
    )
  })

  test('NO_COLOR disables color when FORCE_COLOR is unset', () => {
    withEnv({ NO_COLOR: '1' }, () => expect(detectColors()).toBe(false))
  })
})

describe('write', () => {
  test('writes to stdout via process.stdout.write', () => {
    const written: string[] = []
    const origWrite = process.stdout.write
    process.stdout.write = ((chunk: string) => {
      written.push(chunk)
      return true
    }) as typeof process.stdout.write

    write('hello', false)

    process.stdout.write = origWrite
    expect(written).toEqual(['hello\n'])
  })

  test('writes to stderr when isError=true', () => {
    const written: string[] = []
    const origWrite = process.stderr.write
    process.stderr.write = ((chunk: string) => {
      written.push(chunk)
      return true
    }) as typeof process.stderr.write

    write('error msg', true)

    process.stderr.write = origWrite
    expect(written).toEqual(['error msg\n'])
  })

  test('appends newline to output', () => {
    const written: string[] = []
    const origWrite = process.stdout.write
    process.stdout.write = ((chunk: string) => {
      written.push(chunk)
      return true
    }) as typeof process.stdout.write

    write('data', false)

    process.stdout.write = origWrite
    expect(written[0].endsWith('\n')).toBe(true)
  })
})
