import { definePluginEntry, type AnyAgentTool } from "foxfang/plugin-sdk/plugin-entry";
import { createMetaAdsAccountsListTool } from "./src/tools/accounts-list.js";
import { createMetaAdsAdsListTool } from "./src/tools/ads-list.js";
import { createMetaAdsAdsetsListTool } from "./src/tools/adsets-list.js";
import { createMetaAdsCampaignsListTool } from "./src/tools/campaigns-list.js";
import { createMetaAdsCreativesGetTool } from "./src/tools/creatives-get.js";
import { createMetaAdsInsightsGetTool } from "./src/tools/insights-get.js";
import { createMetaAdsRecommendationsTool } from "./src/tools/recommendations-generate.js";

export default definePluginEntry({
  id: "meta-ads",
  name: "Meta Ads",
  description:
    "Read-only Meta Marketing API tools for campaign insights and creative analysis. " +
    "Write operations require separate approval workflow (not enabled in Phase A).",
  register(api) {
    api.registerTool(createMetaAdsAccountsListTool(api) as AnyAgentTool);
    api.registerTool(createMetaAdsCampaignsListTool(api) as AnyAgentTool);
    api.registerTool(createMetaAdsAdsetsListTool(api) as AnyAgentTool);
    api.registerTool(createMetaAdsAdsListTool(api) as AnyAgentTool);
    api.registerTool(createMetaAdsInsightsGetTool(api) as AnyAgentTool);
    api.registerTool(createMetaAdsCreativesGetTool(api) as AnyAgentTool);
    api.registerTool(createMetaAdsRecommendationsTool(api) as AnyAgentTool);
  },
});
