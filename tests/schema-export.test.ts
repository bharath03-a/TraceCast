import { describe, expect, it } from "vitest";
import { exportJsonSchema } from "../src/schema/export.js";

describe("exportJsonSchema", () => {
  it("returns an object with $schema and title", () => {
    const schema = exportJsonSchema();
    expect(schema["$schema"]).toBe("http://json-schema.org/draft-07/schema#");
    expect(schema["title"]).toBe("TraceCastScript");
  });

  it("includes all step types in the output", () => {
    const json = JSON.stringify(exportJsonSchema());
    expect(json).toContain("terminal");
    expect(json).toContain("browser");
    expect(json).toContain("wait");
    expect(json).toContain("screenshot");
    expect(json).toContain("assert");
  });

  it("includes recording.output format enum", () => {
    const json = JSON.stringify(exportJsonSchema());
    expect(json).toContain("webm");
    expect(json).toContain("mp4");
    expect(json).toContain("gif");
  });

  it("produces valid JSON", () => {
    const schema = exportJsonSchema();
    expect(() => JSON.stringify(schema)).not.toThrow();
  });
});
