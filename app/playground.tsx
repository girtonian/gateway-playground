"use client";

// Client-only: useChat generates request ids at render time, so this
// component must not be evaluated during static prerendering (see page.tsx).
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState, type FormEvent } from "react";
import { MODELS, DEFAULT_MODEL_ID } from "@/lib/models";

/** Payload the API route streams back as a `data-request-metadata` part. */
type RequestMetadata = {
  requestedModel: string;
  resolvedModel: string | null;
  failoverSimulated: boolean;
  latencyMs: number;
  finishReason: string;
  error?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
  gatewayMetadata: unknown;
};

const METADATA_PART_TYPE = "data-request-metadata";

function getMetadata(message: UIMessage): RequestMetadata | null {
  for (const part of message.parts) {
    if (part.type === METADATA_PART_TYPE) {
      return (part as unknown as { data: RequestMetadata }).data;
    }
  }
  return null;
}

function getText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as unknown as { text: string }).text)
    .join("");
}

function formatLatency(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function formatTokens(n: number): string {
  return n.toLocaleString("en-US");
}

const SUGGESTIONS = [
  "Explain how AI Gateway routing works in one paragraph.",
  "What happens when a provider goes down mid-request?",
  "Compare streaming vs. non-streaming responses for chat UX.",
];

export default function GatewayPlayground() {
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const metadata = lastAssistant ? getMetadata(lastAssistant) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    await sendMessage({ text }, { body: { model, simulateFailure } });
  }

  const activeModel = MODELS.find((m) => m.id === model);

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 sm:px-8">
        {/* ── Header ─────────────────────────────────────────── */}
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium tracking-wide text-emerald-300 uppercase">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live via Vercel AI Gateway
            </span>
            <span className="text-[11px] tracking-wide text-zinc-500 uppercase">
              Design engineering demo
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Gateway Playground
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            One page, four models, one API key. Pick a model, send a prompt,
            and watch what the Gateway actually did — then flip the failure
            switch to see failover routing kick in.
          </p>
        </header>

        {/* ── Controls ───────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              Model
            </span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isBusy}
              className="w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 sm:w-72"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.provider}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            role="switch"
            aria-checked={simulateFailure}
            onClick={() => setSimulateFailure((v) => !v)}
            disabled={isBusy}
            className="group flex items-center gap-3 self-start sm:self-center"
          >
            <span className="text-left">
              <span className="block text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                Chaos mode
              </span>
              <span className="block text-sm text-zinc-300">
                Simulate provider failure
              </span>
            </span>
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                simulateFailure ? "bg-amber-400" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-zinc-950 transition-transform ${
                  simulateFailure ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>
        </div>

        {activeModel && (
          <p className="mb-6 -mt-2 font-mono text-xs text-zinc-500">
            <span className="text-zinc-400">{activeModel.id}</span>
            {" — "}
            {activeModel.blurb}
          </p>
        )}

        {/* ── Main grid ──────────────────────────────────────── */}
        <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_340px]">
          {/* Chat column */}
          <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60">
            <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                  <p className="mb-5 max-w-sm text-sm text-zinc-500">
                    No requests yet. Try one of these, or write your own —
                    every response streams through the Gateway.
                  </p>
                  <div className="flex max-w-md flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setInput(s)}
                        className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => {
                const text = getText(message);
                if (message.role === "user") {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-100 px-4 py-2.5 text-sm text-zinc-950">
                        {text}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="max-w-[95%] rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-zinc-200">
                      {text}
                      {status === "streaming" &&
                        message.id === lastAssistant?.id && (
                          <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-emerald-400 align-middle" />
                        )}
                    </div>
                  </div>
                );
              })}

              {status === "submitted" && (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]" />
                  <span className="ml-1">Routing through the Gateway…</span>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  Request failed: {error.message}
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t border-zinc-800 p-4"
            >
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Ask anything…"
                  rows={1}
                  disabled={isBusy}
                  className="max-h-32 min-h-10 flex-1 resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-zinc-500"
                />
                <button
                  type="submit"
                  disabled={isBusy || !input.trim()}
                  className="shrink-0 rounded-xl bg-zinc-100 px-5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </form>
          </section>

          {/* Metadata panel */}
          <aside className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="mb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              What actually happened
            </h2>
            <p className="mb-4 text-xs text-zinc-600">
              Reported by the API route after each request.
            </p>

            {!metadata ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16 text-center">
                <p className="max-w-44 text-xs leading-relaxed text-zinc-600">
                  Send a prompt and the Gateway&apos;s routing decision,
                  latency, and usage will appear here.
                </p>
              </div>
            ) : (
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-[11px] tracking-wide text-zinc-500 uppercase">
                    Requested
                  </dt>
                  <dd className="mt-0.5 font-mono text-xs break-all text-zinc-200">
                    {metadata.requestedModel}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] tracking-wide text-zinc-500 uppercase">
                    Answered by
                  </dt>
                  <dd className="mt-0.5 font-mono text-xs break-all text-zinc-200">
                    {metadata.resolvedModel ?? "—"}
                  </dd>
                  {metadata.failoverSimulated && metadata.resolvedModel && (
                    <dd className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                      Failover: primary 404&apos;d, fallback answered
                    </dd>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[11px] tracking-wide text-zinc-500 uppercase">
                      Latency
                    </dt>
                    <dd className="mt-0.5 font-mono text-xs text-zinc-200">
                      {formatLatency(metadata.latencyMs)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] tracking-wide text-zinc-500 uppercase">
                      Finish
                    </dt>
                    <dd className="mt-0.5 font-mono text-xs text-zinc-200">
                      {metadata.finishReason}
                    </dd>
                  </div>
                </div>

                {metadata.usage && (
                  <div>
                    <dt className="text-[11px] tracking-wide text-zinc-500 uppercase">
                      Tokens
                    </dt>
                    <dd className="mt-0.5 font-mono text-xs text-zinc-200">
                      {formatTokens(metadata.usage.inputTokens)} in ·{" "}
                      {formatTokens(metadata.usage.outputTokens)} out ·{" "}
                      {formatTokens(metadata.usage.totalTokens)} total
                    </dd>
                  </div>
                )}

                {metadata.error && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                    <dt className="text-[11px] tracking-wide text-rose-300 uppercase">
                      Error
                    </dt>
                    <dd className="mt-1 font-mono text-xs break-all text-rose-200">
                      {metadata.error}
                    </dd>
                  </div>
                )}

                {metadata.gatewayMetadata != null && (
                  <details className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <summary className="cursor-pointer text-[11px] tracking-wide text-zinc-500 uppercase">
                      Gateway metadata
                    </summary>
                    <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-zinc-400">
                      {JSON.stringify(metadata.gatewayMetadata, null, 2)}
                    </pre>
                  </details>
                )}
              </dl>
            )}
          </aside>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <footer className="mt-8 flex flex-col gap-1 border-t border-zinc-800/60 pt-5 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Built by Jonathan Girton · Next.js + AI SDK · Routed through Vercel
            AI Gateway
          </p>
          <a
            href="https://vercel.com/ai-gateway"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-500 underline-offset-4 transition hover:text-zinc-300 hover:underline"
          >
            vercel.com/ai-gateway
          </a>
        </footer>
      </div>
    </div>
  );
}
