import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { exportJsonSchema } from "../schema/export.js";
import { traceCastScriptSchema } from "../script/schema.js";
import { createAnthropicClient, type LlmClient } from "./anthropic-client.js";
import { estimateCostUsd } from "./pricing.js";
import { buildRepairPrompt, parseRepairResponse } from "./prompt.js";

export const DEFAULT_REPAIR_MODEL = "claude-haiku-4-5";

export type RepairOptions = {
  /** Run directory containing `repair-context.md` (produced by a failed run). */
  runDir: string;
  model?: string;
  /** Injectable client; defaults to the Anthropic-backed client. */
  client?: LlmClient;
};

export type RepairResult = {
  patchedYaml: string;
  explanation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** True if the patched YAML validated against the TraceCast schema. */
  valid: boolean;
  /** Validation error when `valid` is false (raw output is still returned). */
  validationError?: string;
};

function resolveModel(explicit?: string): string {
  return explicit ?? process.env.TRACECAST_REPAIR_MODEL ?? DEFAULT_REPAIR_MODEL;
}

function validateYaml(yaml: string): { ok: true } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = parse(yaml);
  } catch (error) {
    return { ok: false, error: `YAML parse error: ${error instanceof Error ? error.message : String(error)}` };
  }

  const result = traceCastScriptSchema.safeParse(parsed);
  if (result.success) {
    return { ok: true };
  }

  const details = result.error.issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "script"}: ${issue.message}`)
    .join("; ");
  return { ok: false, error: `Schema validation failed: ${details}` };
}

/**
 * Repair a failed TraceCast run: read its repair context, ask an LLM for a
 * corrected script, validate it, and retry once with the validation error fed
 * back if the first attempt is invalid. Never silently discards LLM output —
 * the raw patched YAML and the validation error are always returned.
 */
export async function repairScript(options: RepairOptions): Promise<RepairResult> {
  const model = resolveModel(options.model);

  const contextPath = path.join(options.runDir, "repair-context.md");
  let repairContext: string;
  try {
    repairContext = await readFile(contextPath, "utf8");
  } catch {
    throw new Error(
      `No repair-context.md found in ${options.runDir}. Run a failing script first so the context is generated.`
    );
  }

  // Create the client only after we know there is something to repair, so a
  // missing context reports the real problem instead of a missing API key.
  const client = options.client ?? createAnthropicClient();

  const schemaJson = JSON.stringify(exportJsonSchema(), null, 2);
  let prompt = buildRepairPrompt(repairContext, schemaJson);

  let inputTokens = 0;
  let outputTokens = 0;
  let lastYaml = "";
  let lastExplanation = "";
  let lastError = "";

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await client({ system: prompt.system, user: prompt.user, model });
    inputTokens += response.inputTokens;
    outputTokens += response.outputTokens;

    const { yaml, explanation } = parseRepairResponse(response.content);
    lastYaml = yaml;
    lastExplanation = explanation;

    const validation = validateYaml(yaml);
    if (validation.ok) {
      return {
        patchedYaml: yaml,
        explanation,
        model,
        inputTokens,
        outputTokens,
        costUsd: estimateCostUsd(model, inputTokens, outputTokens),
        valid: true
      };
    }

    lastError = validation.error;
    if (attempt < maxAttempts) {
      prompt = {
        system: prompt.system,
        user: `${prompt.user}\n\n## Previous attempt was INVALID\n\n${validation.error}\n\nReturn a corrected script that fixes this validation error.`
      };
    }
  }

  return {
    patchedYaml: lastYaml,
    explanation: lastExplanation,
    model,
    inputTokens,
    outputTokens,
    costUsd: estimateCostUsd(model, inputTokens, outputTokens),
    valid: false,
    validationError: lastError
  };
}
