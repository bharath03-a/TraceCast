import { parse } from "yaml";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadTraceCastScript } from "../../script/loader.js";
import { traceCastScriptSchema } from "../../script/schema.js";

export function registerValidateTool(server: McpServer): void {
  server.tool(
    "validate",
    "Validate a TraceCast YAML script. Pass scriptPath for a file on disk, or scriptYaml for inline YAML content.",
    {
      scriptPath: z.string().optional().describe("Absolute or relative path to a .tracecast.yaml file"),
      scriptYaml: z.string().optional().describe("Inline YAML content of a TraceCast script")
    },
    async ({ scriptPath, scriptYaml }) => {
      if (!scriptPath && !scriptYaml) {
        return {
          content: [{ type: "text", text: JSON.stringify({ valid: false, errors: ["Provide scriptPath or scriptYaml"] }) }]
        };
      }

      try {
        if (scriptPath) {
          const script = await loadTraceCastScript(scriptPath);
          return {
            content: [{ type: "text", text: JSON.stringify({ valid: true, name: script.name, steps: script.steps.length }) }]
          };
        }

        const parsed = parse(scriptYaml!);
        const result = traceCastScriptSchema.safeParse(parsed);
        if (result.success) {
          return {
            content: [{ type: "text", text: JSON.stringify({ valid: true, name: result.data.name, steps: result.data.steps.length }) }]
          };
        }
        const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
        return {
          content: [{ type: "text", text: JSON.stringify({ valid: false, errors }) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: JSON.stringify({ valid: false, errors: [message] }) }]
        };
      }
    }
  );
}
