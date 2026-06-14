import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { AssertCondition } from "../script/schema.js";

export type CursorMovement = "native" | "scripted" | "agent";

export type BrowserAdapterOptions = {
  clickEmphasis: boolean;
  cursorVisible: boolean;
  cursorMovement: CursorMovement;
  headed: boolean;
  videosDir: string;
  typeDelayMs: number;
  viewport: {
    width: number;
    height: number;
  };
  hasTerminalSteps: boolean;
};

const TERMINAL_PANEL_HEIGHT = 200;

// xterm.js 5.3.0 loaded via esm.sh — pinned version for reproducibility
const XTERM_CDN = "https://esm.sh/xterm@5.3.0";
const XTERM_CSS_CDN = "https://esm.sh/xterm@5.3.0/css/xterm.css";

export class BrowserAdapter {
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private cursorPosition = { x: 24, y: 24 };
  private terminalPanelReady = false;

  constructor(private readonly options: BrowserAdapterOptions) {}

  async open(url: string): Promise<void> {
    const page = await this.ensurePage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await this.ensureCursorOverlay();
    if (this.options.hasTerminalSteps) {
      await this.ensureTerminalPanel();
    }
  }

  async click(selector: string): Promise<void> {
    const page = await this.ensurePage();
    await this.moveCursorToSelector(selector);
    await page.locator(selector).click();
    await this.pulseCursor();
  }

  async type(selector: string, text: string): Promise<void> {
    const page = await this.ensurePage();
    const locator = page.locator(selector);
    await this.moveCursorToSelector(selector);
    await locator.fill("");
    await locator.pressSequentially(text, { delay: this.options.typeDelayMs });
  }

  async takeScreenshot(destPath: string): Promise<string | undefined> {
    if (!this.page) {
      return undefined;
    }
    await this.page.screenshot({ path: destPath, fullPage: true });
    return destPath;
  }

  async assert(condition: AssertCondition): Promise<void> {
    const page = await this.ensurePage();
    const label = condition.label ?? "assertion";

    if (condition.url !== undefined) {
      const current = page.url();
      if (!current.includes(condition.url)) {
        throw new Error(
          `Assert failed [${label}]: URL "${current}" does not contain "${condition.url}"`
        );
      }
    }

    if (condition.text !== undefined) {
      const bodyText = await page.locator("body").innerText().catch(() => "");
      if (!bodyText.includes(condition.text)) {
        throw new Error(
          `Assert failed [${label}]: page does not contain text "${condition.text}"`
        );
      }
    }

    if (condition.selector !== undefined) {
      const locator = page.locator(condition.selector);

      if (condition.visible !== undefined) {
        const isVisible = await locator.isVisible().catch(() => false);
        if (isVisible !== condition.visible) {
          const expected = condition.visible ? "visible" : "hidden";
          const actual = isVisible ? "visible" : "hidden";
          throw new Error(
            `Assert failed [${label}]: "${condition.selector}" expected ${expected} but was ${actual}`
          );
        }
      }

      if (condition.contains !== undefined) {
        await locator.waitFor({ state: "visible", timeout: 5000 }).catch(() => {
          throw new Error(
            `Assert failed [${label}]: "${condition.selector}" not found or not visible`
          );
        });
        const text = await locator.innerText().catch(() => "");
        if (!text.includes(condition.contains)) {
          throw new Error(
            `Assert failed [${label}]: "${condition.selector}" text "${text}" does not contain "${condition.contains}"`
          );
        }
      }
    }
  }

  async replayTerminalOutput(command: string, stdout: string, stderr: string): Promise<void> {
    if (!this.page) {
      return;
    }
    await this.ensureTerminalPanel();
    const combined = stderr
      ? `$ ${command}\n${stdout}${stdout && !stdout.endsWith("\n") ? "\n" : ""}${stderr}`
      : `$ ${command}\n${stdout}`;
    await this.page.evaluate((text: string) => {
      const term = (window as unknown as { __traceCastTerm?: { write: (s: string) => void } }).__traceCastTerm;
      if (!term) return;
      term.write(text.replace(/\n/g, "\r\n"));
    }, combined);
    // Brief pause so the output is visible in the recording before the next step
    await this.page.waitForTimeout(400);
  }

