import { defineSingleProviderPluginEntry } from "foxfang/plugin-sdk/provider-entry";
import { applyFptCloudConfig, FPT_CLOUD_DEFAULT_MODEL_REF } from "./onboard.js";
import { buildFptCloudProvider } from "./provider-catalog.js";

const PROVIDER_ID = "fpt-cloud";

export default defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "FPT Cloud Provider",
  description: "Bundled FPT Cloud provider plugin",
  provider: {
    label: "FPT Cloud",
    docsPath: "/providers/fpt-cloud",
    auth: [
      {
        methodId: "api-key",
        label: "FPT Cloud API key",
        hint: "API key",
        optionKey: "fptCloudApiKey",
        flagName: "--fpt-cloud-api-key",
        envVar: "FPT_CLOUD_API_KEY",
        promptMessage: "Enter FPT Cloud API key",
        defaultModel: FPT_CLOUD_DEFAULT_MODEL_REF,
        applyConfig: (cfg) => applyFptCloudConfig(cfg),
        noteTitle: "FPT Cloud",
        noteMessage: [
          "FPT Cloud provides OpenAI-compatible chat completions.",
          "Get your API key from the FPT Cloud marketplace console.",
        ].join("\n"),
        wizard: {
          choiceId: "fpt-cloud-api-key",
          choiceLabel: "FPT Cloud API key",
          groupId: "fpt-cloud",
          groupLabel: "FPT Cloud",
          groupHint: "API key",
        },
      },
    ],
    catalog: {
      buildProvider: buildFptCloudProvider,
    },
  },
});
