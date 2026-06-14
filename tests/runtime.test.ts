import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Runtime } from "../src/runtime/runtime.js";
import type { TraceCastScript } from "../src/script/schema.js";

describe("Runtime", () => {
  it("runs a terminal-only workflow and writes an event log", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "tracecast-runtime-"));
    const script: TraceCastScript = {
      name: "terminal-only",
      permissions: {
        terminal: "allow"
      },
      recording: {
        viewport: {
          width: 1280,
          height: 720
        },
        cursor: {
          movement: "native",
          visible: true,
          clickEmphasis: false
        },
        pacing: {
          actionDelayMs: 0,
          clickDelayMs: 0,
          typeDelayMs: 0
        },
        output: { format: "webm" as const }
      },
      steps: [{ terminal: { run: "echo tracecast" } }]
    };

    const runtime = new Runtime({
      script,
      scriptPath: "inline",
      outDir,
      headed: false
    });

    const summary = await runtime.run();
    const events = await readFile(summary.eventLogPath, "utf8");
    const summaryFile = JSON.parse(await readFile(summary.summaryPath, "utf8"));

    expect(summary.status).toBe("ok");
    expect(summary.steps).toHaveLength(1);
    expect(summary.steps[0]?.kind).toBe("terminal.run");
    expect(summaryFile.status).toBe("ok");
    expect(summaryFile.steps[0].target).toBe("echo tracecast");
    expect(events).toContain("run.start");
    expect(events).toContain("terminal.run");
    expect(events).toContain("tracecast");
  });

  it("reports failed workflows", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "tracecast-runtime-fail-"));
    const script: TraceCastScript = {
      name: "blocked-terminal",
      permissions: {},
      recording: {
        viewport: {
          width: 1280,
          height: 720
        },
        cursor: {
          movement: "native",
          visible: true,
          clickEmphasis: false
        },
        pacing: {
          actionDelayMs: 0,
          clickDelayMs: 0,
          typeDelayMs: 0
        },
        output: { format: "webm" as const }
      },
      steps: [{ terminal: { run: "echo nope" } }]
    };

    const runtime = new Runtime({
      script,
      scriptPath: "inline",
      outDir,
      headed: false
    });

    const summary = await runtime.run();
    const events = await readFile(summary.eventLogPath, "utf8");
    const summaryFile = JSON.parse(await readFile(summary.summaryPath, "utf8"));

    expect(summary.status).toBe("failed");
    expect(summary.steps[0]?.status).toBe("failed");
    expect(summaryFile.steps[0].error).toContain("permissions.terminal: allow");
    expect(events).toContain("permissions.terminal: allow");
  });
});