  async close(): Promise<string[]> {
    const page = this.page;
    const videos: string[] = [];

    await this.context?.close();
    if (page) {
      const video = page.video();
      if (video) {
        try {
          videos.push(await video.path());
        } catch {
          // Playwright can omit video paths when a browser failed before recording starts.
        }
      }
    }
    await this.browser?.close();

    this.page = undefined;
    this.context = undefined;
    this.browser = undefined;
    this.terminalPanelReady = false;

    return videos;
  }

  private async ensurePage(): Promise<Page> {
    if (this.page) {
      return this.page;
    }

    const viewportHeight = this.options.hasTerminalSteps
      ? this.options.viewport.height + TERMINAL_PANEL_HEIGHT
      : this.options.viewport.height;

    this.browser = await chromium.launch({ headless: !this.options.headed });
    this.context = await this.browser.newContext({
      recordVideo: {
        dir: this.options.videosDir,
        size: { width: this.options.viewport.width, height: viewportHeight }
      },
      viewport: { width: this.options.viewport.width, height: viewportHeight }
    });
    this.page = await this.context.newPage();
    await this.ensureCursorOverlay();
    if (this.options.hasTerminalSteps) {
      await this.ensureTerminalPanel();
    }
    return this.page;
  }

  private async ensureTerminalPanel(): Promise<void> {
    if (this.terminalPanelReady || !this.page) {
      return;
    }

    await this.page.evaluate(
      ({ xtermCdn, xtermCssCdn, panelHeight }: { xtermCdn: string; xtermCssCdn: string; panelHeight: number }) => {
        if (document.getElementById("tracecast-terminal-panel")) {
          return;
        }

        // Inject xterm.js CSS
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = xtermCssCdn;
        document.head.appendChild(link);

        // Terminal panel container
        const panel = document.createElement("div");
        panel.id = "tracecast-terminal-panel";
        panel.style.position = "fixed";
        panel.style.bottom = "0";
        panel.style.left = "0";
        panel.style.right = "0";
        panel.style.height = `${panelHeight}px`;
        panel.style.background = "#1e1e1e";
        panel.style.borderTop = "1px solid #3e3e3e";
        panel.style.zIndex = "2147483646";
        panel.style.display = "flex";
        panel.style.flexDirection = "column";

        // Title bar
        const titleBar = document.createElement("div");
        titleBar.style.padding = "4px 12px";
        titleBar.style.background = "#2d2d2d";
        titleBar.style.color = "#999";
        titleBar.style.fontSize = "11px";
        titleBar.style.fontFamily = "system-ui, sans-serif";
        titleBar.style.borderBottom = "1px solid #3e3e3e";
        titleBar.style.userSelect = "none";
        titleBar.textContent = "Terminal";
        panel.appendChild(titleBar);

        // Terminal mount point
        const mount = document.createElement("div");
        mount.id = "tracecast-terminal-mount";
        mount.style.flex = "1";
        mount.style.overflow = "hidden";
        mount.style.padding = "4px";
        panel.appendChild(mount);

        document.body.appendChild(panel);

        // Dynamically load xterm.js and initialise terminal
        const script = document.createElement("script");
        script.type = "module";
        script.textContent = `
          import { Terminal } from '${xtermCdn}';
          const term = new Terminal({
            theme: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4' },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 12,
            cursorBlink: false,
            disableStdin: true,
          });
          const mount = document.getElementById('tracecast-terminal-mount');
          if (mount) term.open(mount);
          window.__traceCastTerm = term;
        `;
        document.head.appendChild(script);
      },
      { xtermCdn: XTERM_CDN, xtermCssCdn: XTERM_CSS_CDN, panelHeight: TERMINAL_PANEL_HEIGHT }
    );

    // Wait for xterm.js to initialise
    await this.page.waitForFunction(() => {
      return !!(window as unknown as { __traceCastTerm?: unknown }).__traceCastTerm;
    }, { timeout: 10000 }).catch(() => {
      // xterm.js failed to load (e.g. offline) — terminal panel degrades gracefully
    });

    this.terminalPanelReady = true;
  }

