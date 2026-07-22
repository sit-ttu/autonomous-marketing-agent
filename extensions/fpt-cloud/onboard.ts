import {
  applyAgentDefaultModelPrimary,
  applyProviderConfigWithModelCatalog,
  type FoxFangConfig,
} from "foxfang/plugin-sdk/provider-onboard";
import {
  buildFptCloudModelDefinition,
  FPT_CLOUD_BASE_URL,
  FPT_CLOUD_MODEL_CATALOG,
} from "./api.js";

export const FPT_CLOUD_DEFAULT_MODEL_REF = "fpt-cloud/DeepSeek-V4-Flash";

/**
 * Applies FPT Cloud provider settings to the agent config.
 */
export function applyFptCloudProviderConfig(cfg: FoxFangConfig): FoxFangConfig {
  const models = { ...cfg.agents?.defaults?.models };
  models[FPT_CLOUD_DEFAULT_MODEL_REF] = {
    ...models[FPT_CLOUD_DEFAULT_MODEL_REF],
    alias: models[FPT_CLOUD_DEFAULT_MODEL_REF]?.alias ?? "FPT Cloud",
  };

  return applyProviderConfigWithModelCatalog(cfg, {
    agentModels: models,
    providerId: "fpt-cloud",
    api: "openai-completions",
    baseUrl: FPT_CLOUD_BASE_URL,
    catalogModels: FPT_CLOUD_MODEL_CATALOG.map(buildFptCloudModelDefinition),
  });
}

/**
 * Applies FPT Cloud provider settings and sets the default primary model.
 */
export function applyFptCloudConfig(cfg: FoxFangConfig): FoxFangConfig {
  return applyAgentDefaultModelPrimary(
    applyFptCloudProviderConfig(cfg),
    FPT_CLOUD_DEFAULT_MODEL_REF,
  );
}
