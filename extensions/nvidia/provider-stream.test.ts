import { describe, expect, it } from "vitest";
import plugin from "./index.js";

function loadProvider() {
  const providers: unknown[] = [];
  plugin.register({
    registerProvider(provider: unknown) {
      providers.push(provider);
    },
  } as never);
  return providers[0] as {
    wrapStreamFn: (ctx: {
      streamFn: (
        model: unknown,
        context: unknown,
        options: { onPayload?: (payload: unknown) => void },
      ) => unknown;
      modelId: string;
      provider: string;
      thinkingLevel?: string;
      extraParams?: Record<string, unknown>;
    }) => typeof arguments;
  };
}

describe("NVIDIA provider stream wrapper", () => {
  it("injects reasoning_effort for NVIDIA NIM reasoning models", async () => {
    const provider = loadProvider();
    let capturedPayload: Record<string, unknown> | undefined;
    const wrapped = provider.wrapStreamFn({
      provider: "nvidia",
      modelId: "nvidia/nemotron-3-ultra-550b-a55b",
      thinkingLevel: "high",
      streamFn: (_model, _context, options) => {
        const payload = { model: "nvidia/nemotron-3-ultra-550b-a55b" };
        options.onPayload?.(payload);
        capturedPayload = payload;
        return { result: async () => ({ content: [] }) };
      },
    });

    await wrapped?.(
      {
        api: "openai-completions",
        id: "nvidia/nemotron-3-ultra-550b-a55b",
        provider: "nvidia",
        reasoning: true,
      },
      [],
      {},
    );

    expect(capturedPayload).toMatchObject({ reasoning_effort: "high" });
  });

  it("does not inject reasoning_effort for non-reasoning NVIDIA models", async () => {
    const provider = loadProvider();
    let capturedPayload: Record<string, unknown> | undefined;
    const wrapped = provider.wrapStreamFn({
      provider: "nvidia",
      modelId: "meta/llama-3.3-70b-instruct",
      thinkingLevel: "high",
      streamFn: (_model, _context, options) => {
        const payload = { model: "meta/llama-3.3-70b-instruct" };
        options.onPayload?.(payload);
        capturedPayload = payload;
        return { result: async () => ({ content: [] }) };
      },
    });

    await wrapped?.(
      {
        api: "openai-completions",
        id: "meta/llama-3.3-70b-instruct",
        provider: "nvidia",
        reasoning: false,
      },
      [],
      {},
    );

    expect(capturedPayload).not.toHaveProperty("reasoning_effort");
  });
});
