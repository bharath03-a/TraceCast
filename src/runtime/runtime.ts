import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { BrowserAdapter } from "../adapters/browser-adapter.js";
import { TerminalAdapter } from "../adapters/terminal-adapter.js";
import { stepToDirectorAction, type DirectorAction, type TraceCastScript } from "../script/schema.js";
import { createRunArtifacts } from "./artifacts.js";
import { composeBrowserVideo } from "./composer.js";
import { EventLog } from "./event-log.js";
import { Policy } from "./policy.js";
import { writeRepairContext } from "./repair-context.js";

export type RuntimeOptions = {
  script: TraceCastScript;
  scriptPath: string;
  outDir?: string;
  headed: boolean;
};

export type RuntimeSummary = {
  status: "ok" | "failed";
  runDir: string;
  eventLogPath: string;
  summaryPath: string;
  durationMs: number;
  steps: RuntimeStepSummary[];
  artifacts: RuntimeArtifact[];
  repairContextPath?: string;
};

export type RuntimeArtifact =
  | { kind: "browser-video"; path: string }
  | { kind: "failure-screenshot"; path: string }
  | { kind: "screenshot"; path: string }
  | { kind: "composed-gif"; path: string }
  | { kind: "composed-mp4"; path: string };

export type RuntimeStepSummary = {
  index: number;
  kind: DirectorAction["kind"];
  status: "ok" | "failed";
  target?: string;
  durationMs: number;
  error?: string;
};

export class Runtime {
  constructor(private readonly options: RuntimeOptions) {}

