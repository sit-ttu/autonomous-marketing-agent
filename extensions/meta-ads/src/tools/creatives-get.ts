import { Type } from "@sinclair/typebox";
import type { FoxFangPluginApi } from "foxfang/plugin-sdk/plugin-runtime";
import { readStringParam } from "foxfang/plugin-sdk/provider-web-search";
import { graphGet } from "../graph-client.js";
import { jsonResult } from "../tool-result.js";

const Schema = Type.Object(
  {
    adId: Type.String({ description: "Meta ad id." }),
    fields: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export function createMetaAdsCreativesGetTool(api: FoxFangPluginApi) {
  return {
    name: "meta_ads_creatives_get",
    label: "Meta Ads: Get creative",
    description: "Load creative payload for an ad (copy and asset references).",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const adId = readStringParam(raw, "adId", { required: true });
      const fields =
        readStringParam(raw, "fields") ??
        "id,name,status,creative{id,name,body,title,image_url,thumbnail_url,object_story_spec}";
      const adResult = await graphGet<{ creative?: { id?: string } }>({
        cfg: api.config,
        path: adId,
        searchParams: { fields },
      });
      if (!adResult.ok) {
        return jsonResult(adResult);
      }
      return jsonResult({ adId, ad: adResult.data });
    },
  };
}
