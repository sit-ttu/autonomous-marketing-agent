import { adaptMasterCopyToChannels } from "./cross-post.js";
import {
  createMarketingId,
  findApproval,
  findPostDraft,
  loadMarketingStore,
  nowIso,
  saveMarketingStore,
} from "./store.js";
import type { Approval, ApprovalStatus, PostDraft, PostDraftStatus } from "./types.js";

export async function createPostDraft(params: {
  channel: string;
  body: string;
  brandId?: string;
  campaignId?: string;
  title?: string;
  status?: PostDraftStatus;
  stateDir?: string;
}): Promise<PostDraft> {
  const now = nowIso();
  const draft: PostDraft = {
    id: createMarketingId("post"),
    createdAt: now,
    updatedAt: now,
    brandId: params.brandId,
    campaignId: params.campaignId,
    channel: params.channel,
    status: params.status ?? "draft",
    title: params.title,
    body: params.body,
  };
  const store = await loadMarketingStore(params.stateDir);
  store.postDrafts.push(draft);
  await saveMarketingStore(store, params.stateDir);
  return draft;
}

export async function createCrossPlatformDrafts(params: {
  channels: string[];
  body: string;
  brandId?: string;
  campaignId?: string;
  title?: string;
  stateDir?: string;
}): Promise<PostDraft[]> {
  const variants = adaptMasterCopyToChannels({
    body: params.body,
    channels: params.channels,
    title: params.title,
  });
  const drafts: PostDraft[] = [];
  for (const variant of variants) {
    drafts.push(
      await createPostDraft({
        channel: variant.channel,
        body: variant.body,
        brandId: params.brandId,
        campaignId: params.campaignId,
        title: params.title,
        stateDir: params.stateDir,
      }),
    );
  }
  return drafts;
}

export async function requestPublishApproval(params: {
  postDraftId: string;
  summary?: string;
  stateDir?: string;
}): Promise<{ draft: PostDraft; approval: Approval }> {
  const store = await loadMarketingStore(params.stateDir);
  const draft = findPostDraft(store, params.postDraftId);
  if (!draft) {
    throw new Error(`PostDraft not found: ${params.postDraftId}`);
  }
  const now = nowIso();
  const approval: Approval = {
    id: createMarketingId("approval"),
    createdAt: now,
    updatedAt: now,
    actionKind: "publish_post",
    summary: params.summary ?? `Publish to ${draft.channel}`,
    status: "pending",
    payload: { postDraftId: draft.id, channel: draft.channel },
  };
  store.approvals.push(approval);
  draft.status = "pending_approval";
  draft.approvalId = approval.id;
  draft.updatedAt = now;
  const idx = store.postDrafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) {
    store.postDrafts[idx] = draft;
  }
  await saveMarketingStore(store, params.stateDir);
  return { draft, approval };
}

export async function resolveApproval(params: {
  approvalId: string;
  status: Extract<ApprovalStatus, "approved" | "denied">;
  resolvedBy?: string;
  stateDir?: string;
}): Promise<{ approval: Approval; drafts: PostDraft[] }> {
  const store = await loadMarketingStore(params.stateDir);
  const approval = findApproval(store, params.approvalId);
  if (!approval) {
    throw new Error(`Approval not found: ${params.approvalId}`);
  }
  const now = nowIso();
  approval.status = params.status;
  approval.resolvedAt = now;
  approval.resolvedBy = params.resolvedBy;
  approval.updatedAt = now;

  const drafts = store.postDrafts.filter((d) => d.approvalId === approval.id);
  for (const draft of drafts) {
    draft.updatedAt = now;
    if (params.status === "approved") {
      draft.status = draft.scheduledAt ? "scheduled" : "approved";
    } else {
      draft.status = "draft";
      draft.approvalId = undefined;
    }
  }

  await saveMarketingStore(store, params.stateDir);
  return { approval, drafts };
}

export async function schedulePostDraft(params: {
  postDraftId: string;
  scheduledAt: string;
  stateDir?: string;
}): Promise<PostDraft> {
  const store = await loadMarketingStore(params.stateDir);
  const draft = findPostDraft(store, params.postDraftId);
  if (!draft) {
    throw new Error(`PostDraft not found: ${params.postDraftId}`);
  }
  if (draft.status !== "approved" && draft.status !== "scheduled") {
    throw new Error(`PostDraft must be approved before scheduling (current: ${draft.status}).`);
  }
  draft.scheduledAt = params.scheduledAt;
  draft.status = "scheduled";
  draft.updatedAt = nowIso();
  const idx = store.postDrafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) {
    store.postDrafts[idx] = draft;
  }
  await saveMarketingStore(store, params.stateDir);
  return draft;
}

export async function markPostDraftPublished(params: {
  postDraftId: string;
  stateDir?: string;
}): Promise<PostDraft> {
  const store = await loadMarketingStore(params.stateDir);
  const draft = findPostDraft(store, params.postDraftId);
  if (!draft) {
    throw new Error(`PostDraft not found: ${params.postDraftId}`);
  }
  draft.status = "published";
  draft.publishedAt = nowIso();
  draft.updatedAt = draft.publishedAt;
  const idx = store.postDrafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) {
    store.postDrafts[idx] = draft;
  }
  await saveMarketingStore(store, params.stateDir);
  return draft;
}
