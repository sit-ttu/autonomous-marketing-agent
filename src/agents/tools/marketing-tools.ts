import { Type } from "@sinclair/typebox";
import type { FoxFangConfig } from "../../config/config.js";
import { adaptMasterCopyToChannels } from "../../marketing/cross-post.js";
import {
  createCrossPlatformDrafts,
  createPostDraft,
  markPostDraftPublished,
  requestPublishApproval,
  resolveApproval,
  schedulePostDraft,
} from "../../marketing/post-draft-ops.js";
import { listDueScheduledPostDrafts } from "../../marketing/scheduled-publish.js";
import {
  createMarketingId,
  loadMarketingStore,
  nowIso,
  upsertBrand,
} from "../../marketing/store.js";
import type { Brand } from "../../marketing/types.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringArrayParam, readStringParam } from "./common.js";

function marketingJson(payload: Record<string, unknown>) {
  return jsonResult({ ok: true, ...payload });
}

const draftCreateSchema = Type.Object(
  {
    channel: Type.String({
      description: "Target channel id (facebook, instagram, linkedin, x, …).",
    }),
    body: Type.String({ description: "Post body / caption." }),
    title: Type.Optional(Type.String()),
    brandId: Type.Optional(Type.String()),
    campaignId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const crossPlatformSchema = Type.Object(
  {
    channels: Type.Array(Type.String()),
    body: Type.String(),
    title: Type.Optional(Type.String()),
    brandId: Type.Optional(Type.String()),
    campaignId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const draftIdSchema = Type.Object(
  {
    postDraftId: Type.String(),
    summary: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const approvalResolveSchema = Type.Object(
  {
    approvalId: Type.String(),
    status: Type.Union([Type.Literal("approved"), Type.Literal("denied")]),
    resolvedBy: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const scheduleSchema = Type.Object(
  {
    postDraftId: Type.String(),
    scheduledAt: Type.String({ description: "ISO-8601 schedule time." }),
  },
  { additionalProperties: false },
);

const brandUpsertSchema = Type.Object(
  {
    brandId: Type.Optional(Type.String()),
    name: Type.String(),
    voice: Type.Optional(Type.String()),
    positioning: Type.Optional(Type.String()),
    audience: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const listSchema = Type.Object(
  {
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

export function createMarketingTools(_options?: { config?: FoxFangConfig }): AnyAgentTool[] {
  return [
    {
      name: "marketing_post_draft_create",
      label: "Marketing: Create post draft",
      description:
        "Create a single PostDraft in the marketing store (draft-first; does not publish).",
      parameters: draftCreateSchema,
      execute: async (_id, raw) => {
        const draft = await createPostDraft({
          channel: readStringParam(raw, "channel", { required: true }),
          body: readStringParam(raw, "body", { required: true }),
          title: readStringParam(raw, "title"),
          brandId: readStringParam(raw, "brandId"),
          campaignId: readStringParam(raw, "campaignId"),
        });
        return marketingJson({ draft });
      },
    },
    {
      name: "marketing_post_adapt_channels",
      label: "Marketing: Adapt copy for channels",
      description:
        "Return per-channel adapted captions (length/hashtag limits). Does not persist unless you call marketing_post_cross_platform_create.",
      parameters: crossPlatformSchema,
      execute: async (_id, raw) => {
        const channels = readStringArrayParam(raw, "channels", { required: true });
        const body = readStringParam(raw, "body", { required: true });
        const variants = adaptMasterCopyToChannels({
          channels,
          body,
          title: readStringParam(raw, "title"),
        });
        return marketingJson({ variants });
      },
    },
    {
      name: "marketing_post_cross_platform_create",
      label: "Marketing: Create cross-platform drafts",
      description:
        "Create one PostDraft per channel with adapted copy. Does not publish; use marketing_post_request_publish then message tool with marketingPostDraftId after approval.",
      parameters: crossPlatformSchema,
      execute: async (_id, raw) => {
        const drafts = await createCrossPlatformDrafts({
          channels: readStringArrayParam(raw, "channels", { required: true }),
          body: readStringParam(raw, "body", { required: true }),
          title: readStringParam(raw, "title"),
          brandId: readStringParam(raw, "brandId"),
          campaignId: readStringParam(raw, "campaignId"),
        });
        return marketingJson({ drafts });
      },
    },
    {
      name: "marketing_post_request_publish",
      label: "Marketing: Request publish approval",
      description:
        "Create a pending Approval for a PostDraft. Human must approve before outbound message send with marketingPostDraftId.",
      parameters: draftIdSchema,
      execute: async (_id, raw) => {
        const result = await requestPublishApproval({
          postDraftId: readStringParam(raw, "postDraftId", { required: true }),
          summary: readStringParam(raw, "summary"),
        });
        return marketingJson(result);
      },
    },
    {
      name: "marketing_approval_resolve",
      label: "Marketing: Resolve approval",
      description: "Approve or deny a pending marketing Approval (operator action).",
      parameters: approvalResolveSchema,
      execute: async (_id, raw) => {
        const status = readStringParam(raw, "status", { required: true }) as "approved" | "denied";
        if (status !== "approved" && status !== "denied") {
          return jsonResult({ ok: false, error: "status must be approved or denied" });
        }
        const result = await resolveApproval({
          approvalId: readStringParam(raw, "approvalId", { required: true }),
          status,
          resolvedBy: readStringParam(raw, "resolvedBy"),
        });
        return marketingJson(result);
      },
    },
    {
      name: "marketing_post_schedule",
      label: "Marketing: Schedule approved draft",
      description: "Set scheduledAt on an approved PostDraft (cron publish wiring is separate).",
      parameters: scheduleSchema,
      execute: async (_id, raw) => {
        const draft = await schedulePostDraft({
          postDraftId: readStringParam(raw, "postDraftId", { required: true }),
          scheduledAt: readStringParam(raw, "scheduledAt", { required: true }),
        });
        return marketingJson({ draft });
      },
    },
    {
      name: "marketing_post_mark_published",
      label: "Marketing: Mark draft published",
      description:
        "Record that a draft was published (after successful message send). Updates PostDraft status to published.",
      parameters: Type.Object({ postDraftId: Type.String() }, { additionalProperties: false }),
      execute: async (_id, raw) => {
        const draft = await markPostDraftPublished({
          postDraftId: readStringParam(raw, "postDraftId", { required: true }),
        });
        return marketingJson({ draft });
      },
    },
    {
      name: "marketing_brand_upsert",
      label: "Marketing: Upsert brand",
      description: "Create or update a Brand record in the marketing store.",
      parameters: brandUpsertSchema,
      execute: async (_id, raw) => {
        const now = nowIso();
        const id = readStringParam(raw, "brandId")?.trim() || createMarketingId("brand");
        const brand: Brand = {
          id,
          createdAt: now,
          updatedAt: now,
          name: readStringParam(raw, "name", { required: true }),
          voice: readStringParam(raw, "voice"),
          positioning: readStringParam(raw, "positioning"),
          audience: readStringParam(raw, "audience"),
        };
        await upsertBrand(brand);
        return marketingJson({ brand });
      },
    },
    {
      name: "marketing_scheduled_publish_due",
      label: "Marketing: List due scheduled publishes",
      description:
        "List PostDrafts that are scheduled, approved, and past scheduledAt. " +
        "Use social_meta_page_publish or message(send, marketingPostDraftId) per item; then marketing_post_mark_published.",
      parameters: Type.Object({}, { additionalProperties: false }),
      execute: async () => {
        const due = await listDueScheduledPostDrafts({});
        return marketingJson({
          count: due.length,
          items: due.map((item) => ({
            postDraftId: item.draft.id,
            channel: item.draft.channel,
            scheduledAt: item.draft.scheduledAt,
            recommendedTool: item.recommendedTool,
            bodyPreview: item.draft.body.slice(0, 160),
          })),
        });
      },
    },
    {
      name: "marketing_store_list",
      label: "Marketing: List store summaries",
      description: "List recent post drafts and pending approvals from the marketing store.",
      parameters: listSchema,
      execute: async (_id, raw) => {
        const limit = Math.min(100, Math.max(1, Number(raw.limit) || 20));
        const store = await loadMarketingStore();
        return marketingJson({
          brands: store.brands.slice(-limit),
          postDrafts: store.postDrafts.slice(-limit),
          approvals: store.approvals.filter((a) => a.status === "pending").slice(-limit),
        });
      },
    },
  ];
}
