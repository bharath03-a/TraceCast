import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TraceCastEvent } from "./event-log.js";
import type { RuntimeStepSummary } from "./runtime.js";

export type RepairContextInput = {
  scriptPath: string;
  scriptYaml: string;
  steps: RuntimeStepSummary[];
  recentEvents: TraceCastEvent[];
  failureScreenshotPath?: string;
};

const MAX_RECENT_EVENTS = 10;

/**
 * Build a Markdown repair context document from a failed run. Pure: takes all
 * inputs as data so it can be tested without touching the filesystem. LLMs
 * consume Markdown more reliably than raw JSONL.
 */
export function buildRepairContext(input: RepairContextInput): string {
  const failedStep = input.steps.find((step) => step.status === "failed");

  const lines: string[] = [];
  lines.push("# TraceCast Repair Context");
  lines.push("");
  lines.push(`A run of \`${input.scriptPath}\` failed. Below is everything needed to patch the script.`);
  lines.push("");

  lines.push("## Failure");
  lines.push("");
  if (failedStep) {
    lines.push(`- **Failed step index:** ${failedStep.index}`);
    lines.push(`- **Step kind:** \`${failedStep.kind}\``);
    if (failedStep.target) {
      lines.push(`- **Target:** \`${failedStep.target}\``);
    }
    lines.push(`- **Error:** ${failedStep.error ?? "(no message)"}`);
  } else {
    lines.push("- No individual step failed; the run failed during setup or teardown.");
  }
  if (input.failureScreenshotPath) {
    lines.push(`- **Failure screenshot:** \`${input.failureScreenshotPath}\``);
  }
  lines.push("");

  lines.push("## Step Results");
  lines.push("");
  for (const step of input.steps) {
    const marker = step.status === "ok" ? "✅" : "❌";
    const target = step.target ? ` — \`${step.target}\`` : "";
    lines.push(`${marker} [${step.index}] \`${step.kind}\`${target} (${step.durationMs}ms)`);
  }
  lines.push("");

  lines.push("## Recent Events");
  lines.push("");
  lines.push("```jsonl");
  for (const event of input.recentEvents.slice(-MAX_RECENT_EVENTS)) {
    lines.push(JSON.stringify(event));
  }
  lines.push("```");
  lines.push("");

  lines.push("## Original Script");
  lines.push("");
  lines.push("```yaml");
  lines.push(input.scriptYaml.trimEnd());
  lines.push("```");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

/** Read the last `count` events from a JSONL event log, tolerating bad lines. */
export async function readRecentEvents(eventLogPath: string, count: number): Promise<TraceCastEvent[]> {
  let raw: string;
  try {
    raw = await readFile(eventLogPath, "utf8");
  } catch {
    return [];
  }

  const events: TraceCastEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      events.push(JSON.parse(trimmed) as TraceCastEvent);
    } catch {
      // Skip malformed lines rather than failing the whole repair flow.
    }
  }
  return events.slice(-count);
}

export type WriteRepairContextOptions = {
  runDir: string;
  scriptPath: string;
  eventLogPath: string;
  steps: RuntimeStepSummary[];
  failureScreenshotPath?: string;
};

/**
 * Generate `repair-context.md` in the run directory. Returns the written path.
 */
export async function writeRepairContext(options: WriteRepairContextOptions): Promise<string> {
  const scriptYaml = await readFile(options.scriptPath, "utf8");
  const recentEvents = await readRecentEvents(options.eventLogPath, MAX_RECENT_EVENTS);

  const content = buildRepairContext({
    scriptPath: options.scriptPath,
    scriptYaml,
    steps: options.steps,
    recentEvents,
    failureScreenshotPath: options.failureScreenshotPath
  });

  const destPath = path.join(options.runDir, "repair-context.md");
  await writeFile(destPath, content, "utf8");
  return destPath;
}
