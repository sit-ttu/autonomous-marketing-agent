import { Type } from "@sinclair/typebox";
import type { FoxFangPluginApi } from "foxfang/plugin-sdk/plugin-runtime";
import { graphGet } from "../graph-client.js";
import { jsonResult } from "../tool-result.js";

const Schema = Type.Object(
  {
    fields: Type.Optional(
      Type.String({
        description: "Comma-separated Graph API fields. Default: id,name,account_status,currency.",
      }),
    ),
  },
  { additionalProperties: false },
);

export function createMetaAdsAccountsListTool(api: FoxFangPluginApi) {
  return {
    name: "meta_ads_accounts_list",
    label: "Meta Ads: List ad accounts",
    description: "List Meta ad accounts accessible by the configured token (ads_read).",
    parameters: Schema,
    execute: async (_id: string, params: Record<string, unknown>) => {
      const fields =
        typeof params.fields === "string" && params.fields.trim()
          ? params.fields.trim()
          : "id,name,account_status,currency";
      const result = await graphGet<{ data?: unknown[] }>({
        cfg: api.config,
        path: "me/adaccounts",
        searchParams: { fields, limit: "50" },
      });
      return jsonResult(result.ok ? { accounts: result.data.data ?? [] } : result);
    },
  };
}
