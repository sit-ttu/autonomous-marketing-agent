import type { FoxFangConfig } from "foxfang/plugin-sdk/config-runtime";

export type SocialPostPluginConfig = {
  pageAccessToken?: string;
  pageId?: string;
  apiVersion?: string;
};

export function resolveSocialPostPluginConfig(cfg: FoxFangConfig): SocialPostPluginConfig {
  const entry = cfg.plugins?.entries?.["social-post"]?.config;
  if (!entry || typeof entry !== "object") {
    return {};
  }
  return entry as SocialPostPluginConfig;
}

export function resolvePageAccessToken(cfg: FoxFangConfig): string | undefined {
  const plugin = resolveSocialPostPluginConfig(cfg);
  if (typeof plugin.pageAccessToken === "string" && plugin.pageAccessToken.trim()) {
    return plugin.pageAccessToken.trim();
  }
  const env = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  return env || undefined;
}

export function resolvePageId(cfg: FoxFangConfig): string | undefined {
  const plugin = resolveSocialPostPluginConfig(cfg);
  return plugin.pageId?.trim() || undefined;
}

export function resolveGraphApiVersion(cfg: FoxFangConfig): string {
  const plugin = resolveSocialPostPluginConfig(cfg);
  return plugin.apiVersion?.trim() || "v21.0";
}
