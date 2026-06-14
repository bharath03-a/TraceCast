# TraceCast Record — GitHub Action

Run a [TraceCast](https://github.com/) demo-as-code script in CI and upload the
recording as a workflow artifact.

> This directory is the source for the standalone `tracecast/record-action` repo.
> Extract it (or reference it via a subdirectory) to publish as a Marketplace action.

## Usage

```yaml
name: Record demo
on: [push]

jobs:
  record:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: tracecast/record-action@v1
        id: demo
        with:
          script: examples/hello.tracecast.yaml
          upload-artifact: true

      - run: echo "Recorded to ${{ steps.demo.outputs.run-dir }}"
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `script` | _(required)_ | Path to the `.tracecast.yaml` script. |
| `version` | `latest` | TraceCast npm version/dist-tag to install. |
| `out` | `""` | Output directory (passed to `--out`). |
| `upload-artifact` | `true` | Upload the run directory as an artifact. |
| `artifact-name` | `tracecast-run` | Name for the uploaded artifact. |

## Outputs

| Output | Description |
|--------|-------------|
| `run-dir` | The run directory TraceCast produced. |

## Notes

- Runs on Linux runners using `Xvfb` on `DISPLAY=:99` so the headed browser has a
  display to record.
- Installs Chromium with `npx playwright install chromium --with-deps`.
- For GIF/MP4 output (`recording.output.format`), the runner also needs `ffmpeg`
  (preinstalled on `ubuntu-latest`).
