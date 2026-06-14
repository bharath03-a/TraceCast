import { describe, expect, it } from "vitest";
import { buildRepairContext } from "../src/runtime/repair-context.js";
import type { RuntimeStepSummary } from "../src/runtime/runtime.js";

const steps: RuntimeStepSummary[] = [
  { index: 0, kind: "browser.open", status: "ok", target: "page.html", durationMs: 120 },
  { index: 1, kind: "assert", status: "failed", target: "#title", durationMs: 50, error: "selector not found" }
];

describe("buildRepairContext", () => {
  it("includes the failed step index, kind, and error", () => {
    const md = buildRepairContext({
      scriptPath: "demo.tracecast.yaml",
      scriptYaml: "name: demo\nsteps: []",
      steps,
      recentEvents: []
    });
    expect(md).toContain("Failed step index:** 1");
    expect(md).toContain("`assert`");
    expect(md).toContain("selector not found");
  });

  it("inlines the original YAML in a fenced block", () => {
    const md = buildRepairContext({
      scriptPath: "demo.tracecast.yaml",
      scriptYaml: "name: demo\nsteps:\n  - wait: { seconds: 1 }",
      steps,
      recentEvents: []
    });
    expect(md).toContain("```yaml");
    expect(md).toContain("name: demo");
  });

  it("caps recent events at 10", () => {
    const events = Array.from({ length: 25 }, (_, i) => ({
      timestamp: "t",
      timeMs: i,
      type: `event.${i}`,
      status: "ok" as const
    }));
    const md = buildRepairContext({
      scriptPath: "demo.tracecast.yaml",
      scriptYaml: "name: demo",
      steps,
      recentEvents: events
    });
    expect(md).toContain("event.24");
    expect(md).not.toContain("event.14");
    expect(md).toContain("event.15");
  });

  it("includes the failure screenshot path when present", () => {
    const md = buildRepairContext({
      scriptPath: "demo.tracecast.yaml",
      scriptYaml: "name: demo",
      steps,
      recentEvents: [],
      failureScreenshotPath: "runs/x/screenshots/step-1-failure.png"
    });
    expect(md).toContain("step-1-failure.png");
  });
});
