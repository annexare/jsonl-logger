# jsonl-logger

Lightweight JSON Lines logger with pluggable formatters. Modern ESM-only, zero dependencies, Bun-first, works on Node.js and Deno.

## Install

```bash
bun add jsonl-logger
# or
npm install jsonl-logger
```

## Quick Start

```typescript
import { logger } from 'jsonl-logger'

logger.info('Server started', { port: 3000 })
logger.error('Request failed', { path: '/api' }, new Error('timeout'))
```

## Formatters

Two built-in formatters for popular log backends:

### Google Cloud Logging (default)

```typescript
import { logger } from 'jsonl-logger'
// Output: {"message":"...","timestamp":"...","severity":"INFO",...}
```

### VictoriaLogs

```typescript
import { VictoriaLogs } from 'jsonl-logger/victoria-logs'
import { Logger } from 'jsonl-logger'

const logger = new Logger(undefined, { json: true, formatter: VictoriaLogs })
// Output: {"_msg":"...","_time":"...","level":"info",...}
```

### Custom Formatter

```typescript
import type { Formatter } from 'jsonl-logger'

const myFormatter: Formatter = {
  messageKey: 'msg',
  format: (record) => ({
    msg: record.message,
    ts: record.timestamp,
    lvl: record.level,
    ...record.context,
  }),
}
```

## Console Interception

Monkey-patch `console.*` methods to output structured JSON — captures logs from third-party libraries:

```typescript
import { intercept, originalConsole } from 'jsonl-logger/intercept'

intercept({
  // Optional: custom formatter (default: GoogleCloudLogging)
  formatter: VictoriaLogs,
  // Optional: filter out noisy messages
  filter: (level, message) => !message.includes('deprecation'),
  // Optional: minimum log level
  level: 'warn',
})

// Already-formatted JSON from the Logger class passes through unchanged
console.log('plain text') // → structured JSON
originalConsole.log('bypass interception')
```

## Preload (Next.js Standalone)

Auto-intercept from first line using `--preload`:

```bash
bun --preload jsonl-logger/preload server.js
```

Environment variables:
- `LOG_FORMAT` — `google-cloud-logging` (default) or `victoria-logs`
- `LOG_LEVEL` — `debug`, `info` (default), `warn`, `error`, `fatal`

## Child Loggers

```typescript
const requestLogger = logger.child({ requestId: 'abc-123', service: 'api' })
requestLogger.info('Processing request')
// All entries include requestId and service
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JSON_LOGS` | `false` | Enable JSON output (`true` for production) |
| `LOG_LEVEL` | `info`/`debug` | Minimum log level (defaults to `info` when JSON, `debug` otherwise) |
| `LOG_FORMAT` | `google-cloud-logging` | Formatter for preload module (`google-cloud-logging` or `victoria-logs`) |

## Runtime Detection

The logger auto-detects the runtime and uses the fastest available I/O:
- **Bun** / **Node.js** — `process.stdout.write` / `process.stderr.write` (bypasses console overhead)
- **Deno** — `Deno.stdout.writeSync` / `Deno.stderr.writeSync`
- **Browser / unknown** — falls back to `console.log` / `console.error`

## Exports

| Subpath | Export |
|---------|--------|
| `jsonl-logger` | `Logger`, `logger`, types |
| `jsonl-logger/google-cloud-logging` | `GoogleCloudLogging` formatter |
| `jsonl-logger/victoria-logs` | `VictoriaLogs` formatter |
| `jsonl-logger/intercept` | `intercept()`, `originalConsole` |
| `jsonl-logger/preload` | Side-effect auto-intercept |

## License

MIT
