import { zodToJsonSchema } from "zod-to-json-schema";
import { traceCastScriptSchema } from "../script/schema.js";

export function exportJsonSchema(): Record<string, unknown> {
  const schema = zodToJsonSchema(traceCastScriptSchema, {
    name: "TraceCastScript",
    $refStrategy: "none",
    markdownDescription: true
  }) as Record<string, unknown>;

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "TraceCastScript",
    description:
      "A TraceCast workflow script. Define steps across terminal and browser to produce reproducible demo recordings.",
    ...schema
  };
}
