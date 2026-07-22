import type { ModelDefinitionConfig } from "foxfang/plugin-sdk/provider-model-shared";

export const FPT_CLOUD_BASE_URL = "https://mkp-api.fptcloud.com/v1";

// FPT Cloud marketplace pricing (USD per 1M tokens); cache tiers unsupported.
export const FPT_CLOUD_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "DeepSeek-V4-Flash",
    name: "DeepSeek V4 Flash",
    reasoning: false,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
    cost: { input: 0.14, output: 0.28, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsUsageInStreaming: true,
    },
  },
  {
    id: "GLM-5.1",
    name: "GLM 5.1",
    reasoning: true,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 1.4, output: 4.4, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsUsageInStreaming: true,
    },
  },
  {
    id: "GLM-4.7",
    name: "GLM 4.7",
    reasoning: true,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.5, output: 2.2, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsUsageInStreaming: true,
    },
  },
  {
    id: "gpt-oss-120b",
    name: "GPT-OSS 120B",
    reasoning: true,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 8192,
    cost: { input: 0.14, output: 0.61, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsUsageInStreaming: true,
    },
  },
  {
    id: "Qwen3.6-27B",
    name: "Qwen3.6 27B",
    reasoning: true,
    input: ["text"],
    contextWindow: 262144,
    maxTokens: 8192,
    cost: { input: 0.3, output: 2.75, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsUsageInStreaming: true,
    },
  },
];

/**
 * @param model - Catalog model entry.
 */
export function buildFptCloudModelDefinition(
  model: (typeof FPT_CLOUD_MODEL_CATALOG)[number],
): ModelDefinitionConfig {
  return {
    ...model,
    api: "openai-completions",
  };
}
