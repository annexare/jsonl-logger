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
  formatters.ts         — formatter registry (LOG_FORMAT → Formatter) + resolveFormatter()
  datadog.ts            — Datadog formatter
  elastic-common-schema.ts — Elastic Common Schema (ECS) formatter
  google-cloud-logging.ts — Google Cloud Logging formatter
  pino.ts               — Pino-compatible formatter
  victoria-logs.ts      — VictoriaLogs formatter
  intercept.ts          — console.* monkey-patching for structured output
  preload.ts            — side-effect module for --preload (reads LOG_FORMAT)
tests/
  logger.test.ts        — Logger class (JSON + plain modes, child loggers, filtering)
  intercept.test.ts     — console interception tests
  datadog.test.ts       — Datadog formatter tests
  elastic-common-schema.test.ts — ECS formatter tests
  google-cloud-logging.test.ts — GCL formatter tests
  pino.test.ts          — Pino formatter tests
  victoria-logs.test.ts — VictoriaLogs formatter tests
  preload.test.ts       — preload module tests
  formatters.test.ts    — resolveFormatter registry tests
  types.test.ts         — stripAnsi, logLevelValues, write() tests
```

## Key Design Decisions

- **`LOG_FORMAT` env var** enables JSON mode and selects the formatter. When unset, the logger outputs plain text (dev mode), colored when stdout is a TTY.
- **`LOG_LABELS` env var** controls plain-mode label style: `icon` (default — `◆ ● ▲ ✖ ‼`), `text` (`DEBUG`, `INFO`, etc.), or `none`. Also settable via `labels` constructor option.
- **Plain-text color** is auto-detected from `process.stdout.isTTY` (`detectColors()` in `types.ts`). Override via the `colors` constructor option or `NO_COLOR`/`FORCE_COLOR` env. Precedence: `colors` option > `FORCE_COLOR` > `NO_COLOR` > TTY.
- **Preload is a no-op** without `LOG_FORMAT` — safe to include unconditionally.
- **`write()`** bypasses `console.*` to avoid interception loops — writes directly to `process.stdout`/`process.stderr` (Node/Bun), `Deno.stdout`/`Deno.stderr`, or falls back to `console.log`/`console.error`.
- **Intercept passthrough** — JSON strings that already contain the formatter's `messageKey` are written as-is, preventing double-formatting when `Logger` output goes through intercepted console.
- **TitleCase exports** for formatters (`GoogleCloudLogging`, `VictoriaLogs`, `ElasticCommonSchema`, `Datadog`, `Pino`) — they are objects conforming to the `Formatter` type. `LOG_FORMAT=ecs` selects the ECS formatter (short alias; the module/subpath is `elastic-common-schema`).
- **Datadog trace IDs** are passed through to `dd.trace_id`/`dd.span_id` verbatim (no hex→decimal conversion). Correct for dd-trace-js (decimal IDs); OTel-hex users may need format alignment. If conversion is ever needed it ships as a separate `datadog-otel` formatter (its own `LOG_FORMAT` value), not a toggle on this one.
- **Pino formatter** emits the pino line shape: numeric `level` (10–60), epoch-ms `time` (`Date.parse`), `msg`, and nested `err.{type,message,stack,cause}`; trace → `trace_id`/`span_id`/`trace_flags`. `pid`/`hostname` are **not** added (no `node:os` import) — users supply them as base bindings via the logger context.
- **Formatter registry** lives in `formatters.ts` (`formatters` map + `resolveFormatter()`), shared by `index.ts` and `preload.ts` — register a new formatter in that one place. Each `format()` spreads `record.context` **first**, so canonical schema fields can't be clobbered by caller-supplied context.
- **`.log()` method** — neutral/level-less output. Uses `info` level for filtering and JSON output, but renders with no icon or label in plain mode (whitespace padding only).
- **Error cause chains** — `errorInfo()` recursively extracts `Error.cause` into `ErrorInfo.cause`. Both `Logger.error()`/`Logger.fatal()` and `intercept()` use it. In dev mode, causes are shown as `Caused by: ...` below the main stack. In JSON mode, they appear as `error.cause.name/message/stack` fields.
- **Trace context injection** — optional `traceContext` getter on `LoggerOptions` / `InterceptOptions` returns `{ traceId, spanId, traceFlags? }`. Called per log call; formatters map to platform-specific fields (GCL: `logging.googleapis.com/*`, VictoriaLogs: `trace_id`/`span_id`, ECS: `trace.id`/`span.id`, Datadog: `dd.trace_id`/`dd.span_id`, Pino: `trace_id`/`span_id`). No new modules or dependencies — users wire their own OTel getter.

## Conventions

- ESM-only (`"type": "module"`)
- Biome for linting and formatting
- Bun test runner with `bun:test`
- TypeScript strict mode
- No runtime dependencies
