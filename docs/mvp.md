# MVP

The first TraceCast milestone is a local CLI that can run a small script and produce useful artifacts.

## Goal

Create a developer-usable prototype that demonstrates the core loop:

```bash
tracecast run examples/hello.tracecast.yaml
```

The run should execute terminal and browser steps, write an event log, and save recording artifacts where possible.

The MVP should also establish TraceCast as a coding-assistant-first runtime. In the first implementation, the parsed YAML script is the Director. Future coding assistants can generate or repair scripts, but they should not bypass policy, runtime execution, event logging, or artifact handling.

## In Scope

- TypeScript/Node.js project setup
- CLI entrypoint
- YAML script parsing
- schema validation
- terminal command steps
- browser open/click/type/wait steps using Playwright
- basic Playwright browser video recording
- run output directory
- structured event log
- example script
- README instructions
- schema hooks for cursor and recording style controls

## Out of Scope

- full desktop automation
- autonomous AI agent loop
- cloud backend
- visual timeline editor
- advanced ffmpeg composition
- voiceover generation
- hosted sharing
- plugin marketplace
- full custom cursor choreography

## Example Script Shape

```yaml
name: hello-tracecast

permissions:
  terminal: allow
  browser: allow
  network: allow

recording:
  viewport:
    width: 1280
    height: 720

steps:
  - terminal:
      run: echo "Starting demo"

  - browser:
      open: https://example.com

  - wait:
      seconds: 2
```

The runtime may record cursor-related event terminology for browser clicks, but custom cursor animation is deferred until the core runtime is stable.

## Success Criteria

- A user can install dependencies.
- A user can run the example script.
- The CLI validates the script before executing.
- The CLI produces an event log.
- Browser steps run in a visible or recorded Playwright browser context.
- Failures are understandable and point to the failing step.
- The generated event log is useful to humans and future assistant repair loops.
