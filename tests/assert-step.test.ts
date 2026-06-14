import { describe, expect, it } from "vitest";
import { traceCastScriptSchema } from "../src/script/schema.js";

describe("assert step schema", () => {
  it("accepts a valid assert with selector + contains", () => {
    const result = traceCastScriptSchema.safeParse({
      name: "test",
      permissions: { browser: "allow" },
      steps: [
        { browser: { open: "https://example.com" } },
        { assert: { selector: "#title", contains: "Hello" } }
      ]
    });
    expect(result.success).toBe(true);
  });

  it("accepts a visible assertion", () => {
    const result = traceCastScriptSchema.safeParse({
      name: "test",
      permissions: { browser: "allow" },
      steps: [
        { browser: { open: "https://example.com" } },
        { assert: { selector: "#btn", visible: true, label: "button-visible" } }
      ]
    });
    expect(result.success).toBe(true);
  });

  it("accepts a page-level text assertion", () => {
    const result = traceCastScriptSchema.safeParse({
      name: "test",
      permissions: { browser: "allow" },
      steps: [
        { browser: { open: "https://example.com" } },
        { assert: { text: "Welcome to TraceCast" } }
      ]
    });
    expect(result.success).toBe(true);
  });

  it("accepts a URL assertion", () => {
    const result = traceCastScriptSchema.safeParse({
      name: "test",
      permissions: { browser: "allow" },
      steps: [
        { browser: { open: "https://example.com/dashboard" } },
        { assert: { url: "dashboard" } }
      ]
    });
    expect(result.success).toBe(true);
  });

  it("rejects an assert with no condition", () => {
    const result = traceCastScriptSchema.safeParse({
      name: "test",
      permissions: { browser: "allow" },
      steps: [
        { assert: { label: "empty" } }
      ]
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys in assert", () => {
    const result = traceCastScriptSchema.safeParse({
      name: "test",
      permissions: { browser: "allow" },
      steps: [
        { assert: { selector: "#x", contains: "y", unknownKey: true } }
      ]
    });
    expect(result.success).toBe(false);
  });
});
