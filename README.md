# jsonl-logger

Lightweight JSON Lines (JSONL) logger with pluggable formatters. Modern ESM-only, zero dependencies, Bun-first, works on Node.js and Deno.

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

Without `LOG_FORMAT`, the logger outputs colored plain text — ideal for local development. Set `LOG_FORMAT` to enable structured JSON for production (see Formatters below).

## Formatters

Set `LOG_FORMAT` to enable JSON output with a specific formatter:

### Google Cloud Logging

```bash
LOG_FORMAT=google-cloud-logging bun run server.ts
```

```typescript
// Output: {"message":"...","timestamp":"...","severity":"INFO",...}
```

### VictoriaLogs

```bash
LOG_FORMAT=victoria-logs bun run server.ts
```

```typescript
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

## Next.js Integration

The preload module reads `LOG_FORMAT` and only activates when it's set. Safe to include unconditionally — it's a no-op without `LOG_FORMAT`.

### Instrumentation

Next.js auto-detects `instrumentation.ts` at the project root. Use it to load the preload module on the server:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' || typeof Bun !== 'undefined') {
    await import('jsonl-logger/preload')
  }
}
```

### Dockerfile (Standalone with Bun)

Next.js standalone output doesn't include all `node_modules`. Copy `jsonl-logger` explicitly from the build stage:

```dockerfile
COPY --from=build /app/node_modules/jsonl-logger ./node_modules/jsonl-logger

ENV LOG_FORMAT=victoria-logs

CMD ["bun", "--preload", "jsonl-logger/preload", "server.js"]
```

### Node.js

For non-Bun deployments, use `--import` to preload:

```bash
LOG_FORMAT=google-cloud-logging node --import jsonl-logger/preload server.js
```

## Child Loggers

```typescript
const requestLogger = logger.child({ requestId: 'abc-123', service: 'api' })
requestLogger.info('Processing request')
// All entries include requestId and service
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_FORMAT` | _(unset)_ | Set to enable JSON: `google-cloud-logging` or `victoria-logs` |
| `LOG_LEVEL` | `info`/`debug` | Minimum log level (`info` when JSON, `debug` otherwise) |

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
