# Gateway Playground

A single-page demo of **Vercel AI Gateway**, built by Jonathan Girton as a
portfolio piece for a Design Engineer application. Pick one of four models,
send a prompt, and watch what the Gateway actually did — routing decision,
latency, and token usage — in the "What actually happened" panel. Flip the
**Chaos mode** switch to simulate a provider failure and see gateway failover
routing answer via the fallback model.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS · AI SDK v7
(`streamText` + `gateway()` + `createUIMessageStream`).

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
- `app/page.tsx` — the playground UI: model dropdown, prompt input, streamed
  responses, and the metadata panel.
- `lib/models.ts` — the four demo models. IDs verified against the installed
  `@ai-sdk/gateway` type definitions; `anthropic/claude-haiku-5.5` and
  `google/gemini-3.8-flash` also confirmed on the live
  [AI Gateway model catalog](https://vercel.com/ai-gateway/models)
  (2026-10-13). Note: the catalog's xAI provider slug is `spacexai`, not
  `xai`.

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