  private async ensureCursorOverlay(): Promise<void> {
    if (!this.options.cursorVisible || !this.page) {
      return;
    }

    await this.page.evaluate(({ x, y }: { x: number; y: number }) => {
      if (document.getElementById("tracecast-cursor")) {
        return;
      }

      const cursor = document.createElement("div");
      cursor.id = "tracecast-cursor";
      cursor.setAttribute("aria-hidden", "true");
      cursor.style.position = "fixed";
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
      cursor.style.width = "18px";
      cursor.style.height = "18px";
      cursor.style.border = "2px solid #111827";
      cursor.style.borderRadius = "999px";
      cursor.style.background = "#ffffff";
      cursor.style.boxShadow = "0 2px 10px rgba(15, 23, 42, 0.24)";
      cursor.style.pointerEvents = "none";
      cursor.style.zIndex = "2147483647";
      cursor.style.transform = "translate(-50%, -50%)";
      cursor.style.transition = "left 420ms ease, top 420ms ease, transform 140ms ease, box-shadow 140ms ease";
      document.body.appendChild(cursor);
    }, { x: this.cursorPosition.x, y: this.cursorPosition.y });
  }

  private async moveCursorToSelector(selector: string): Promise<void> {
    if (!this.options.cursorVisible) {
      return;
    }

    const page = await this.ensurePage();
    await this.ensureCursorOverlay();
    const locator = page.locator(selector);
    await locator.waitFor({ state: "visible" });
    const box = await locator.boundingBox();
    if (!box) {
      return;
    }

    const targetX = Math.round(box.x + box.width / 2);
    const targetY = Math.round(box.y + box.height / 2);

    if (this.options.cursorMovement === "scripted") {
      const dx = targetX - this.cursorPosition.x;
      const dy = targetY - this.cursorPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const PIXELS_PER_MS = 0.8;
      const durationMs = Math.max(200, Math.round(distance / PIXELS_PER_MS));

      await page.evaluate(
        ({ x, y, dur }: { x: number; y: number; dur: number }) => {
          const cursor = document.getElementById("tracecast-cursor");
          if (!cursor) return;
          cursor.style.transition = `left ${dur}ms ease, top ${dur}ms ease, transform 140ms ease, box-shadow 140ms ease`;
          cursor.style.left = `${x}px`;
          cursor.style.top = `${y}px`;
        },
        { x: targetX, y: targetY, dur: durationMs }
      );
      await page.waitForTimeout(durationMs + 50);
    } else {
      // native mode: fixed 420ms ease
      await page.evaluate(
        ({ x, y }: { x: number; y: number }) => {
          const cursor = document.getElementById("tracecast-cursor");
          if (!cursor) return;
          cursor.style.transition = "left 420ms ease, top 420ms ease, transform 140ms ease, box-shadow 140ms ease";
          cursor.style.left = `${x}px`;
          cursor.style.top = `${y}px`;
        },
        { x: targetX, y: targetY }
      );
      await page.waitForTimeout(450);
    }

    this.cursorPosition = { x: targetX, y: targetY };
  }

  private async pulseCursor(): Promise<void> {
    if (!this.options.cursorVisible || !this.options.clickEmphasis || !this.page) {
      return;
    }

    await this.page.evaluate(() => {
      const cursor = document.getElementById("tracecast-cursor");
      if (!cursor) return;
      cursor.style.transform = "translate(-50%, -50%) scale(1.55)";
      cursor.style.boxShadow = "0 0 0 10px rgba(37, 99, 235, 0.18), 0 2px 10px rgba(15, 23, 42, 0.24)";
    });
    await this.page.waitForTimeout(140);
    await this.page.evaluate(() => {
      const cursor = document.getElementById("tracecast-cursor");
      if (!cursor) return;
      cursor.style.transform = "translate(-50%, -50%) scale(1)";
      cursor.style.boxShadow = "0 2px 10px rgba(15, 23, 42, 0.24)";
    });
  }
}
