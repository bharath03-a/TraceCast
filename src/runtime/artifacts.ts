import { mkdir } from "node:fs/promises";
import path from "node:path";

export type RunArtifacts = {
  runDir: string;
  eventLogPath: string;
  summaryPath: string;
  screenshotsDir: string;
  videosDir: string;
  composedDir: string;
};

export async function createRunArtifacts(options: {
  scriptName: string;
  outDir?: string;
  now?: Date;
}): Promise<RunArtifacts> {
  const runDir =
    options.outDir ??
    path.join(".tracecast", "runs", `${formatRunTimestamp(options.now ?? new Date())}-${slugify(options.scriptName)}`);
  const videosDir = path.join(runDir, "videos");
  const screenshotsDir = path.join(runDir, "screenshots");
  const composedDir = path.join(runDir, "composed");
  const eventLogPath = path.join(runDir, "events.jsonl");
  const summaryPath = path.join(runDir, "summary.json");

  await mkdir(videosDir, { recursive: true });
  await mkdir(screenshotsDir, { recursive: true });
  await mkdir(composedDir, { recursive: true });

  return { runDir, eventLogPath, summaryPath, screenshotsDir, videosDir, composedDir };
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatRunTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}
