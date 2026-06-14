import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGetArtifactsTool(server: McpServer): void {
  server.tool(
    "get_artifacts",
    "Get the artifact paths from a completed TraceCast run. Pass the runDir from a previous run summary.",
    {
      runDir: z.string().describe("Path to the run directory (e.g. .tracecast/runs/2024-01-01-my-demo)")
    },
    async ({ runDir }) => {
      try {
        const summaryPath = path.join(runDir, "summary.json");
        const raw = await readFile(summaryPath, "utf8");
        const summary = JSON.parse(raw) as {
          status: string;
          artifacts: Array<{ kind: string; path: string }>;
          durationMs: number;
          steps: Array<{ status: string }>;
        };
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: summary.status,
              durationMs: summary.durationMs,
              artifacts: summary.artifacts,
              failedSteps: summary.steps.filter((s) => s.status === "failed").length
            }, null, 2)
          }]
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
