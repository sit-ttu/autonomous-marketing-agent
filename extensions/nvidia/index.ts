import type { StreamFn } from "@mariozechner/pi-agent-core";
import { definePluginEntry } from "foxfang/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "foxfang/plugin-sdk/provider-auth-api-key";
import type { ProviderCatalogContext } from "foxfang/plugin-sdk/provider-catalog";
import { streamWithPayloadPatch } from "foxfang/plugin-sdk/provider-stream";
import {
  buildNvidiaProvider,
  fetchNvidiaNimModels,
  isNvidiaReasoningModel,
} from "./provider-catalog.js";

const PROVIDER_ID = "nvidia";

type NvidiaReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

function resolveNvidiaReasoningEffort(value: unknown): NvidiaReasoningEffort | undefined {
  if (typeof value !== "string") {
    return "high";
  }
  switch (value.trim().toLowerCase()) {
    case "off":
    case "none":
      return undefined;
    case "minimal":
      return "minimal";
    case "low":
      return "low";
    case "medium":
    case "adaptive":
      return "medium";
    case "xhigh":
    case "max":
      return "xhigh";
    case "high":
    default:
      return "high";
  }
}

function shouldPatchReasoning(model: { api?: unknown; reasoning?: unknown }, modelId: string) {
  return (
    model.api === "openai-completions" &&
    (model.reasoning === true || isNvidiaReasoningModel(modelId))
  );
}

function createNvidiaReasoningWrapper(params: {
  streamFn: StreamFn | undefined;
  thinkingLevel?: unknown;
}): StreamFn | undefined {
  const underlying = params.streamFn;
  if (!underlying) {
    return undefined;
  }
  return (model, context, options) => {
    if (!shouldPatchReasoning(model, String(model.id ?? ""))) {
      return underlying(model, context, options);
    }
    const effort = resolveNvidiaReasoningEffort(
      (options as { reasoningEffort?: unknown; reasoning_effort?: unknown } | undefined)
        ?.reasoningEffort ??
        (options as { reasoning_effort?: unknown } | undefined)?.reasoning_effort ??
        params.thinkingLevel,
    );
    return streamWithPayloadPatch(underlying, model, context, options, (payload) => {
      if (!effort) {
        delete payload.reasoning_effort;
        return;
      }
      payload.reasoning_effort = effort;
    });
  };
}

async function buildNvidiaCatalog(ctx: ProviderCatalogContext) {
  const apiKey = ctx.resolveProviderApiKey(PROVIDER_ID).apiKey;
  if (!apiKey) {
    return null;
  }
  let provider = buildNvidiaProvider();
  try {
    const models = await fetchNvidiaNimModels({ apiKey });
    if (models.length > 0) {
      provider = buildNvidiaProvider(models);
    }
  } catch {
    provider = buildNvidiaProvider();
  }
  return {
    provider: {
      ...provider,
      apiKey,
    },
  };
}

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "NVIDIA Provider",
  description: "Bundled NVIDIA provider plugin",
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "NVIDIA",
      docsPath: "/providers/nvidia",
      envVars: ["NVIDIA_API_KEY"],
      auth: [
        createProviderApiKeyAuthMethod({
          providerId: PROVIDER_ID,
          methodId: "api-key",
          label: "NVIDIA API key",
          hint: "API key from NVIDIA Build/NGC",
          optionKey: "nvidiaApiKey",
          flagName: "--nvidia-api-key",
          envVar: "NVIDIA_API_KEY",
          promptMessage: "Enter NVIDIA API key",
          defaultModel: `${PROVIDER_ID}/nvidia/nemotron-3-ultra-550b-a55b`,
          expectedProviders: [PROVIDER_ID],
          wizard: {
            choiceId: "nvidia-api-key",
            choiceLabel: "NVIDIA API key",
            groupId: PROVIDER_ID,
            groupLabel: "NVIDIA",
            groupHint: "NVIDIA NIM / Build API key",
          },
        }),
      ],
      catalog: {
        order: "simple",
        run: buildNvidiaCatalog,
      },
      wrapStreamFn: (ctx) =>
        createNvidiaReasoningWrapper({
          streamFn: ctx.streamFn,
          thinkingLevel: ctx.thinkingLevel,
        }),
      resolveDefaultThinkingLevel: ({ reasoning }) => (reasoning ? "high" : "off"),
      supportsXHighThinking: ({ modelId }) => isNvidiaReasoningModel(modelId),
      isModernModelRef: ({ modelId }) => isNvidiaReasoningModel(modelId),
    });
  },
});
