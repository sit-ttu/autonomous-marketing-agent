import { Type } from "@sinclair/typebox";
import type { FoxFangPluginApi } from "foxfang/plugin-sdk/plugin-runtime";
import { readStringParam } from "foxfang/plugin-sdk/provider-web-search";
import { resolveMetaAdsDefaultAccountId } from "../config.js";
import { graphGet, normalizeAdAccountId } from "../graph-client.js";
import { jsonResult } from "../tool-result.js";

const Schema = Type.Object(
  {
    objectId: Type.Optional(
      Type.String({
        description: "Campaign, ad set, or ad id. Defaults to ad account insights when omitted.",
      }),
    ),
    adAccountId: Type.Optional(Type.String()),
    datePreset: Type.Optional(
      Type.String({
        description: "Graph date_preset e.g. last_7d, last_30d, this_month.",
      }),
    ),
    fields: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const DEFAULT_INSIGHT_FIELDS =
  "impressions,reach,clicks,ctr,cpc,spend,actions,cost_per_action_type";

export function createMetaAdsInsightsGetTool(api: FoxFangPluginApi) {
  return {
    name: "meta_ads_insights_get",
    label: "Meta Ads: Get insights",
    description: "Fetch performance insights for ad account, campaign, ad set, or ad (read-only).",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const objectId = readStringParam(raw, "objectId");
      const adAccountId =
        readStringParam(raw, "adAccountId") ?? resolveMetaAdsDefaultAccountId(api.config);
      const target = objectId ?? (adAccountId ? normalizeAdAccountId(adAccountId) : undefined);
      if (!target) {
        return jsonResult({
          ok: false,
          error: "Provide objectId or adAccountId.",
        });
      }
      const fields = readStringParam(raw, "fields") ?? DEFAULT_INSIGHT_FIELDS;
      const datePreset = readStringParam(raw, "datePreset") ?? "last_7d";
      const result = await graphGet<{ data?: unknown[] }>({
        cfg: api.config,
        path: `${target}/insights`,
        searchParams: { fields, date_preset: datePreset, limit: "50" },
      });
      return jsonResult(
        result.ok ? { objectId: target, insights: result.data.data ?? [] } : result,
      );
    },
  };
}