  async run(): Promise<RuntimeSummary> {
    const artifacts = await createRunArtifacts({
      scriptName: this.options.script.name,
      outDir: this.options.outDir
    });
    const eventLog = new EventLog(artifacts.eventLogPath);
    const policy = new Policy(this.options.script.permissions);
    const terminal = new TerminalAdapter();
    const hasTerminalSteps = this.options.script.steps.some((s) => "terminal" in s);
    const browser = new BrowserAdapter({
      clickEmphasis: this.options.script.recording.cursor.clickEmphasis,
      cursorVisible: this.options.script.recording.cursor.visible,
      cursorMovement: this.options.script.recording.cursor.movement,
      headed: this.options.headed,
      videosDir: artifacts.videosDir,
      typeDelayMs: this.options.script.recording.pacing.typeDelayMs,
      viewport: this.options.script.recording.viewport,
      hasTerminalSteps
    });

    const collectedArtifacts: RuntimeArtifact[] = [];
    const steps: RuntimeStepSummary[] = [];
    let status: RuntimeSummary["status"] = "ok";
    let repairContextPath: string | undefined;
    const startedAt = Date.now();

    await eventLog.write({
      type: "run.start",
      status: "started",
      director: "script",
      actor: "runtime",
      adapter: "runtime",
      data: {
        script: this.options.scriptPath,
        runDir: artifacts.runDir,
        recording: this.options.script.recording
      }
    });

    try {
      await this.logPolicy(eventLog);

      for (const [index, step] of this.options.script.steps.entries()) {
        const action = stepToDirectorAction(step);
        const stepStartedAt = Date.now();
        try {
          await this.executeAction({ action, index, eventLog, policy, terminal, browser, screenshotsDir: artifacts.screenshotsDir, collectedArtifacts });
          await this.delayAfterAction(action, eventLog, index);
          steps.push({
            index,
            kind: action.kind,
            status: "ok",
            target: targetForAction(action),
            durationMs: Date.now() - stepStartedAt
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const screenshotPath = await browser.takeScreenshot(
            path.join(artifacts.screenshotsDir, `step-${index}-failure.png`)
          );
          if (screenshotPath) {
            collectedArtifacts.push({ kind: "failure-screenshot", path: screenshotPath });
            await eventLog.write({
              type: "artifact.failure-screenshot",
              status: "ok",
              stepIndex: index,
              actor: "runtime",
              adapter: "recorder",
              target: screenshotPath
            });
          }
          steps.push({
            index,
            kind: action.kind,
            status: "failed",
            target: targetForAction(action),
            durationMs: Date.now() - stepStartedAt,
            error: message
          });
          throw error;
        }
      }
    } catch (error) {
      status = "failed";
      await eventLog.write({
        type: "run.error",
        status: "failed",
        director: "script",
        actor: "runtime",
        adapter: "runtime",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      const videos = await browser.close();
      const outputFormat = this.options.script.recording.output.format;

      for (const videoPath of videos) {
        collectedArtifacts.push({ kind: "browser-video", path: videoPath });
        await eventLog.write({
          type: "artifact.browser-video",
          status: "ok",
          actor: "runtime",
          adapter: "recorder",
          target: videoPath
        });

        if (outputFormat !== "webm") {
          const composed = await composeBrowserVideo(videoPath, {
            outputFormat,
            outputDir: artifacts.composedDir,
            titleCard: this.options.script.recording.output.titleCard,
            endCard: this.options.script.recording.output.endCard
          });
          if (composed.ok) {
            const kind = outputFormat === "gif" ? "composed-gif" : "composed-mp4";
            collectedArtifacts.push({ kind, path: composed.outputPath });
            await eventLog.write({
              type: `artifact.${kind}`,
              status: "ok",
              actor: "runtime",
              adapter: "recorder",
              target: composed.outputPath
            });
          } else {
            // Never swallow a composition failure — surface it in the log and console.
            await eventLog.write({
              type: "compose.error",
              status: "failed",
              actor: "runtime",
              adapter: "recorder",
              target: videoPath,
              message: composed.message,
              data: { reason: composed.reason, outputFormat }
            });
            console.warn(`TraceCast: ${outputFormat.toUpperCase()} export failed — ${composed.message}`);
          }
        }
      }

      if (status === "failed") {
        try {
          const failureScreenshot = collectedArtifacts.find((a) => a.kind === "failure-screenshot");
          repairContextPath = await writeRepairContext({
            runDir: artifacts.runDir,
            scriptPath: this.options.scriptPath,
            eventLogPath: artifacts.eventLogPath,
            steps,
            failureScreenshotPath: failureScreenshot?.path
          });
          await eventLog.write({
            type: "artifact.repair-context",
            status: "ok",
            actor: "runtime",
            adapter: "runtime",
            target: repairContextPath
          });
        } catch (error) {
          await eventLog.write({
            type: "repair-context.error",
            status: "failed",
            actor: "runtime",
            adapter: "runtime",
            message: error instanceof Error ? error.message : String(error)
          });
        }
      }

      await eventLog.write({
        type: "run.end",
        status,
        actor: "runtime",
        adapter: "runtime",
        data: {
          artifacts: collectedArtifacts,
          repairContextPath
        }
      });
    }

    const summary: RuntimeSummary = {
      status,
      runDir: artifacts.runDir,
      eventLogPath: artifacts.eventLogPath,
      summaryPath: artifacts.summaryPath,
      durationMs: Date.now() - startedAt,
      steps,
      artifacts: collectedArtifacts,
      repairContextPath
    };

    await writeFile(artifacts.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    return summary;
  }

  private async executeAction(options: {
    action: DirectorAction;
    index: number;
    eventLog: EventLog;
    policy: Policy;
    terminal: TerminalAdapter;
    browser: BrowserAdapter;
    screenshotsDir: string;
    collectedArtifacts: RuntimeArtifact[];
  }): Promise<void> {
    const { action, index, eventLog, policy, terminal, browser, screenshotsDir, collectedArtifacts } = options;
    await eventLog.write({
      type: `${action.kind}.start`,
      status: "started",
      stepIndex: index,
      director: "script",
      actor: "runtime",
      adapter: adapterForAction(action),
      target: targetForAction(action)
    });

    try {
      if (action.kind === "terminal.run") {
        policy.assertTerminalAllowed();
        const result = await terminal.run(action.command);
        if (result.exitCode !== 0) {
          throw new Error(`Command exited with code ${result.exitCode}: ${result.stderr.trim()}`);
        }
        await browser.replayTerminalOutput(action.command, result.stdout, result.stderr);
        await eventLog.write({
          type: action.kind,
          status: "ok",
          stepIndex: index,
          director: "script",
          actor: "runtime",
          adapter: "terminal",
          target: action.command,
          data: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode
          }
        });
        return;
      }

      if (action.kind === "browser.open") {
        policy.assertBrowserAllowed();
        const resolvedTarget = resolveBrowserTarget(action.target, this.options.scriptPath);
        if (isNetworkTarget(resolvedTarget)) {
          policy.assertNetworkAllowed();
        }
        await browser.open(resolvedTarget);
        await eventLog.write({
          type: action.kind,
          status: "ok",
          stepIndex: index,
          director: "script",
          actor: "runtime",
          adapter: "browser",
          target: resolvedTarget
        });
        return;
      }

      if (action.kind === "browser.click") {
        policy.assertBrowserAllowed();
        const clickDelayMs = this.options.script.recording.pacing.clickDelayMs;
        await eventLog.write({
          type: "cursor.native-click",
          status: "started",
          stepIndex: index,
          director: "script",
          actor: "runtime",
          adapter: "cursor",
          target: action.selector,
          data: {
            clickDelayMs
          }
        });
        await sleep(clickDelayMs);
        await browser.click(action.selector);
        await eventLog.write({
          type: action.kind,
          status: "ok",
          stepIndex: index,
          director: "script",
          actor: "runtime",
          adapter: "browser",
          target: action.selector
        });
        return;
      }

      if (action.kind === "browser.type") {
        policy.assertBrowserAllowed();
        await eventLog.write({
          type: "cursor.move",
          status: "started",
          stepIndex: index,
          director: "script",
          actor: "runtime",
          adapter: "cursor",
          target: action.selector
        });
        await browser.type(action.selector, action.text);
        await eventLog.write({
          type: action.kind,
          status: "ok",
          stepIndex: index,
          director: "script",
          actor: "runtime",
          adapter: "browser",
          target: action.selector,
          data: {
            textLength: action.text.length
          }
        });
        return;
      }

      if (action.kind === "assert") {
        policy.assertBrowserAllowed();
        await browser.assert(action.condition);
        await eventLog.write({
          type: "assert",
          status: "ok",
          stepIndex: index,
          director: "script",
          actor: "runtime",
          adapter: "browser",
          target: action.condition.selector ?? action.condition.label,
          data: { condition: action.condition }
        });
        return;
      }

      if (action.kind === "screenshot") {
        const label = action.label ?? `step-${index}`;
        const screenshotPath = path.join(screenshotsDir, `${label}.png`);
        const savedPath = await browser.takeScreenshot(screenshotPath);
        if (savedPath) {
          collectedArtifacts.push({ kind: "screenshot", path: savedPath });
          await eventLog.write({
            type: "screenshot",
            status: "ok",
            stepIndex: index,
            director: "script",
            actor: "runtime",
            adapter: "recorder",
            target: savedPath,
            data: { label }
          });
        }
        return;
      }

      await sleep(action.seconds * 1000);
      await eventLog.write({
        type: "wait",
        status: "ok",
        stepIndex: index,
        director: "script",
        actor: "runtime",
        adapter: "runtime",
        data: {
          seconds: action.seconds
        }
      });
    } catch (error) {
      await eventLog.write({
        type: `${action.kind}.error`,
        status: "failed",
        stepIndex: index,
        director: "script",
        actor: "runtime",
        adapter: adapterForAction(action),
        target: targetForAction(action),
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async logPolicy(eventLog: EventLog): Promise<void> {
    await eventLog.write({
      type: "policy.permissions",
      status: "ok",
      actor: "runtime",
      adapter: "policy",
      data: this.options.script.permissions
    });
  }

  private async delayAfterAction(action: DirectorAction, eventLog: EventLog, index: number): Promise<void> {
    if (action.kind === "wait") {
      return;
    }

    const actionDelayMs = this.options.script.recording.pacing.actionDelayMs;
    if (actionDelayMs === 0) {
      return;
    }

    await eventLog.write({
      type: "pacing.action-delay",
      status: "started",
      stepIndex: index,
      actor: "runtime",
      adapter: "runtime",
      data: {
        actionDelayMs
      }
    });
    await sleep(actionDelayMs);
  }
}

function adapterForAction(action: DirectorAction) {
  if (action.kind.startsWith("terminal")) {
    return "terminal" as const;
  }
  if (action.kind.startsWith("browser") || action.kind === "assert") {
    return "browser" as const;
  }
  return "runtime" as const;
}

function targetForAction(action: DirectorAction): string | undefined {
  if (action.kind === "terminal.run") {
    return action.command;
  }
  if (action.kind === "browser.open") {
    return action.target;
  }
  if (action.kind === "browser.click" || action.kind === "browser.type") {
    return action.selector;
  }
  if (action.kind === "screenshot") {
    return action.label;
  }
  if (action.kind === "assert") {
    return action.condition.label ?? action.condition.selector ?? action.condition.text;
  }
  return undefined;
}

function resolveBrowserTarget(target: string, scriptPath: string): string {
  if (/^(https?|file|data):/u.test(target)) {
    return target;
  }

  const baseDir = path.dirname(path.resolve(scriptPath));
  return pathToFileURL(path.resolve(baseDir, target)).toString();
}

function isNetworkTarget(target: string): boolean {
  return /^https?:/u.test(target);
}
