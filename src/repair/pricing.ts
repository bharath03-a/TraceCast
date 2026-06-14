/**
 * Approximate model pricing in USD per million tokens. Used only to show an
 * estimated cost after a repair — not billing-accurate. Unknown models fall
 * back to a conservative default so the number is never wildly low.
 */
type Price = { inputPerMTok: number; outputPerMTok: number };

const PRICING: Record<string, Price> = {
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-opus-4-8": { inputPerMTok: 15, outputPerMTok: 75 }
};

const DEFAULT_PRICE: Price = { inputPerMTok: 3, outputPerMTok: 15 };

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model] ?? DEFAULT_PRICE;
  const cost = (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
