import type { TraceCastScript } from "../script/schema.js";

export class Policy {
  constructor(private readonly permissions: TraceCastScript["permissions"]) {}

  assertTerminalAllowed(): void {
    if (this.permissions.terminal !== "allow") {
      throw new Error("Terminal steps require permissions.terminal: allow");
    }
  }

  assertBrowserAllowed(): void {
    if (this.permissions.browser !== "allow") {
      throw new Error("Browser steps require permissions.browser: allow");
    }
  }

  assertNetworkAllowed(): void {
    if (this.permissions.network !== "allow") {
      throw new Error("Network browser steps require permissions.network: allow");
    }
  }
}
