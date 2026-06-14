export type RepairPrompt = {
  system: string;
  user: string;
};

const SYSTEM_PROMPT = `You are a TraceCast script repair assistant.

TraceCast runs "demo-as-code" YAML scripts that drive a terminal and a browser to
produce reproducible recordings. A script just failed. Your job: return a corrected
version of the YAML that fixes the failure while preserving the author's intent.

Rules:
- Output MUST be a single fenced \`\`\`yaml code block containing the COMPLETE corrected script.
- The script MUST validate against the provided JSON Schema. Do not invent step types or keys.
- Make the SMALLEST change that fixes the failure. Do not restructure working steps.
- Common fixes: wrong CSS selector, missing wait before an assert/click, asserting text
  that never appears, a terminal command that exits non-zero, a permission not granted.
- If the failure is a bad selector, prefer a more robust selector over a guessed one.
- After the code block, add a short "Explanation:" line describing what you changed and why.
- Never include secrets, comments with credentials, or unrelated steps.`;

/**
 * Build the system + user prompt for a repair request. Separated from the LLM
 * client so the prompt content can be asserted in tests.
 */
export function buildRepairPrompt(repairContextMarkdown: string, schemaJson: string): RepairPrompt {
  const user = [
    "## JSON Schema (the corrected YAML must validate against this)",
    "",
    "```json",
    schemaJson,
    "```",
    "",
    "## Repair Context",
    "",
    repairContextMarkdown,
    "",
    "Return the corrected script as a single ```yaml code block, then an Explanation line."
  ].join("\n");

  return { system: SYSTEM_PROMPT, user };
}

/**
 * Extract the YAML body and a human explanation from an LLM response. Falls back
 * to treating the whole response as YAML if no fenced block is present.
 */
export function parseRepairResponse(content: string): { yaml: string; explanation: string } {
  const fenceMatch = content.match(/```ya?ml\s*\n([\s\S]*?)```/u);
  if (fenceMatch && fenceMatch[1]) {
    const yaml = fenceMatch[1].trim();
    const after = content.slice(fenceMatch.index! + fenceMatch[0].length);
    const explanation = extractExplanation(after) || extractExplanation(content) || "";
    return { yaml, explanation };
  }
  return { yaml: content.trim(), explanation: extractExplanation(content) };
}

function extractExplanation(text: string): string {
  const match = text.match(/Explanation:\s*([\s\S]+)/iu);
  if (match && match[1]) {
    return match[1].trim();
  }
  return "";
}
