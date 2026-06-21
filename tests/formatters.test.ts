import { describe, expect, test } from 'bun:test'

import { ElasticCommonSchema } from '../src/elastic-common-schema'
import { resolveFormatter } from '../src/formatters'
import { GoogleCloudLogging } from '../src/google-cloud-logging'
import { VictoriaLogs } from '../src/victoria-logs'

describe('resolveFormatter', () => {
  test('resolves each LOG_FORMAT name to its formatter', () => {
    expect(resolveFormatter('ecs')).toBe(ElasticCommonSchema)
    expect(resolveFormatter('google-cloud-logging')).toBe(GoogleCloudLogging)
    expect(resolveFormatter('victoria-logs')).toBe(VictoriaLogs)
  })

  test('falls back to GoogleCloudLogging when name is undefined', () => {
    expect(resolveFormatter(undefined)).toBe(GoogleCloudLogging)
  })
})
