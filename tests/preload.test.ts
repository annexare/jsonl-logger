import { describe, expect, test } from 'bun:test'

describe('preload', () => {
  test('activates interception when LOG_FORMAT is set', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
        import './src/preload'
        // After preload, console.log should output structured JSON
        console.log('preload test')
        `,
      ],
      {
        env: { ...process.env, LOG_FORMAT: 'google-cloud-logging' },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    // Should be valid JSON with the GCL messageKey
    const parsed = JSON.parse(stdout.trim())
    expect(parsed.message).toBe('preload test')
    expect(parsed.severity).toBe('INFO')
  })

  test('uses VictoriaLogs formatter when LOG_FORMAT=victoria-logs', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
        import './src/preload'
        console.log('vl test')
        `,
      ],
      {
        env: { ...process.env, LOG_FORMAT: 'victoria-logs' },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    const parsed = JSON.parse(stdout.trim())
    expect(parsed._msg).toBe('vl test')
    expect(parsed.level).toBe('info')
  })

  test('is a no-op when LOG_FORMAT is unset', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
        import './src/preload'
        console.log('plain output')
        `,
      ],
      {
        env: { ...process.env, LOG_FORMAT: undefined },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    // Should be plain text, not JSON
    expect(stdout.trim()).toBe('plain output')
  })

  test('respects LOG_LEVEL in preload mode', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
        import './src/preload'
        console.debug('should be filtered')
        console.warn('should appear')
        `,
      ],
      {
        env: {
          ...process.env,
          LOG_FORMAT: 'google-cloud-logging',
          LOG_LEVEL: 'warn',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    await proc.exited

    // debug should be filtered out
    const allOutput = (stdout + stderr).trim()
    expect(allOutput).not.toContain('should be filtered')

    // warn is not error-level, so it goes to stdout via write()
    const parsed = JSON.parse(stdout.trim())
    expect(parsed.message).toBe('should appear')
    expect(parsed.severity).toBe('WARNING')
  })

  test('console.error goes to stderr in preload mode', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
        import './src/preload'
        console.error('error msg')
        `,
      ],
      {
        env: { ...process.env, LOG_FORMAT: 'google-cloud-logging' },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    await proc.exited

    // error level goes to stderr
    expect(stdout.trim()).toBe('')
    const parsed = JSON.parse(stderr.trim())
    expect(parsed.message).toBe('error msg')
    expect(parsed.severity).toBe('ERROR')
  })
})
