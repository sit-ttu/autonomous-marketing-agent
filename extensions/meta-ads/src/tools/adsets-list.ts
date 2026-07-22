import { Type } from "@sinclair/typebox";
import type { FoxFangPluginApi } from "foxfang/plugin-sdk/plugin-runtime";
import { readStringParam } from "foxfang/plugin-sdk/provider-web-search";
import { graphGet } from "../graph-client.js";
import { jsonResult } from "../tool-result.js";

const Schema = Type.Object(
  {
    campaignId: Type.String({ description: "Meta campaign id." }),
    fields: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export function createMetaAdsAdsetsListTool(api: FoxFangPluginApi) {
  return {
    name: "meta_ads_adsets_list",
    label: "Meta Ads: List ad sets",
    description: "List ad sets under a campaign.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const campaignId = readStringParam(raw, "campaignId", { required: true });
      const fields =
        readStringParam(raw, "fields") ??
        "id,name,status,daily_budget,lifetime_budget,targeting,start_time,end_time";
      const result = await graphGet<{ data?: unknown[] }>({
        cfg: api.config,
        path: `${campaignId}/adsets`,
        searchParams: { fields, limit: "100" },
      });
      return jsonResult(result.ok ? { campaignId, adsets: result.data.data ?? [] } : result);
    },
  };
}
