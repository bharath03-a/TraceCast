import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmClient } from "../src/repair/anthropic-client.js";
import { repairScript } from "../src/repair/repair.js";

const VALID_YAML = [
  "name: demo",
  "permissions:",
  "  browser: allow",
  "steps:",
  "  - browser: { open: https://example.com }",
  "  - assert: { selector: '#main', contains: Hello }"
].join("\n");

let runDir: string;

beforeEach(async () => {
  runDir = await mkdtemp(path.join(tmpdir(), "tracecast-repair-"));
  await writeFile(path.join(runDir, "repair-context.md"), "# Repair Context\nFailure: bad selector", "utf8");
});

afterEach(async () => {
  await rm(runDir, { recursive: true, force: true });
});

describe("repairScript", () => {
  it("returns a valid patched script on first attempt", async () => {
    const client: LlmClient = vi.fn().mockResolvedValue({
      content: "```yaml\n" + VALID_YAML + "\n```\nExplanation: fixed selector.",
      inputTokens: 1000,
      outputTokens: 200
    });

    const result = await repairScript({ runDir, model: "claude-haiku-4-5", client });

    expect(result.valid).toBe(true);
    expect(result.patchedYaml).toContain("name: demo");
    expect(result.explanation).toBe("fixed selector.");
    expect(client).toHaveBeenCalledTimes(1);
    // haiku: $1/Mtok in + $5/Mtok out => (1000*1 + 200*5)/1e6 = 0.002
    expect(result.costUsd).toBeCloseTo(0.002, 6);
  });

  it("retries once with the validation error when the first attempt is invalid", async () => {
    const client: LlmClient = vi
      .fn()
      .mockResolvedValueOnce({
        content: "```yaml\nname: demo\nsteps: []\n```",
        inputTokens: 500,
        outputTokens: 100
      })
      .mockResolvedValueOnce({
        content: "```yaml\n" + VALID_YAML + "\n```",
        inputTokens: 600,
        outputTokens: 120
      });

    const result = await repairScript({ runDir, client });

    expect(client).toHaveBeenCalledTimes(2);
    expect(result.valid).toBe(true);
    // Tokens accumulate across both attempts.
    expect(result.inputTokens).toBe(1100);
    expect(result.outputTokens).toBe(220);

    const secondCall = (client as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(secondCall.user).toContain("Previous attempt was INVALID");
  });

  it("returns invalid result (not throwing) after two failed attempts", async () => {
    const client: LlmClient = vi.fn().mockResolvedValue({
      content: "```yaml\nname: demo\nsteps: []\n```",
      inputTokens: 100,
      outputTokens: 50
    });

    const result = await repairScript({ runDir, client });

    expect(client).toHaveBeenCalledTimes(2);
    expect(result.valid).toBe(false);
    expect(result.validationError).toBeDefined();
    expect(result.patchedYaml).toContain("name: demo");
  });

  it("throws a clear error when repair-context.md is missing", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "tracecast-empty-"));
    await expect(repairScript({ runDir: empty, client: vi.fn() })).rejects.toThrow(/No repair-context\.md/u);
    await rm(empty, { recursive: true, force: true });
  });
});
