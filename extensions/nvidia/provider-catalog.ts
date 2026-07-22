import type { ModelProviderConfig } from "foxfang/plugin-sdk/provider-model-shared";

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const NVIDIA_DEFAULT_MODEL_ID = "nvidia/llama-3.1-nemotron-70b-instruct";
const NVIDIA_DEFAULT_CONTEXT_WINDOW = 131072;
const NVIDIA_DEFAULT_MAX_TOKENS = 4096;
const NVIDIA_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const NVIDIA_REASONING_MODEL_PATTERNS = [
  /(?:^|\/)deepseek[-_\w.]*v\d/i,
  /(?:^|\/)kimi[-_\w.]*thinking/i,
  /(?:^|\/)qwen3[-_\w.]*think/i,
  /(?:^|\/)nemotron-3/i,
  /(?:^|\/)nemotron[-_\w.]*reason/i,
] as const;

type NvidiaModelDefinition = {
  id: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
};

const STATIC_NVIDIA_MODELS: NvidiaModelDefinition[] = [
  {
    id: NVIDIA_DEFAULT_MODEL_ID,
    name: "NVIDIA Llama 3.1 Nemotron 70B Instruct",
    reasoning: false,
    contextWindow: NVIDIA_DEFAULT_CONTEXT_WINDOW,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Meta Llama 3.3 70B Instruct",
    reasoning: false,
    contextWindow: 131072,
    maxTokens: 4096,
  },
  {
    id: "nvidia/mistral-nemo-minitron-8b-8k-instruct",
    name: "NVIDIA Mistral NeMo Minitron 8B Instruct",
    reasoning: false,
    contextWindow: 8192,
    maxTokens: 2048,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    name: "NVIDIA Nemotron 3 Ultra 550B A55B",
    reasoning: true,
    contextWindow: NVIDIA_DEFAULT_CONTEXT_WINDOW,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    name: "NVIDIA Nemotron 3 Nano 30B A3B",
    reasoning: true,
    contextWindow: NVIDIA_DEFAULT_CONTEXT_WINDOW,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    reasoning: true,
    contextWindow: NVIDIA_DEFAULT_CONTEXT_WINDOW,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  {
    id: "qwen/qwen3-next-80b-a3b-thinking",
    name: "Qwen3 Next 80B A3B Thinking",
    reasoning: true,
    contextWindow: NVIDIA_DEFAULT_CONTEXT_WINDOW,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
  {
    id: "deepseek-ai/deepseek-v3.2",
    name: "DeepSeek V3.2",
    reasoning: true,
    contextWindow: NVIDIA_DEFAULT_CONTEXT_WINDOW,
    maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
  },
];

type NvidiaApiModel = {
  id?: unknown;
  name?: unknown;
  owned_by?: unknown;
  max_model_len?: unknown;
  context_length?: unknown;
  contextWindow?: unknown;
  max_context_length?: unknown;
  max_tokens?: unknown;
  max_output_tokens?: unknown;
  metadata?: unknown;
  capabilities?: unknown;
  tags?: unknown;
};

function readPositiveInteger(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "0"].includes(normalized)) {
      return false;
    }
  }
  return undefined;
}

function modelTextForHeuristics(model: NvidiaApiModel): string {
  const metadata = asRecord(model.metadata);
  const capabilities = asRecord(model.capabilities);
  const tags = Array.isArray(model.tags) ? model.tags.join(" ") : "";
  return [model.id, model.name, model.owned_by, tags, metadata?.tags, capabilities?.reasoning]
    .filter((value) => value !== undefined && value !== null)
    .map(String)
    .join(" ");
}

export function isNvidiaReasoningModel(modelId: string): boolean {
  return NVIDIA_REASONING_MODEL_PATTERNS.some((pattern) => pattern.test(modelId));
}

function resolveModelReasoning(model: NvidiaApiModel): boolean {
  const metadata = asRecord(model.metadata);
  const capabilities = asRecord(model.capabilities);
  return (
    readBoolean(capabilities?.reasoning) ??
    readBoolean(capabilities?.thinking) ??
    readBoolean(metadata?.reasoning) ??
    readBoolean(metadata?.thinking) ??
    isNvidiaReasoningModel(modelTextForHeuristics(model))
  );
}

function toModelDefinition(model: NvidiaApiModel) {
  const id = typeof model.id === "string" ? model.id.trim() : "";
  if (!id) {
    return null;
  }
  const name = typeof model.name === "string" && model.name.trim() ? model.name.trim() : id;
  return {
    id,
    name,
    reasoning: resolveModelReasoning(model),
    input: ["text" as const],
    cost: NVIDIA_DEFAULT_COST,
    contextWindow:
      readPositiveInteger(
        model.contextWindow,
        model.context_length,
        model.max_context_length,
        model.max_model_len,
      ) ?? NVIDIA_DEFAULT_CONTEXT_WINDOW,
    maxTokens:
      readPositiveInteger(model.max_output_tokens, model.max_tokens) ?? NVIDIA_DEFAULT_MAX_TOKENS,
  };
}

export function parseNvidiaModelsResponse(payload: unknown): NvidiaModelDefinition[] {
  const rawData = asRecord(payload)?.data;
  if (!Array.isArray(rawData)) {
    return [];
  }
  const seen = new Set<string>();
  const models = [];
  for (const rawModel of rawData) {
    const model = toModelDefinition(rawModel as NvidiaApiModel);
    if (!model || seen.has(model.id)) {
      continue;
    }
    seen.add(model.id);
    models.push(model);
  }
  return models;
}

export async function fetchNvidiaNimModels(params: {
  apiKey: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<ReturnType<typeof parseNvidiaModelsResponse>> {
  const fetchFn = params.fetchFn ?? fetch;
  const baseUrl = (params.baseUrl ?? NVIDIA_BASE_URL).replace(/\/+$/, "");
  const response = await fetchFn(`${baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`NVIDIA /models failed: HTTP ${response.status} ${response.statusText}`);
  }
  return parseNvidiaModelsResponse(await response.json());
}

export function buildNvidiaProvider(
  models: NvidiaModelDefinition[] = STATIC_NVIDIA_MODELS,
): ModelProviderConfig {
  return {
    baseUrl: NVIDIA_BASE_URL,
    api: "openai-completions",
    models: models.map((model) => ({
      id: model.id,
      name: model.name,
      reasoning: model.reasoning,
      input: ["text"],
      cost: NVIDIA_DEFAULT_COST,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      compat: model.reasoning ? { supportsReasoningEffort: true } : undefined,
    })),
  };
}
