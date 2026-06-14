import { describe, expect, it } from "vitest";
import { Policy } from "../src/runtime/policy.js";

describe("Policy", () => {
  it("blocks terminal steps unless explicitly allowed", () => {
    const policy = new Policy({});

    expect(() => policy.assertTerminalAllowed()).toThrow("permissions.terminal: allow");
  });

  it("allows browser and network when explicitly granted", () => {
    const policy = new Policy({
      browser: "allow",
      network: "allow"
    });

    expect(() => policy.assertBrowserAllowed()).not.toThrow();
    expect(() => policy.assertNetworkAllowed()).not.toThrow();
  });
});
