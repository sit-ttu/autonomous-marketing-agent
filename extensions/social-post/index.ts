import { definePluginEntry, type AnyAgentTool } from "foxfang/plugin-sdk/plugin-entry";
import { createSocialMetaPagePublishTool } from "./src/tools/meta-page-publish.js";

export default definePluginEntry({
  id: "social-post",
  name: "Social Post",
  description:
    "Publish approved marketing PostDrafts to Facebook Pages (Graph API). " +
    "Always requires an approved PostDraft; never bypasses the marketing approval gate.",
  register(api) {
    api.registerTool(createSocialMetaPagePublishTool(api) as AnyAgentTool);
  },
});
