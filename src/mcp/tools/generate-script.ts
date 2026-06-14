import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exportJsonSchema } from "../../schema/export.js";

export function registerGenerateScriptTool(server: McpServer): void {
  server.tool(
    "generate_script",
    "Get a TraceCast YAML skeleton and the full JSON Schema to help you generate a valid script for a given goal.",
    {
      goal: z.string().describe("What the demo should show (e.g. 'show user login flow', 'demo the CLI help command')"),
      permissions: z
        .object({
          terminal: z.enum(["allow", "deny"]).optional(),
          browser: z.enum(["allow", "deny"]).optional(),
          network: z.enum(["allow", "deny"]).optional()
        })
        .optional()
        .describe("Permissions the script will need")
    },
    ({ goal, permissions }) => {
      const perms = permissions ?? {};
      const permBlock = Object.entries(perms)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join("\n");

      const skeleton = [
        `name: ${goal.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`,
        "",
        "permissions:",
        permBlock || "  # terminal: allow\n  # browser: allow\n  # network: allow",
        "",
        "recording:",
        "  cursor:",
        "    visible: true",
        "    clickEmphasis: true",
        "  pacing:",
        "    actionDelayMs: 600",
        "",
        "steps:",
        "  # Add your steps here. Examples:",
        "  # - terminal:",
        "  #     run: echo hello",
        "  # - browser:",
        "  #     open: https://example.com",
        "  # - assert:",
        "  #     selector: \"#result\"",
        "  #     contains: \"expected text\"",
        "  #     label: result-check"
      ].join("\n");

      const schema = exportJsonSchema();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            goal,
            skeleton,
            schema,
            instructions: "Fill in the steps array based on the goal. Use assert steps to verify UI state. Validate with the `validate` tool before running."
          }, null, 2)
        }]
      };
    }
  );
}
