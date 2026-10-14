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
