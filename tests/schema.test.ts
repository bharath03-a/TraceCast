import { describe, expect, it } from "vitest";
import { traceCastScriptSchema } from "../src/script/schema.js";

describe("traceCastScriptSchema", () => {
  it("accepts the MVP script shape", () => {
    const result = traceCastScriptSchema.safeParse({
      name: "hello-tracecast",
      permissions: {
        terminal: "allow",
        browser: "allow",
        network: "allow"
      },
      recording: {
        viewport: {
          width: 1280,
          height: 720
        }
      },
      steps: [
        { terminal: { run: "echo hello" } },
        { browser: { open: "https://example.com" } },
        { wait: { seconds: 1 } }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects scripts without a name", () => {
    const result = traceCastScriptSchema.safeParse({
      steps: [{ terminal: { run: "echo hello" } }]
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown step shapes", () => {
    const result = traceCastScriptSchema.safeParse({
      name: "bad-script",
      steps: [{ export: { format: "mp4" } }]
    });

    expect(result.success).toBe(false);
  });
});
