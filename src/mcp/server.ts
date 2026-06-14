import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerValidateTool } from "./tools/validate.js";
import { registerRunTool } from "./tools/run.js";
import { registerGetArtifactsTool } from "./tools/get-artifacts.js";
import { registerGetEventLogTool } from "./tools/get-event-log.js";
import { registerGenerateScriptTool } from "./tools/generate-script.js";

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: "tracecast",
    version: "0.1.0"
  });

  registerValidateTool(server);
  registerRunTool(server);
  registerGetArtifactsTool(server);
  registerGetEventLogTool(server);
  registerGenerateScriptTool(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
