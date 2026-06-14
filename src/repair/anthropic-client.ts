import Anthropic from "@anthropic-ai/sdk";

export type LlmResponse = {
  content: string;
  inputTokens: number;
  outputTokens: number;
};

export type LlmRequest = {
  system: string;
  user: string;
  model: string;
};

/**
 * Minimal LLM call signature. Injectable so `repairScript` can run against a
 * stub in tests without network or an API key.
 */
export type LlmClient = (request: LlmRequest) => Promise<LlmResponse>;

const MAX_TOKENS = 4096;

/**
 * Create an Anthropic-backed LLM client. Reads ANTHROPIC_API_KEY at call time so
 * importing this module never throws.
 */
export function createAnthropicClient(): LlmClient {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured — set it before running `tracecast repair`.");
  }

  const client = new Anthropic({ apiKey });

  return async ({ system, user, model }) => {
    const message = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }]
    });

    const content = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      content,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens
    };
  };
}
