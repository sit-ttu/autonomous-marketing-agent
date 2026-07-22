import { Type } from "@sinclair/typebox";
import type { FoxFangPluginApi } from "foxfang/plugin-sdk/plugin-runtime";
import { readStringParam } from "foxfang/plugin-sdk/provider-web-search";
import { resolveMetaAdsDefaultAccountId } from "../config.js";
import { graphGet, normalizeAdAccountId } from "../graph-client.js";
import { jsonResult } from "../tool-result.js";

const Schema = Type.Object(
  {
    adAccountId: Type.Optional(Type.String({ description: "Ad account id (act_...)." })),
    fields: Type.Optional(Type.String({ description: "Graph fields for campaigns." })),
  },
  { additionalProperties: false },
);

export function createMetaAdsCampaignsListTool(api: FoxFangPluginApi) {
  return {
    name: "meta_ads_campaigns_list",
    label: "Meta Ads: List campaigns",
    description: "List campaigns for a Meta ad account.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const adAccountId =
        readStringParam(raw, "adAccountId") ?? resolveMetaAdsDefaultAccountId(api.config);
      if (!adAccountId) {
        return jsonResult({
          ok: false,
          error: "adAccountId required (tool param or marketing.defaultMetaAdAccountId).",
        });
      }
      const fields =
        readStringParam(raw, "fields") ??
        "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time";
      const account = normalizeAdAccountId(adAccountId);
      const result = await graphGet<{ data?: unknown[] }>({
        cfg: api.config,
        path: `${account}/campaigns`,
        searchParams: { fields, limit: "100" },
      });
      return jsonResult(
        result.ok ? { adAccountId: account, campaigns: result.data.data ?? [] } : result,
      );
    },
  };
}
