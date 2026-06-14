import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadTraceCastScript } from "../../script/loader.js";
import { Runtime } from "../../runtime/runtime.js";

export function registerRunTool(server: McpServer): void {
  server.tool(
    "run",
    "Run a TraceCast YAML script and return the run summary including artifact paths.",
    {
      scriptPath: z.string().describe("Absolute or relative path to a .tracecast.yaml file"),
      outDir: z.string().optional().describe("Output directory for this run (defaults to .tracecast/runs/)"),
      headed: z.boolean().optional().default(false).describe("Run browser in visible (headed) mode")
    },
    async ({ scriptPath, outDir, headed }) => {
      try {
        const script = await loadTraceCastScript(scriptPath);
        const runtime = new Runtime({ script, scriptPath, outDir, headed: headed ?? false });
        const summary = await runtime.run();
        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }]
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
