export type GatewayModel = {
  /** Full AI Gateway model id: "provider/model". */
  id: string;
  label: string;
  provider: string;
  blurb: string;
};

// Model IDs verified against the installed @ai-sdk/gateway type definitions
// (GatewayModelId in node_modules/@ai-sdk/gateway).
// `anthropic/claude-haiku-5.5` and `google/gemini-3.8-flash` were additionally
// confirmed on the live https://vercel.com/ai-gateway/models catalog (2026-10-13).
// Note: the catalog's xAI provider slug is `spacexai`, not `xai`.
export const MODELS: GatewayModel[] = [
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "OpenAI",
    blurb: "Fast, cheap, and everywhere — the gateway's canonical example.",
  },
  {
    id: "anthropic/claude-haiku-5.5",
    label: "Claude Haiku 5.5",
    provider: "Anthropic",
    blurb: "Anthropic's fastest tier — sub-second latency on the live catalog.",
  },
  {
    id: "google/gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    provider: "Google",
    blurb: "Google's speed tier, served via Google and Vertex AI.",
  },
  {
    id: "spacexai/grok-4.1-fast-non-reasoning",
    label: "Grok 4.1 Fast",
    provider: "xAI",
    blurb: "xAI's fast non-reasoning tier (catalog slug: spacexai).",
  },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;

/**
 * Approximate public list prices, USD per 1M tokens.
 * These are rough, hand-checked approximations used ONLY for demo cost
 * estimates — they are NOT live or verified, and provider pricing drifts.
 * Check the provider's pricing page (or AI Gateway billing) for real numbers
 * before quoting them anywhere that matters.
 */
export const MODEL_PRICING: Record<
  string,
  { inputPer1M: number; outputPer1M: number }
> = {
  "openai/gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "anthropic/claude-haiku-5.5": { inputPer1M: 1.0, outputPer1M: 5.0 },
  "google/gemini-3.8-flash": { inputPer1M: 0.5, outputPer1M: 2.0 },
  "spacexai/grok-4.1-fast-non-reasoning": { inputPer1M: 0.2, outputPer1M: 0.5 },
};

/**
 * Estimated USD cost of a single run. Returns null when the model has no
 * pricing entry — callers should render "—" rather than $0.0000.
 */
export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const p = MODEL_PRICING[modelId];
  if (!p) return null;
  return (
    (inputTokens / 1_000_000) * p.inputPer1M +
    (outputTokens / 1_000_000) * p.outputPer1M
  );
}

/** Format a USD micro-amount, e.g. "$0.0042". */
export function formatCost(usd: number): string {
  if (usd < 0.00005) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}
