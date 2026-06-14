# Decisions

This file records major project decisions. Keep entries short and dated.

## 2026-06-07: Use TypeScript/Node.js For MVP

TraceCast starts with TypeScript/Node.js because Playwright integration, CLI tooling, YAML parsing, and future agent/MCP integrations are strongest in this ecosystem.

Rust may be added later for native desktop automation, recording, or performance-sensitive helpers.

## 2026-06-07: Script-First, Agent-Compatible, Runtime-Controlled

TraceCast should work without AI. Scripts provide repeatability and trust.

Agents can later generate scripts, repair failed scripts, or propose actions during a run, but the runtime should own execution, permissions, logging, and artifact generation.

## 2026-06-07: Browser And Terminal Before Desktop

The MVP should support terminal and browser workflows first. Native desktop automation is valuable but significantly more complex and platform-specific, so it is deferred until the core runtime proves useful.
