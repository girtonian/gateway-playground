"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { MODELS, estimateCost, formatCost } from "@/lib/models";
import {
  getMetadata,
  getText,
  formatLatency,
  formatTokens,
  type RequestMetadata,
} from "@/lib/chat-utils";

type RaceColumnProps = {
  raceId: string;
  modelId: string;
  prompt: string;
  simulateFailure: boolean;
  /** True once this column was the first to finish. */
  isWinner: boolean;
  onDone: (
    raceId: string,
    modelId: string,
    meta: RequestMetadata | null,
  ) => void;
};

/**
 * One lane of a model race. Owns an independent useChat session and fires its
 * request on mount, so N columns == N parallel POSTs to /api/chat reusing the
 * exact same streaming plumbing as single mode.
 */
export default function RaceColumn({
  raceId,
  modelId,
  prompt,
  simulateFailure,
  isWinner,
  onDone,
}: RaceColumnProps) {
  const sentRef = useRef(false);
  const doneRef = useRef(false);
  const startedAtRef = useRef(0);
  const onDoneRef = useRef(onDone);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [requestEnded, setRequestEnded] = useState(false);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setRequestEnded(true);
      onDoneRef.current(raceId, modelId, null);
    },
    onFinish: ({ message, isAbort, isDisconnect, isError }) => {
      if (doneRef.current) return;
      doneRef.current = true;
      setRequestEnded(true);
      const finalMetadata = getMetadata(message);
      onDoneRef.current(
        raceId,
        modelId,
        isAbort || isDisconnect || isError ? null : finalMetadata,
      );
    },
  });

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const isBusy = status === "submitted" || status === "streaming";
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const metadata = lastAssistant ? getMetadata(lastAssistant) : null;
  const text = lastAssistant ? getText(lastAssistant) : "";

  // Fire once on mount (parent remounts per race via key).
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    startedAtRef.current = Date.now();
    sendMessage({ text: prompt }, { body: { model: modelId, simulateFailure } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live elapsed timer while streaming.
  useEffect(() => {
    if (!isBusy) return;
    const t = setInterval(
      () => setElapsedMs(Date.now() - startedAtRef.current),
      100,
    );
    return () => clearInterval(t);
  }, [isBusy]);

  const model = MODELS.find((m) => m.id === modelId);
  const finished = metadata !== null;
  const cost =
    metadata?.usage != null
      ? estimateCost(
          metadata.requestedModel,
          metadata.usage.inputTokens,
          metadata.usage.outputTokens,
        )
      : null;
  const creditError =
    metadata?.error?.includes("Free tier users do not have access to this model") ??
    error?.message.includes("Free tier users do not have access to this model") ??
    false;
  const errorMessage = metadata?.error
    ? creditError
      ? "This model requires paid credits on your Gateway account. The free tier does not include access."
      : metadata.error
    : error?.message
      ? creditError
        ? "This model requires paid credits on your Gateway account. The free tier does not include access."
        : error.message
      : null;

  return (
    <div className="flex min-h-[380px] flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60">
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">
            {model?.label ?? modelId}
          </p>
          <p className="truncate font-mono text-[11px] text-zinc-500">
            {modelId}
          </p>
        </div>
        {isWinner && finished ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            <span aria-hidden>⚑</span> Fastest
          </span>
        ) : (
          isBusy && (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              racing
            </span>
          )
        )}
      </div>

      {/* Streamed text */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {text ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-200">
            {text}
            {isBusy && (
              <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-emerald-400 align-middle" />
            )}
          </p>
        ) : !errorMessage && !requestEnded ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]" />
            <span className="ml-1">Routing…</span>
          </div>
        ) : null}
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
            Request failed: {errorMessage}
          </div>
        )}
        {requestEnded && !errorMessage && !metadata && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
            Request ended before a response was completed.
          </div>
        )}
        {metadata?.failoverSimulated && metadata.resolvedModel && (
          <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            Failover: fallback answered
          </p>
        )}
      </div>

      {/* Stats footer */}
      <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 px-4 py-3 font-mono text-[11px]">
        <div>
          <p className="tracking-wide text-zinc-600 uppercase">Latency</p>
          <p className="mt-0.5 text-zinc-200">
            {finished && metadata
              ? formatLatency(metadata.latencyMs)
              : formatLatency(elapsedMs)}
          </p>
        </div>
        <div>
          <p className="tracking-wide text-zinc-600 uppercase">Tokens</p>
          <p className="mt-0.5 text-zinc-200">
            {metadata?.usage ? formatTokens(metadata.usage.totalTokens) : "—"}
          </p>
        </div>
        <div>
          <p className="tracking-wide text-zinc-600 uppercase">Cost</p>
          <p className="mt-0.5 text-zinc-200">
            {cost != null ? formatCost(cost) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
