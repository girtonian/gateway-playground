# Gateway Playground

A single-page demo of **Vercel AI Gateway**, built by Jonathan Girton as a
portfolio piece for a Design Engineer application. Pick one of four models,
send a prompt, and watch what the Gateway actually did — routing decision,
latency, token usage, and estimated cost — in the "What actually happened"
panel. Flip the **Chaos mode** switch to simulate a provider failure and see
gateway failover routing answer via the fallback model. Or switch to **Race
mode** and watch up to three models answer the same prompt head to head.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS · AI SDK v7
(`streamText` + `gateway()` + `createUIMessageStream`).

## Modes

- **Single** — one model, one prompt, one streamed response, with the metadata
  panel showing routing decision, latency, tokens, finish reason, gateway
  metadata, and estimated cost.
- **Race** — pick up to three models (chips in the controls bar), send one
  prompt, and each model streams in its own column with a live elapsed timer.
  Each column footer shows final latency, tokens, and cost; the first to
  finish gets a "Fastest" badge. Chaos mode works here too — every lane
  fails over independently.
- **Take the tour** — a 4-step guided overlay (pick a model → send a prompt →
  flip chaos mode → watch failover). Skippable anytime via the button or
  Escape; steps auto-advance when the action is detected.

## Cost estimates

Per-model pricing lives in `lib/models.ts` (`MODEL_PRICING`) and is
**approximate** — rough public list prices per 1M tokens, hand-checked, not
live or verified, and they drift. The header shows a running **session
total** across all runs; each run's cost appears in the metadata panel
(single mode) or the column footer (race mode). Do not quote these numbers
anywhere that matters; check the provider's pricing page or AI Gateway
billing for real figures.

## Setup

### 1. Get an AI Gateway API key

1. Open the [Vercel dashboard](https://vercel.com/dashboard) and go to
   **AI Gateway**.
2. Open **API Keys** and create a key.
3. Copy `.env.local.example` to `.env.local` and paste the key:

```bash
cp .env.local.example .env.local
# then set AI_GATEWAY_API_KEY=... in .env.local
```

(When deployed on Vercel, the key is provided automatically — no `.env.local`
needed.)

### 2. Install and run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Deploy

```bash
vercel
```

Then in the Vercel dashboard, open the project → **Settings → Environment
Variables** and add `AI_GATEWAY_API_KEY` (paste the key from step 1).
Redeploy so the variable takes effect. On Vercel the variable is also
auto-provisioned for AI Gateway-enabled projects.

## How it works

- `app/api/chat/route.ts` — streams via `gateway("<provider>/<model>")` and
  attaches a `data-request-metadata` part (latency, tokens, finish reason,
  gateway metadata) to the UI message stream.
- `app/page.tsx` — the playground shell: header, controls, mode switch, and
  layout.
- `app/playground.tsx` — single mode UI, race orchestration, session cost
  ledger, and the tour state machine.
- `app/race-column.tsx` — one race lane: its own `useChat` session firing a
  parallel POST to `/api/chat` on mount, with live elapsed timer and a
  stats footer.
- `app/tour.tsx` — the guided-tour overlay (dimmed backdrop, pulsing
  spotlight on `[data-tour]` targets, helper card with Next/Back/Skip).
- `lib/models.ts` — the four demo models plus the approximate pricing table.
  IDs verified against the installed `@ai-sdk/gateway` type definitions;
  `anthropic/claude-haiku-5.5` and `google/gemini-3.8-flash` also confirmed
  on the live [AI Gateway model catalog](https://vercel.com/ai-gateway/models)
  (2026-10-13). Note: the catalog's xAI provider slug is `spacexai`, not
  `xai`.
- `lib/chat-utils.ts` — shared stream helpers (metadata/text extraction,
  latency and token formatting).

**Chaos mode** points the request at a deliberately invalid model id. The
Gateway 404s and retries the configured `providerOptions.gateway.models`
fallback — the panel shows the fallback answering. Failover behavior follows
the documented gateway semantics; verify it live once deployed.

## Notes

- This is a demo, not a product: no auth, no rate limiting, no persistence.
  Don't ship it as-is beyond a portfolio link.
- Model availability changes over time; if a dropdown model 404s, check the
  [model catalog](https://vercel.com/ai-gateway/models) and update
  `lib/models.ts`.
