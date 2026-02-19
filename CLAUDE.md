# jsonl-logger

Lightweight ESM-only JSONL logger with pluggable formatters. Zero dependencies. Bun-first, works on Node.js and Deno.

## Commands

- `bun test` — run tests (Bun test runner with coverage)
- `bun run build` — build JS + type declarations to `dist/`
- `bun run lint` — lint and auto-fix with Biome

## Architecture

```
src/
  types.ts              — shared types, LogLevel, LogRecord, Formatter, write(), stripAnsi()
  index.ts              — Logger class, default singleton `logger`
  google-cloud-logging.ts — Google Cloud Logging formatter
  victoria-logs.ts      — VictoriaLogs formatter
  intercept.ts          — console.* monkey-patching for structured output
  preload.ts            — side-effect module for --preload (reads LOG_FORMAT)
tests/
  logger.test.ts        — Logger class (JSON + plain modes, child loggers, filtering)
  intercept.test.ts     — console interception tests
  google-cloud-logging.test.ts — GCL formatter tests
  victoria-logs.test.ts — VictoriaLogs formatter tests
  preload.test.ts       — preload module tests
  types.test.ts         — stripAnsi, logLevelValues, write() tests
```

## Key Design Decisions

- **`LOG_FORMAT` is the single env var** that enables JSON mode and selects the formatter. When unset, the logger outputs colored plain text (dev mode).
- **Preload is a no-op** without `LOG_FORMAT` — safe to include unconditionally.
- **`write()`** bypasses `console.*` to avoid interception loops — writes directly to `process.stdout`/`process.stderr` (Node/Bun), `Deno.stdout`/`Deno.stderr`, or falls back to `console.log`/`console.error`.
- **Intercept passthrough** — JSON strings that already contain the formatter's `messageKey` are written as-is, preventing double-formatting when `Logger` output goes through intercepted console.
- **TitleCase exports** for formatters (`GoogleCloudLogging`, `VictoriaLogs`) — they are objects conforming to the `Formatter` type.
- **Error cause chains** — `errorInfo()` recursively extracts `Error.cause` into `ErrorInfo.cause`. Both `Logger.log()` and `intercept()` use it. In dev mode, causes are shown as `Caused by: ...` below the main stack. In JSON mode, they appear as `error.cause.name/message/stack` fields.
- **Trace context injection** — optional `traceContext` getter on `LoggerOptions` / `InterceptOptions` returns `{ traceId, spanId, traceFlags? }`. Called per log call; formatters map to platform-specific fields (GCL: `logging.googleapis.com/*`, VictoriaLogs: `trace_id`/`span_id`). No new modules or dependencies — users wire their own OTel getter.

## Conventions

- ESM-only (`"type": "module"`)
- Biome for linting and formatting
- Bun test runner with `bun:test`
- TypeScript strict mode
- No runtime dependencies
