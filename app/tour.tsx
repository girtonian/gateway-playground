"use client";

import { useEffect } from "react";

export type TourStepDef = {
  /** Value of the data-tour attribute to spotlight, or null for a centered card. */
  target: string | null;
  title: string;
  instruction: string;
};

export const TOUR_STEPS: TourStepDef[] = [
  {
    target: "model-select",
    title: "Pick a model",
    instruction:
      "Any of the four works — they all route through the same Gateway API key.",
  },
  {
    target: "prompt-form",
    title: "Send a prompt",
    instruction:
      "Type anything and hit Send. The response streams straight through the Gateway.",
  },
  {
    target: "chaos-toggle",
    title: "Flip chaos mode",
    instruction:
      "This aims the next request at a model id that doesn't exist. The Gateway will 404.",
  },
  {
    target: "metadata-panel",
    title: "Watch failover rescue it",
    instruction:
      "Send one more prompt — your model answers as the fallback, and the amber badge in this panel tells the story.",
  },
];

type TourOverlayProps = {
  /** 0-based step index; TOUR_STEPS.length means the completion card. */
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

/**
 * Lightweight guided tour: dimmed backdrop, pulsing spotlight ring on the
 * target element (via data-tour attribute), and a helper card with
 * Next/Back/Skip. Skippable at any point via button or Escape.
 */
export function TourOverlay({ stepIndex, onNext, onBack, onSkip }: TourOverlayProps) {
  const done = stepIndex >= TOUR_STEPS.length;
  const step = done ? null : TOUR_STEPS[stepIndex];

  useEffect(() => {
    if (!step?.target) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;
    el.classList.add("tour-spotlight");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => el.classList.remove("tour-spotlight");
  }, [step]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSkip]);

  return (
    <>
      {/* Backdrop stays click-through so the spotlighted control keeps working. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40 bg-black/60"
      />
      <div
        role="dialog"
        aria-label={done ? "Tour complete" : `Tour step ${stepIndex + 1}: ${step?.title}`}
        className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl shadow-black/60"
      >
        {done ? (
          <>
            <p className="text-[11px] font-medium tracking-wide text-emerald-300 uppercase">
              Tour complete
            </p>
            <h3 className="mt-1 text-base font-semibold text-zinc-100">
              That&apos;s the Gateway in 60 seconds
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              One API key, many models, visible routing — and failover when a
              provider goes down. Now try race mode to watch models compete
              head to head.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onSkip}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          step && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium tracking-wide text-emerald-300 uppercase">
                  Step {stepIndex + 1} of {TOUR_STEPS.length}
                </p>
                <div className="flex gap-1.5" aria-hidden>
                  {TOUR_STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${
                        i === stepIndex ? "bg-emerald-400" : "bg-zinc-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <h3 className="mt-1.5 text-base font-semibold text-zinc-100">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                {step.instruction}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-xs text-zinc-500 underline-offset-4 transition hover:text-zinc-300 hover:underline"
                >
                  Skip tour
                </button>
                <div className="flex gap-2">
                  {stepIndex > 0 && (
                    <button
                      type="button"
                      onClick={onBack}
                      className="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onNext}
                    className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
                  >
                    {stepIndex === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </>
  );
}
