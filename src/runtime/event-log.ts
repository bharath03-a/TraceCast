import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type EventStatus = "started" | "ok" | "failed" | "skipped";

export type TraceCastEvent = {
  timestamp: string;
  timeMs: number;
  type: string;
  status: EventStatus;
  stepIndex?: number;
  director?: "script" | "human" | "agent";
  actor?: "runtime";
  adapter?: "terminal" | "browser" | "recorder" | "policy" | "cursor" | "runtime";
  target?: string;
  message?: string;
  data?: Record<string, unknown>;
};

export class EventLog {
  private readonly startedAt = Date.now();

  constructor(private readonly filePath: string) {}

  async write(event: Omit<TraceCastEvent, "timestamp" | "timeMs">): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const timestamp = new Date();
    const fullEvent: TraceCastEvent = {
      timestamp: timestamp.toISOString(),
      timeMs: timestamp.getTime() - this.startedAt,
      ...event
    };
    await appendFile(this.filePath, `${JSON.stringify(fullEvent)}\n`, "utf8");
  }
}
