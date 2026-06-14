import { describe, expect, it } from "vitest";
import { buildRepairPrompt, parseRepairResponse } from "../src/repair/prompt.js";

describe("buildRepairPrompt", () => {
  it("embeds the schema and repair context", () => {
    const prompt = buildRepairPrompt("REPAIR_CONTEXT_HERE", '{"title":"TraceCastScript"}');
    expect(prompt.user).toContain("REPAIR_CONTEXT_HERE");
    expect(prompt.user).toContain("TraceCastScript");
    expect(prompt.system).toContain("TraceCast script repair assistant");
  });
});

describe("parseRepairResponse", () => {
  it("extracts YAML from a fenced block and the explanation", () => {
    const content = [
      "Here is the fix:",
      "```yaml",
      "name: demo",
      "steps:",
      "  - wait: { seconds: 1 }",
      "```",
      "Explanation: changed the selector to #main-title."
    ].join("\n");
    const result = parseRepairResponse(content);
    expect(result.yaml).toContain("name: demo");
    expect(result.yaml).not.toContain("```");
    expect(result.explanation).toBe("changed the selector to #main-title.");
  });

  it("falls back to whole content when no fence present", () => {
    const result = parseRepairResponse("name: demo\nsteps: []");
    expect(result.yaml).toContain("name: demo");
  });

  it("handles ```yml fence variant", () => {
    const result = parseRepairResponse("```yml\nname: x\n```");
    expect(result.yaml).toBe("name: x");
  });
});
