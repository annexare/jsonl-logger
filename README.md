[![Monthly Downloads](https://img.shields.io/npm/dm/jsonl-logger.svg)](https://www.npmjs.com/package/jsonl-logger)
[![NPM](https://img.shields.io/npm/v/jsonl-logger.svg 'NPM package version')](https://www.npmjs.com/package/jsonl-logger)
[![CI](https://github.com/annexare/jsonl-logger/actions/workflows/ci.yml/badge.svg)](https://github.com/annexare/jsonl-logger/actions/workflows/ci.yml)


# JSONL Logger

Lightweight JSON Lines logger with pluggable formatters (**Google Cloud Logging**, **VictoriaLogs**). Modern **ESM**-only, zero dependencies, Bun-first, works on Node.js and Deno.

Outputs **colored plain text** for local development and **structured JSON** (JSONL) for production — switched by a single `LOG_FORMAT` environment variable, with no code changes.

Next.js (and other hardcoded plain text logs) become JSON-only logging for systems where it is required.

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
logger.log('Neutral message', { note: 'no level icon' })
logger.error('Request failed', { path: '/api' }, new Error('timeout'))
```

## Output Modes

The active mode is selected by the `LOG_FORMAT` environment variable — no code changes required:

- **Plain text** (default, `LOG_FORMAT` unset) — colored, human-readable lines with a timestamp, level label, and inline context. Ideal for local development. `LOG_LEVEL` defaults to `debug`.
- **Structured JSON** (`LOG_FORMAT` set) — one JSON object per line (JSONL) shaped by the selected formatter. Ideal for production log pipelines. `LOG_LEVEL` defaults to `info`. See [Formatters](#formatters).

Plain-text output for the Quick Start example above:

```text
18:42:05 ● Server started {"port":3000}
18:42:05   Neutral message {"note":"no level icon"}
18:42:05 ✖ Request failed {"path":"/api"}
Error: timeout
    at handler (/app/server.ts:12:9)
```

### Label Styles

In plain-text mode, the per-level label is controlled by the `LOG_LABELS` environment variable or the `labels` constructor option (the option takes precedence):

| `LOG_LABELS` | Labels | Example line |
|--------------|--------|--------------|
| `icon` (default) | `◆` `●` `▲` `✖` `‼` | `18:42:05 ● Server started` |
| `text` | `DEBUG` `INFO` `WARN` `ERROR` `FATAL` | `18:42:05 INFO  Server started` |
| `none` | _(timestamp only)_ | `18:42:05 Server started` |

```typescript
import { Logger } from 'jsonl-logger'

const logger = new Logger({}, { labels: 'text' }) // overrides LOG_LABELS
```

The neutral `.log()` method always renders without an icon or text label — just blank padding where the label would sit — so level-less lines stay visually distinct from leveled ones (any `meta` context is still appended). In JSON mode these styles are ignored; labels apply to plain text only.

## Formatters

Set `LOG_FORMAT` to enable JSON output with a specific formatter:

### Google Cloud Logging

```bash
LOG_FORMAT=google-cloud-logging bun run server.ts
# Output: {"message":"...","timestamp":"...","severity":"INFO",...}
```

### VictoriaLogs

```bash
LOG_FORMAT=victoria-logs bun run server.ts
# Output: {"_msg":"...","_time":"...","level":"info",...}
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

## OpenTelemetry

The logger supports automatic trace context injection. Supply a `traceContext` getter that returns the active span's trace/span IDs — the formatter maps them to platform-specific fields automatically.

### With `@opentelemetry/api`

```typescript
import { trace } from '@opentelemetry/api'
import { Logger } from 'jsonl-logger'

const logger = new Logger({}, {
  traceContext: () => {
    const span = trace.getActiveSpan()
    if (!span) return undefined
    const { traceId, spanId, traceFlags } = span.spanContext()
    return { traceId, spanId, traceFlags }
  },
})

logger.info('request handled', { path: '/api' })
// GCL output includes "logging.googleapis.com/trace", "logging.googleapis.com/spanId", etc.
// VictoriaLogs output includes "trace_id", "span_id", etc.
```

### Custom trace context

```typescript
const logger = new Logger({}, {
  traceContext: () => ({
    traceId: myTracer.currentTraceId(),
    spanId: myTracer.currentSpanId(),
  }),
})
```

The `traceContext` option is also available on `intercept()`:

```typescript
import { intercept } from 'jsonl-logger/intercept'

intercept({
  traceContext: () => {
    const span = trace.getActiveSpan()
    if (!span) return undefined
    const { traceId, spanId, traceFlags } = span.spanContext()
    return { traceId, spanId, traceFlags }
  },
})
```

Child loggers inherit the `traceContext` getter from their parent.

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

## Error Handling

Errors passed to `error()` / `fatal()` capture the full stack trace and `error.cause` chain:

```typescript
const inner = new Error('ECONNREFUSED')
const outer = new Error('fetch failed', { cause: inner })
logger.error('API call failed', { endpoint: '/users' }, outer)
```

**Dev mode** (no `LOG_FORMAT`) — colored plain text with full stack:
```
18:42:05 ✖ API call failed {"endpoint":"/users"}
Error: fetch failed
    at handler (/app/api/route.ts:42:5)
Caused by: Error: ECONNREFUSED
    at connect (/app/db.ts:10:3)
```

**Production** (`LOG_FORMAT` set) — structured JSON with `error.*` and `error.cause.*` fields:
```json
{
  "message": "API call failed",
  "severity": "ERROR",
  "endpoint": "/users",
  "error.name": "Error",
  "error.message": "fetch failed",
  "error.stack": "Error: fetch failed\n    at handler ...",
  "error.cause.name": "Error",
  "error.cause.message": "ECONNREFUSED",
  "error.cause.stack": "Error: ECONNREFUSED\n    at connect ..."
}
```

The `errorInfo()` helper is exported for use in custom formatters:

```typescript
import { errorInfo } from 'jsonl-logger'

const info = errorInfo(caughtError)
// { name, message, stack, cause?: { name, message, stack, cause?: ... } }
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_FORMAT` | _(unset)_ | Set to enable JSON: `google-cloud-logging` or `victoria-logs`. Unset = colored plain text |
| `LOG_LEVEL` | `info`/`debug` | Minimum log level (`info` when JSON, `debug` otherwise) |
| `LOG_LABELS` | `icon` | Plain-text label style: `icon`, `text`, or `none` (also via the `labels` option) |

## Runtime Detection

The logger auto-detects the runtime and uses the fastest available I/O:
- **Bun** / **Node.js** — `process.stdout.write` / `process.stderr.write` (bypasses console overhead)
- **Deno** — `Deno.stdout.writeSync` / `Deno.stderr.writeSync`
- **Browser / unknown** — falls back to `console.log` / `console.error`

## Exports

| Subpath | Export |
|---------|--------|
| `jsonl-logger` | `Logger`, `logger`, `errorInfo()`, types (`ErrorInfo`, `LogRecord`, `TraceContext`, etc.) |
| `jsonl-logger/google-cloud-logging` | `GoogleCloudLogging` formatter |
| `jsonl-logger/victoria-logs` | `VictoriaLogs` formatter |
| `jsonl-logger/intercept` | `intercept()`, `originalConsole` |
| `jsonl-logger/preload` | Side-effect auto-intercept |

## License

MIT
