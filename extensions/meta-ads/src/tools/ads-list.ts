import { Type } from "@sinclair/typebox";
import type { FoxFangPluginApi } from "foxfang/plugin-sdk/plugin-runtime";
import { readStringParam } from "foxfang/plugin-sdk/provider-web-search";
import { graphGet } from "../graph-client.js";
import { jsonResult } from "../tool-result.js";

const Schema = Type.Object(
  {
    adsetId: Type.Optional(Type.String()),
    campaignId: Type.Optional(Type.String()),
    fields: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export function createMetaAdsAdsListTool(api: FoxFangPluginApi) {
  return {
    name: "meta_ads_ads_list",
    label: "Meta Ads: List ads",
    description: "List ads under an ad set or campaign.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const adsetId = readStringParam(raw, "adsetId");
      const campaignId = readStringParam(raw, "campaignId");
      if (!adsetId && !campaignId) {
        return jsonResult({ ok: false, error: "Provide adsetId or campaignId." });
      }
      const fields = readStringParam(raw, "fields") ?? "id,name,status,creative";
      const path = adsetId ? `${adsetId}/ads` : `${campaignId}/ads`;
      const result = await graphGet<{ data?: unknown[] }>({
        cfg: api.config,
        path,
        searchParams: { fields, limit: "100" },
      });
      return jsonResult(result.ok ? { ads: result.data.data ?? [] } : result);
    },
  };
}
