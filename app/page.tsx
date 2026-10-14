import { Suspense } from "react";
import Playground from "./playground";

// The playground generates request ids at render time (useChat), which can't
// be evaluated during static prerendering — the Suspense boundary keeps it
// client-rendered.
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950" aria-label="Loading" />
      }
    >
      <Playground />
    </Suspense>
  );
}
