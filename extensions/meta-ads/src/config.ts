import type { FoxFangConfig } from "foxfang/plugin-sdk/config-runtime";

export type MetaAdsPluginConfig = {
  accessToken?: string;
  defaultAdAccountId?: string;
  apiVersion?: string;
};

export function resolveMetaAdsPluginConfig(cfg: FoxFangConfig): MetaAdsPluginConfig | undefined {
  const entry = cfg.plugins?.entries?.["meta-ads"];
  if (!entry || typeof entry !== "object") {
    return undefined;
  }
  const config = (entry as { config?: MetaAdsPluginConfig }).config;
  return config && typeof config === "object" ? config : undefined;
}

export function resolveMetaAdsAccessToken(cfg: FoxFangConfig): string | undefined {
  const plugin = resolveMetaAdsPluginConfig(cfg);
  const fromConfig = plugin?.accessToken;
  if (typeof fromConfig === "string" && fromConfig.trim()) {
    return fromConfig.trim();
  }
  const env = process.env.META_ADS_ACCESS_TOKEN?.trim();
  return env || undefined;
}

export function resolveMetaAdsDefaultAccountId(cfg: FoxFangConfig): string | undefined {
  const plugin = resolveMetaAdsPluginConfig(cfg);
  return (
    plugin?.defaultAdAccountId?.trim() || cfg.marketing?.defaultMetaAdAccountId?.trim() || undefined
  );
}

export function resolveMetaAdsApiVersion(cfg: FoxFangConfig): string {
  return resolveMetaAdsPluginConfig(cfg)?.apiVersion?.trim() || "v21.0";
}
