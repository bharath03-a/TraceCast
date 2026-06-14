# TraceCast Examples

Run any example from the repo root:

```bash
tracecast run examples/<name>.tracecast.yaml
# or, without installing globally:
npx tracecast run examples/<name>.tracecast.yaml
```

Each run writes artifacts to `.tracecast/runs/<timestamp>-<name>/` — an `events.jsonl`
audit log, a `summary.json`, a `videos/*.webm` recording, and (when `output.format`
is `gif`/`mp4` and ffmpeg is installed) a composed file under `composed/`.

| Example | What it shows | Permissions | Notes |
|---------|---------------|-------------|-------|
| `hello.tracecast.yaml` | Terminal + browser basics: echo, type, click, wait | terminal, browser, network | Self-contained; uses `demo-target.html` |
| `tracecast-meta.tracecast.yaml` | TraceCast recording itself — validates + runs hello, opens the summary viewer | terminal, browser | Produces the README GIF |
| `git-log-demo.tracecast.yaml` | Terminal-only output rendered into the recording | terminal, browser | Run inside a git repo |
| `api-demo.tracecast.yaml` | Hit a public API, open its docs, assert page text | terminal, browser, network | Needs internet access |

## Supporting files

- `demo-target.html` — a tiny local page driven by `hello.tracecast.yaml`.
- `summary-viewer.html` — drag a run's `summary.json` onto it to inspect steps and
  artifacts. Serve it (`npx serve examples`) and use `summary-viewer.html?summary=<url>`
  to auto-load.

## Inspecting a run

```bash
# Validate before running
tracecast validate examples/hello.tracecast.yaml

# Re-run on every save while editing
tracecast watch examples/hello.tracecast.yaml
```

## When a run fails

A failed run writes `repair-context.md` into its run directory. Hand it to the
repair loop to get a patched script:

```bash
tracecast repair .tracecast/runs/<failed-run> --dry-run
```

## Contributing an example

See [../library/CONTRIBUTING.md](../library/CONTRIBUTING.md). Keep examples
self-contained (prefer local pages or well-known public endpoints), grant the
minimum permissions, and validate with `tracecast validate` before submitting.
