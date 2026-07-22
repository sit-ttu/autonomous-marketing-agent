import { Type } from "@sinclair/typebox";
import {
  canPublishPostDraft,
  findApproval,
  findPostDraft,
  loadMarketingStore,
  markPostDraftPublished,
} from "foxfang/plugin-sdk/marketing";
import type { FoxFangPluginApi } from "foxfang/plugin-sdk/plugin-runtime";
import { readStringParam } from "foxfang/plugin-sdk/provider-web-search";
import { publishPageFeedPost } from "../graph-publish.js";
import { jsonResult } from "../tool-result.js";

const Schema = Type.Object(
  {
    postDraftId: Type.String({
      description: "Approved PostDraft id from the marketing store (required).",
    }),
    link: Type.Optional(Type.String({ description: "Optional link URL for Page feed posts." })),
    dryRun: Type.Optional(
      Type.Boolean({ description: "When true, validate approval only; do not call Graph API." }),
    ),
  },
  { additionalProperties: false },
);

export function createSocialMetaPagePublishTool(api: FoxFangPluginApi) {
  return {
    name: "social_meta_page_publish",
    label: "Social: Publish Meta Page post",
    description:
      "Publish an approved PostDraft to a Facebook Page feed via Graph API. " +
      "Requires prior marketing_post_request_publish + marketing_approval_resolve.",
    parameters: Schema,
    execute: async (_id: string, raw: Record<string, unknown>) => {
      const postDraftId = readStringParam(raw, "postDraftId", { required: true });
      const dryRun = raw.dryRun === true;

      const store = await loadMarketingStore();
      const draft = findPostDraft(store, postDraftId);
      if (!draft) {
        return jsonResult({ ok: false, error: `PostDraft not found: ${postDraftId}` });
      }
      const approval = draft.approvalId ? findApproval(store, draft.approvalId) : undefined;
      const gate = canPublishPostDraft(draft, approval);
      if (!gate.allowed) {
        return jsonResult({ ok: false, error: gate.reason ?? "not approved", postDraftId });
      }

      if (dryRun) {
        return jsonResult({
          ok: true,
          dryRun: true,
          postDraftId,
          channel: draft.channel,
          messagePreview: draft.body.slice(0, 200),
        });
      }

      const result = await publishPageFeedPost({
        cfg: api.config,
        message: draft.body,
        link: readStringParam(raw, "link"),
      });
      if (!result.ok) {
        return jsonResult({ ok: false, postDraftId, ...result });
      }

      const published = await markPostDraftPublished({ postDraftId });
      return jsonResult({
        ok: true,
        postDraftId,
        graphPostId: result.postId,
        draft: published,
      });
    },
  };
}
