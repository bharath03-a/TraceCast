import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { traceCastScriptSchema, type TraceCastScript } from "./schema.js";

export async function loadTraceCastScript(scriptPath: string): Promise<TraceCastScript> {
  const raw = await readFile(scriptPath, "utf8");
  const parsed = parse(raw);
  const result = traceCastScriptSchema.safeParse(parsed);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "script";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    throw new Error(`Invalid TraceCast script: ${details}`);
  }

  return result.data;
}
