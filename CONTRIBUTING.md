# Contributing to TraceCast

Thanks for helping make demos reproducible.

## Development

```bash
npm install
npx playwright install chromium
npm run dev -- run examples/hello.tracecast.yaml
```

Before opening a PR:

```bash
npm run typecheck
npm test
npm run build
```

All three must pass — CI runs the same on every PR.

## Project layout

- `src/script/` — YAML schema (Zod), loader
- `src/runtime/` — runtime, event log, artifacts, composer, repair context
- `src/adapters/` — terminal + browser adapters
- `src/repair/` — LLM repair loop
- `src/mcp/` — MCP server + tools
- `src/schema/` — JSON Schema export
- `examples/` — runnable scripts
- `record-action/` — GitHub Action source

## Guidelines

- **Small files, single responsibility.** Prefer many focused modules.
- **Immutable updates** — return new objects, don't mutate.
- **Tests first.** New behavior needs a test; keep the suite green.
- **No secrets** in code, scripts, or examples.
- Validate any new example with `tracecast validate` before submitting.

## Contributing an example

See [examples/README.md](examples/README.md) and
[library/CONTRIBUTING.md](library/CONTRIBUTING.md). Keep examples self-contained,
grant the minimum permissions, and add an assert step where it makes sense.

## Reporting bugs

Open an issue with: the script (or a minimal repro), the `summary.json`, and the
relevant lines from `events.jsonl`. For failed runs, attach `repair-context.md`.
