import type { UIMessage } from "ai";

/** Payload the API route streams back as a `data-request-metadata` part. */
export type RequestMetadata = {
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

export const METADATA_PART_TYPE = "data-request-metadata";

export function getMetadata(message: UIMessage): RequestMetadata | null {
  for (const part of message.parts) {
    if (part.type === METADATA_PART_TYPE) {
      return (part as unknown as { data: RequestMetadata }).data;
    }
  }
  return null;
}

export function getText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as unknown as { text: string }).text)
    .join("");
}

export function formatLatency(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatTokens(n: number): string {
  return n.toLocaleString("en-US");
}
