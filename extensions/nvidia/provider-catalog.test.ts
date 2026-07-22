import { describe, expect, it } from "vitest";
import {
  buildNvidiaProvider,
  isNvidiaReasoningModel,
  parseNvidiaModelsResponse,
} from "./provider-catalog.js";

describe("NVIDIA provider catalog", () => {
  it("parses NVIDIA /models response and flags reasoning models", () => {
    const models = parseNvidiaModelsResponse({
      object: "list",
      data: [
        {
          id: "nvidia/nemotron-3-ultra-550b-a55b",
          name: "Nemotron 3 Ultra",
          context_length: 262144,
          max_output_tokens: 32768,
        },
        {
          id: "meta/llama-3.3-70b-instruct",
          name: "Llama 3.3",
        },
        {
          id: "moonshotai/kimi-k2-thinking",
          metadata: { reasoning: true },
        },
      ],
    });

    expect(models).toEqual([
      expect.objectContaining({
        id: "nvidia/nemotron-3-ultra-550b-a55b",
        reasoning: true,
        contextWindow: 262144,
        maxTokens: 32768,
      }),
      expect.objectContaining({
        id: "meta/llama-3.3-70b-instruct",
        reasoning: false,
      }),
      expect.objectContaining({
        id: "moonshotai/kimi-k2-thinking",
        reasoning: true,
      }),
    ]);
  });

  it("marks reasoning catalog rows as reasoning-effort compatible", () => {
    const provider = buildNvidiaProvider([
      {
        id: "nvidia/nemotron-3-ultra-550b-a55b",
        name: "Nemotron 3 Ultra",
        reasoning: true,
        contextWindow: 131072,
        maxTokens: 4096,
      },
      {
        id: "meta/llama-3.3-70b-instruct",
        name: "Llama 3.3",
        reasoning: false,
        contextWindow: 131072,
        maxTokens: 4096,
      },
    ]);

    expect(provider.models[0]).toMatchObject({
      reasoning: true,
      compat: { supportsReasoningEffort: true },
    });
    expect(provider.models[1]?.compat).toBeUndefined();
  });

  it("recognizes NVIDIA-hosted reasoning model families", () => {
    expect(isNvidiaReasoningModel("nvidia/nemotron-3-ultra-550b-a55b")).toBe(true);
    expect(isNvidiaReasoningModel("moonshotai/kimi-k2-thinking")).toBe(true);
    expect(isNvidiaReasoningModel("qwen/qwen3-next-80b-a3b-thinking")).toBe(true);
    expect(isNvidiaReasoningModel("meta/llama-3.3-70b-instruct")).toBe(false);
  });
});
