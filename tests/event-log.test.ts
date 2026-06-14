import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EventLog } from "../src/runtime/event-log.js";

describe("EventLog", () => {
  it("writes structured JSONL events", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "tracecast-event-log-"));
    const eventLogPath = path.join(dir, "events.jsonl");
    const eventLog = new EventLog(eventLogPath);

    await eventLog.write({
      type: "run.start",
      status: "started",
      actor: "runtime",
      adapter: "runtime"
    });

    const lines = (await readFile(eventLogPath, "utf8")).trim().split("\n");
    const event = JSON.parse(lines[0]);

    expect(event.type).toBe("run.start");
    expect(event.status).toBe("started");
    expect(event.timestamp).toEqual(expect.any(String));
    expect(event.timeMs).toEqual(expect.any(Number));
  });
});
