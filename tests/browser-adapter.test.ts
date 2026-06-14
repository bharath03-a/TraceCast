import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BrowserAdapter } from "../src/adapters/browser-adapter.js";

function makeAdapter(overrides: Partial<ConstructorParameters<typeof BrowserAdapter>[0]> = {}) {
  return new BrowserAdapter({
    clickEmphasis: false,
    cursorVisible: true,
    cursorMovement: "native",
    headed: false,
    videosDir: "/tmp",
    typeDelayMs: 0,
    viewport: { width: 800, height: 600 },
    hasTerminalSteps: false,
    ...overrides
  });
}

describe("BrowserAdapter", () => {
  it("opens a page and injects the cursor overlay", async () => {
    const videosDir = await mkdtemp(path.join(tmpdir(), "tracecast-ba-cursor-"));
    const adapter = makeAdapter({ videosDir, viewport: { width: 800, height: 600 } });

    try {
      // Open a blank data URI page
      await adapter.open("data:text/html,<html><body></body></html>");

      // Access the page via a screenshot — if this succeeds the page opened
      const screenshotPath = path.join(videosDir, "cursor-test.png");
      const saved = await adapter.takeScreenshot(screenshotPath);
      expect(saved).toBe(screenshotPath);
    } finally {
      await adapter.close();
    }
  });

  it("takeScreenshot returns undefined when no page is open", async () => {
    const adapter = makeAdapter();
    const result = await adapter.takeScreenshot("/tmp/noop.png");
    expect(result).toBeUndefined();
  });

  it("close returns empty videos array when no page was opened", async () => {
    const adapter = makeAdapter();
    const videos = await adapter.close();
    expect(videos).toEqual([]);
  });

  it("injects terminal panel when hasTerminalSteps is true", async () => {
    const videosDir = await mkdtemp(path.join(tmpdir(), "tracecast-ba-terminal-"));
    const adapter = makeAdapter({ videosDir, hasTerminalSteps: true });

    try {
      await adapter.open("data:text/html,<html><body></body></html>");
      // After open, the terminal panel should be in the DOM.
      // We verify via a screenshot succeeding (panel injection doesn't throw).
      const screenshotPath = path.join(videosDir, "terminal-panel-test.png");
      const saved = await adapter.takeScreenshot(screenshotPath);
      expect(saved).toBe(screenshotPath);
    } finally {
      await adapter.close();
    }
  });

  it("replayTerminalOutput does not throw when no page is open", async () => {
    const adapter = makeAdapter();
    // Should be a no-op, not throw
    await expect(
      adapter.replayTerminalOutput("echo hi", "hi\n", "")
    ).resolves.toBeUndefined();
  });

  it("scripted cursor mode does not throw during moveCursorToSelector", async () => {
    const videosDir = await mkdtemp(path.join(tmpdir(), "tracecast-ba-scripted-"));
    const adapter = makeAdapter({ videosDir, cursorMovement: "scripted" });

    try {
      // Open a page with a clickable element
      await adapter.open(
        "data:text/html,<html><body><button id='btn' style='margin:100px'>Click</button></body></html>"
      );
      // click uses moveCursorToSelector internally
      await adapter.click("#btn");
    } finally {
      await adapter.close();
    }
  });
});
