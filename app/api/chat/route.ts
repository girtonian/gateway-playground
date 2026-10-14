import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  gateway,
  type UIMessage,
} from "ai";

export const maxDuration = 60;

type ChatRequest = {
  messages: UIMessage[];
  model: string;
  simulateFailure: boolean;
};

// Deliberately invalid model id. The AI Gateway 404s on it, which triggers the
// configured fallback model — a live demonstration of gateway failover routing.
const BROKEN_MODEL_ID = "openai/gateway-playground-does-not-exist";

export async function POST(req: Request) {
  const { messages, model, simulateFailure }: ChatRequest = await req.json();
  const startedAt = Date.now();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: gateway(simulateFailure ? BROKEN_MODEL_ID : model),
        messages: await convertToModelMessages(messages),
        // Failover chain: if the primary model errors, the Gateway retries
        // these in order. With the broken primary id above, the selected
        // model always answers as the fallback.
        ...(simulateFailure
          ? { providerOptions: { gateway: { models: [model] } } }
          : {}),
        onFinish: ({ usage, finishReason, providerMetadata }) => {
          writer.write({
            type: "data-request-metadata",
            data: {
              requestedModel: model,
              // When failover is simulated, the request was routed to the
              // fallback model after the primary 404'd.
              resolvedModel: model,
              failoverSimulated: simulateFailure,
              latencyMs: Date.now() - startedAt,
              finishReason,
              usage: {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
              },
              gatewayMetadata: providerMetadata?.gateway ?? null,
            },
          });
        },
        onError: ({ error }) => {
          writer.write({
            type: "data-request-metadata",
            data: {
              requestedModel: model,
              resolvedModel: null,
              failoverSimulated: simulateFailure,
              latencyMs: Date.now() - startedAt,
              finishReason: "error",
              error: error instanceof Error ? error.message : String(error),
              usage: null,
              gatewayMetadata: null,
            },
          });
        },
      });
      writer.merge(result.toUIMessageStream());
    },
    onError: () => "The request failed before a response could be streamed.",
  });

  return createUIMessageStreamResponse({ stream });
}
