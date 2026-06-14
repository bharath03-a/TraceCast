import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGetEventLogTool(server: McpServer): void {
  server.tool(
    "get_event_log",
    "Read the structured event log from a TraceCast run. Filter by stepIndex or event types. Useful for diagnosing failures.",
    {
      runDir: z.string().describe("Path to the run directory"),
      stepIndex: z.number().optional().describe("Filter to events for a specific step index"),
      types: z.array(z.string()).optional().describe("Filter to specific event types (e.g. ['terminal.run', 'assert'])")
    },
    async ({ runDir, stepIndex, types }) => {
      try {
        const logPath = path.join(runDir, "events.jsonl");
        const raw = await readFile(logPath, "utf8");
        const events = raw
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>)
          .filter((e) => {
            if (stepIndex !== undefined && e["stepIndex"] !== stepIndex) return false;
            if (types && types.length > 0 && !types.includes(String(e["type"]))) return false;
            return true;
          });
        return {
          content: [{ type: "text", text: JSON.stringify(events, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: JSON.stringify({ error: message }) }],
          isError: true
        };
      }
    }
  );
}
