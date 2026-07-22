import { Type } from "@sinclair/typebox";
import type { FoxFangPluginApi } from "foxfang/plugin-sdk/plugin-runtime";
import { readStringParam } from "foxfang/plugin-sdk/provider-web-search";
import { jsonResult } from "../tool-result.js";

const Schema = Type.Object(
  {
    context: Type.String({
      description: "Short summary of goals, constraints, or insights to base recommendations on.",
    }),
    metricsSummary: Type.Optional(
      Type.String({ description: "Optional pasted metrics or prior tool output." }),
    ),
  },
  { additionalProperties: false },
);

/**
 * Phase A: returns structured prompts for the agent to author recommendations.
 * Does not call Meta write APIs.
 */
export function createMetaAdsRecommendationsTool(api: FoxFangPluginApi) {
  return {
    name: "meta_ads_recommendations_generate",
    label: "Meta Ads: Recommendation scaffold",
    description:
      "Produce a structured optimization checklist from context (no Meta API writes). " +
      "Use after meta_ads_insights_get.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const context = readStringParam(raw, "context", { required: true });
      const metricsSummary = readStringParam(raw, "metricsSummary");
      return jsonResult({
        ok: true,
        mode: "draft_recommendations_only",
        reminder: "All budget/targeting/creative changes require human approval before API writes.",
        checklist: [
          "Identify campaigns with high spend and low CTR vs account baseline.",
          "Flag ad sets with CPC spike > 20% week over week.",
          "Suggest creative variants to test (copy angle, CTA, format).",
          "Propose audience exclusions or narrowing if CPA above target.",
          "Schedule follow-up read-only insights check after changes are approved.",
        ],
        context,
        metricsSummary: metricsSummary ?? null,
      });
    },
  };
}
