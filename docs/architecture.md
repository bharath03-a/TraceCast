# Architecture

TraceCast is organized around a runtime that executes a workflow through adapters, records events, and produces artifacts.

```text
TraceCast Script or Agent Goal
        ↓
Director
        ↓
Policy / Permission Planner
        ↓
Runtime
        ↓
Adapters
  terminal | browser | desktop | recorder | agent
        ↓
Event Log + Recording Artifacts
        ↓
Composer / Exporter
```

## Core Concepts

### Director

The Director decides the next action. In MVP, the Director is the parsed script. Later, it can also be a human supervisor or an agent.

Coding assistants should integrate at this layer by proposing scripts or actions. They should not directly control terminal, browser, filesystem, credentials, desktop state, or recording without the Runtime validating policy first.

### Runtime

The Runtime validates and executes actions. It owns permissions, execution order, lifecycle management, event logging, and artifact paths.

### Actor

The Actor is the runtime performing mechanical actions through adapters. It is the thing that actually runs commands, opens browsers, types, clicks, waits, records, and exports.

The MVP Actor uses terminal and browser adapters. Future actors may include cursor choreography and desktop control, but those should remain runtime-owned capabilities instead of assistant side effects.

### Adapter

Adapters connect the runtime to real capabilities.

Initial adapters:

- terminal adapter
- browser adapter
- recorder/export adapter
- cursor terminology in the event log

Future adapters:

- desktop automation adapter
- agent adapter
- MCP adapter
- cloud renderer adapter
- cursor choreography adapter

### Policy

Policy controls what the runtime may do. Terminal execution, filesystem access, network access, desktop control, credential use, and agent autonomy should all be permissioned.

### Event Log

Every meaningful action and observation should be written to a structured event log. The event log is useful for debugging, replay, audit, video composition, future timeline editing, and agent repair.

Example event:

```json
{
  "timeMs": 12450,
  "type": "browser.click",
  "target": "text=Get started",
  "status": "ok"
}
```

### Composer

The Composer turns raw recordings and event logs into final video outputs. In the MVP, this can be minimal. Later, it can add zooms, cursor highlights, captions, scene cuts, silence trimming, and branded presets.

Demo polish controls such as pacing, cursor movement, click emphasis, and post-action delay should flow through the script/runtime model so recordings can feel natural without becoming unreproducible manual captures.

## MVP Execution Flow

1. Load a YAML script.
2. Validate its schema.
3. Ask for or apply permissions.
4. Start a run directory.
5. Execute steps in order.
6. Write structured events.
7. Save recording artifacts.
8. Print a useful run summary.

## Agent Integration Model

Agents should not bypass the runtime. They can propose actions or script patches, but the runtime should validate and execute them.

```text
Agent proposes action → Runtime validates policy → Adapter executes → Event log records result
```

This keeps TraceCast useful with or without AI.
