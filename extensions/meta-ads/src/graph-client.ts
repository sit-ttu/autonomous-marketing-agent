import type { FoxFangConfig } from "foxfang/plugin-sdk/config-runtime";
import { resolveMetaAdsAccessToken, resolveMetaAdsApiVersion } from "./config.js";

export type GraphResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

const GRAPH_BASE = "https://graph.facebook.com";

export function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("act_")) {
    return trimmed;
  }
  return `act_${trimmed.replace(/^act_/, "")}`;
}

export async function graphGet<T>(params: {
  cfg: FoxFangConfig;
  path: string;
  searchParams?: Record<string, string | undefined>;
}): Promise<GraphResult<T>> {
  const token = resolveMetaAdsAccessToken(params.cfg);
  if (!token) {
    return {
      ok: false,
      error:
        "Meta Ads not configured. Set plugins.entries.meta-ads.config.accessToken or META_ADS_ACCESS_TOKEN.",
    };
  }

  const version = resolveMetaAdsApiVersion(params.cfg);
  const url = new URL(`${GRAPH_BASE}/${version}/${params.path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params.searchParams ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  try {
    const res = await fetch(url.toString(), { method: "GET" });
    const body = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) {
      const message =
        (body as { error?: { message?: string } }).error?.message ??
        `Graph API request failed (${res.status})`;
      return { ok: false, error: message, status: res.status };
    }
    if ((body as { error?: { message?: string } }).error?.message) {
      return {
        ok: false,
        error: (body as { error?: { message?: string } }).error!.message!,
        status: res.status,
      };
    }
    return { ok: true, data: body };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
