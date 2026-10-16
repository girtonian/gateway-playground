"use client";

// Client-only: useChat generates request ids at render time, so this
// component must not be evaluated during static prerendering (see page.tsx).
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useState, type FormEvent } from "react";
import {
  MODELS,
  DEFAULT_MODEL_ID,
  estimateCost,
  formatCost,
} from "@/lib/models";
import {
  getMetadata,
  getText,
  formatLatency,
  formatTokens,
  type RequestMetadata,
} from "@/lib/chat-utils";
import RaceColumn from "./race-column";
import { TOUR_STEPS, TourOverlay } from "./tour";

type SessionRun = {
  id: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
};

const SUGGESTIONS = [
  "Explain how AI Gateway routing works in one paragraph.",
  "What happens when a provider goes down mid-request?",
  "Compare streaming vs. non-streaming responses for chat UX.",
];

const RACE_MAX_MODELS = 3;

export default function GatewayPlayground() {
  // ── Single mode state ──────────────────────────────────
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [input, setInput] = useState("");

  // ── Mode + race state ──────────────────────────────────
  const [mode, setMode] = useState<"single" | "race">("single");
  const [raceModels, setRaceModels] = useState<string[]>([
    MODELS[0].id,
    MODELS[1].id,
  ]);
  const [race, setRace] = useState<{ id: number; prompt: string } | null>(
    null,
  );
  const [raceInput, setRaceInput] = useState("");
  const [raceResults, setRaceResults] = useState<Record<string, boolean>>({});
  const [raceWinner, setRaceWinner] = useState<string | null>(null);
  const winnerRef = useRef<string | null>(null);
  const raceBusy =
    race !== null && Object.keys(raceResults).length < raceModels.length;

  // ── Session ledger (feeds the cost ticker) ──────────────
  const [sessionRuns, setSessionRuns] = useState<SessionRun[]>([]);
  const recordedRef = useRef<Set<string>>(new Set());

  // ── Guided tour ────────────────────────────────────────
  const [tourStep, setTourStep] = useState<number | null>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }) => {
      const runMetadata = getMetadata(message);
      if (runMetadata?.usage) {
        const usage = runMetadata.usage;
        recordRun({
          id: message.id,
          modelId: runMetadata.requestedModel,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cost: estimateCost(
            runMetadata.requestedModel,
            usage.inputTokens,
            usage.outputTokens,
          ),
        });
        setTourStep((step) =>
          step === 3 ? TOUR_STEPS.length : step,
        );
      }
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const metadata = lastAssistant ? getMetadata(lastAssistant) : null;

  function recordRun(run: SessionRun) {
    if (recordedRef.current.has(run.id)) return;
    recordedRef.current.add(run.id);
    setSessionRuns((prev) => [...prev, run]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    setTourStep((step) => (step === 1 ? 2 : step));
    await sendMessage({ text }, { body: { model, simulateFailure } });
  }

  function toggleRaceModel(id: string) {
    setRaceModels((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((m) => m !== id) : prev;
      }
      return prev.length >= RACE_MAX_MODELS ? prev : [...prev, id];
    });
  }

  function handleRaceSubmit(e: FormEvent) {
    e.preventDefault();
    const text = raceInput.trim();
    if (!text || raceBusy || raceModels.length === 0) return;
    setRaceInput("");
    setRaceResults({});
    setRaceWinner(null);
    winnerRef.current = null;
    setRace({ id: Date.now(), prompt: text });
  }

  function handleRaceColumnDone(
    modelId: string,
    meta: RequestMetadata | null,
  ) {
    setRaceResults((prev) =>
      prev[modelId] ? prev : { ...prev, [modelId]: true },
    );
    if (winnerRef.current === null) {
      winnerRef.current = modelId;
      setRaceWinner(modelId);
    }
    if (meta?.usage) {
      recordRun({
        id: `${race?.id ?? "race"}-${modelId}`,
        modelId: meta.requestedModel,
        inputTokens: meta.usage.inputTokens,
        outputTokens: meta.usage.outputTokens,
        cost: estimateCost(
          meta.requestedModel,
          meta.usage.inputTokens,
          meta.usage.outputTokens,
        ),
      });
    }
  }

  function startTour() {
    if (tourStep !== null) return;
    setMode("single");
    setTourStep(0);
  }

  const activeModel = MODELS.find((m) => m.id === model);
  const sessionTotal = sessionRuns.reduce(
    (sum, r) => sum + (r.cost ?? 0),
    0,
  );
  const runCost =
    metadata?.usage != null
      ? estimateCost(
          metadata.requestedModel,
          metadata.usage.inputTokens,
          metadata.usage.outputTokens,
        )
      : null;

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
            <div className="ml-auto flex items-center gap-2">
              {sessionRuns.length > 0 && (
                <span
                  title={`${sessionRuns.length} run${sessionRuns.length === 1 ? "" : "s"} this session · prices approximate`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-zinc-300"
                >
                  Session · {formatCost(sessionTotal)}
                </span>
              )}
              <button
                type="button"
                onClick={startTour}
                className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                Take the tour
              </button>
            </div>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Gateway Playground
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            One page, four models, one API key. Pick a model, send a prompt,
            and watch what the Gateway actually did — flip the failure switch
            to see failover routing kick in, or race models head to head.
          </p>
        </header>

        {/* ── Controls ───────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                Mode
              </span>
              <div
                role="tablist"
                aria-label="Playground mode"
                className="inline-flex self-start rounded-lg border border-zinc-700 bg-zinc-950 p-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "single"}
                  onClick={() => setMode("single")}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
                    mode === "single"
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "race"}
                  onClick={() => setMode("race")}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
                    mode === "race"
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Race
                </button>
              </div>
            </div>

            {mode === "single" ? (
              <label
                data-tour="model-select"
                className="flex flex-col gap-1.5"
              >
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
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                  Models · pick up to {RACE_MAX_MODELS}
                </span>
                <div className="flex flex-wrap gap-2">
                  {MODELS.map((m) => {
                    const selected = raceModels.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleRaceModel(m.id)}
                        disabled={raceBusy}
                        className={`rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          selected
                            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                            : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={simulateFailure}
            data-tour="chaos-toggle"
            onClick={() => {
              setSimulateFailure((value) => !value);
              if (!simulateFailure) {
                setTourStep((step) => (step === 2 ? 3 : step));
              }
            }}
            disabled={isBusy || raceBusy}
            className="group flex items-center gap-3 self-start disabled:cursor-not-allowed disabled:opacity-40 lg:self-center"
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

        {mode === "single" && activeModel && (
          <p className="mb-6 -mt-2 font-mono text-xs text-zinc-500">
            <span className="text-zinc-400">{activeModel.id}</span>
            {" — "}
            {activeModel.blurb}
          </p>
        )}

        {mode === "race" ? (
          /* ── Race mode ──────────────────────────────────── */
          <section className="flex flex-1 flex-col gap-4">
            {race && (
              <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
                <span className="text-zinc-500">Racing prompt: </span>
                &ldquo;{race.prompt}&rdquo;
              </p>
            )}
            {race ? (
              <div
                className={`grid flex-1 gap-4 ${
                  raceModels.length > 2
                    ? "md:grid-cols-2 xl:grid-cols-3"
                    : "md:grid-cols-2"
                }`}
              >
                {raceModels.map((id) => (
                  <RaceColumn
                    key={`${race.id}-${id}`}
                    modelId={id}
                    prompt={race.prompt}
                    simulateFailure={simulateFailure}
                    isWinner={raceWinner === id}
                    onDone={handleRaceColumnDone}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
                <p className="max-w-sm px-6 text-sm leading-relaxed text-zinc-500">
                  Pick up to three models above, write one prompt, and race
                  them head to head — latency, tokens, and cost, side by side.
                </p>
              </div>
            )}
            <form
              onSubmit={handleRaceSubmit}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex gap-2">
                <textarea
                  value={raceInput}
                  onChange={(e) => setRaceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleRaceSubmit(e);
                    }
                  }}
                  placeholder="One prompt, every selected model…"
                  rows={1}
                  disabled={raceBusy}
                  className="max-h-32 min-h-10 flex-1 resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-zinc-500"
                />
                <button
                  type="submit"
                  disabled={
                    raceBusy || !raceInput.trim() || raceModels.length === 0
                  }
                  className="shrink-0 rounded-xl bg-zinc-100 px-5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Race
                </button>
              </div>
            </form>
            {raceBusy && (
              <p className="font-mono text-[11px] text-zinc-500">
                {Object.keys(raceResults).length}/{raceModels.length} finished…
              </p>
            )}
          </section>
        ) : (
          /* ── Single mode (unchanged) ────────────────────── */
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
                    <button
                      type="button"
                      onClick={startTour}
                      className="mt-5 text-xs font-medium text-emerald-300 underline-offset-4 transition hover:text-emerald-200 hover:underline"
                    >
                      Take the 4-step tour →
                    </button>
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
                data-tour="prompt-form"
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
            <aside
              data-tour="metadata-panel"
              className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
            >
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

                  {metadata.usage && runCost != null && (
                    <div>
                      <dt className="text-[11px] tracking-wide text-zinc-500 uppercase">
                        Est. cost
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs text-zinc-200">
                        {formatCost(runCost)}{" "}
                        <span className="text-zinc-600">· approx</span>
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
        )}

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

      {/* ── Guided tour overlay ──────────────────────────────── */}
      {tourStep !== null && (
        <TourOverlay
          stepIndex={tourStep}
          onNext={() =>
            setTourStep((s) =>
              s === null ? s : Math.min(s + 1, TOUR_STEPS.length),
            )
          }
          onBack={() =>
            setTourStep((s) => (s === null ? s : Math.max(s - 1, 0)))
          }
          onSkip={() => setTourStep(null)}
        />
      )}
    </div>
  );
}
