import { describe, expect, it } from "vitest";
import { resolveProviderPluginChoice } from "../../src/plugins/provider-wizard.js";
import { registerSingleProviderPlugin } from "../../test/helpers/extensions/plugin-registration.js";
import fptCloudPlugin from "./index.js";

describe("fpt-cloud provider plugin", () => {
  it("registers FPT Cloud with api-key auth wizard metadata", () => {
    const provider = registerSingleProviderPlugin(fptCloudPlugin);
    const resolved = resolveProviderPluginChoice({
      providers: [provider],
      choice: "fpt-cloud-api-key",
    });

    expect(provider.id).toBe("fpt-cloud");
    expect(provider.label).toBe("FPT Cloud");
    expect(provider.envVars).toEqual(["FPT_CLOUD_API_KEY"]);
    expect(provider.auth).toHaveLength(1);
    expect(resolved).not.toBeNull();
    expect(resolved?.provider.id).toBe("fpt-cloud");
    expect(resolved?.method.id).toBe("api-key");
  });

  it("builds the static FPT Cloud model catalog", async () => {
    const provider = registerSingleProviderPlugin(fptCloudPlugin);
    expect(provider.catalog).toBeDefined();

    const catalog = await provider.catalog!.run({
      config: {},
      env: {},
      resolveProviderApiKey: () => ({ apiKey: "test-key" }),
      resolveProviderAuth: () => ({
        apiKey: "test-key",
        mode: "api_key",
        source: "env",
      }),
    } as never);

    expect(catalog && "provider" in catalog).toBe(true);
    if (!catalog || !("provider" in catalog)) {
      throw new Error("expected single-provider catalog");
    }

    expect(catalog.provider.api).toBe("openai-completions");
    expect(catalog.provider.baseUrl).toBe("https://mkp-api.fptcloud.com/v1");
    expect(catalog.provider.models?.map((model) => model.id)).toEqual(["DeepSeek-V4-Flash"]);
  });
});
