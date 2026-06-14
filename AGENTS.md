# TraceCast Agent Guide

TraceCast is an open-source demo-as-code orchestration engine.

## Product Definition

TraceCast turns scripted or agent-driven software workflows into reproducible screen recordings.

It is not just a screen recorder. It is a runtime that can execute workflows across terminal, browser, and eventually desktop apps, while recording actions, logging events, and exporting polished demo videos.

## Positioning

Demo-as-code for software teams.

Users should be able to define a repeatable workflow in a script file, run it locally or in CI, and generate a video artifact for README demos, release notes, PR walkthroughs, bug reproductions, onboarding, support, and conference demos.

## Core Principle

Script-first, agent-compatible, runtime-controlled.

- The runtime is the mechanical actor.
- The script or agent is the decision-maker.
- The runtime owns permissions, execution, recording, event logs, and export.
- Agents may propose actions, generate scripts, or repair failed flows.
- Agents should not bypass the runtime permission layer.

## Initial MVP

Build a CLI that can:

- load a YAML TraceCast script
- validate the script
- execute terminal steps
- execute browser steps using Playwright
- record browser sessions
- write a structured event log
- export or save a recording artifact
- include at least one working example

Do not start with full desktop automation, cloud hosting, visual editing, complex AI behavior, or a broad plugin system.

## Preferred Stack

Use TypeScript/Node.js for the initial implementation.

Reasons:

- Playwright integration is strongest here.
- CLI tooling is mature.
- Future MCP/coding-assistant integration is natural.
- A web UI or desktop app can reuse TypeScript packages later.

Potential future layers:

- Rust for native recording, desktop automation, or performance-sensitive helpers.
- Python for experiments or optional integrations, not the core runtime.

## Architecture Terms

Use these terms consistently:

- Director: decides the next action. This can be a script, human, or agent.
- Runtime: validates and executes actions.
- Actor: the runtime performing mechanical actions through adapters.
- Adapter: implementation for terminal, browser, desktop, recorder, etc.
- Policy: permission and safety layer.
- Event Log: structured record of every action and observation.
- Composer: turns recordings and events into final video output.

## Non-Goals For MVP

- No full AI agent loop initially.
- No SaaS backend.
- No timeline editor.
- No native desktop control.
- No advanced video editing pipeline.
- No plugin marketplace.

## Engineering Standards

- Keep packages small and explicit.
- Prefer boring, debuggable code.
- Validate user scripts before execution.
- Log every executed action.
- Treat shell execution as dangerous and permissioned.
- Keep examples runnable.
- Avoid hidden magic in the runtime.
- Preserve the script-first, agent-compatible, runtime-controlled philosophy.
