import type { ModelProviderConfig } from "foxfang/plugin-sdk/provider-model-shared";
import {
  buildFptCloudModelDefinition,
  FPT_CLOUD_BASE_URL,
  FPT_CLOUD_MODEL_CATALOG,
} from "./api.js";

/**
 * Builds the static FPT Cloud provider catalog.
 */
export function buildFptCloudProvider(): ModelProviderConfig {
  return {
    baseUrl: FPT_CLOUD_BASE_URL,
    api: "openai-completions",
    models: FPT_CLOUD_MODEL_CATALOG.map(buildFptCloudModelDefinition),
  };
}
