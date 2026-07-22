import { canPublishPostDraft } from "./approval-gate.js";
import { findApproval, loadMarketingStore } from "./store.js";
import type { PostDraft } from "./types.js";

export type DueScheduledDraft = {
  draft: PostDraft;
  recommendedTool: "social_meta_page_publish" | "message";
  reason: string;
};

const META_PAGE_CHANNELS = new Set(["facebook", "fb", "meta", "fanpage", "page"]);

function resolveRecommendedPublishTool(channel: string): DueScheduledDraft["recommendedTool"] {
  const key = channel.trim().toLowerCase();
  if (META_PAGE_CHANNELS.has(key)) {
    return "social_meta_page_publish";
  }
  return "message";
}

export async function listDueScheduledPostDrafts(params: {
  nowMs?: number;
  stateDir?: string;
}): Promise<DueScheduledDraft[]> {
  const nowMs = params.nowMs ?? Date.now();
  const store = await loadMarketingStore(params.stateDir);
  const due: DueScheduledDraft[] = [];

  for (const draft of store.postDrafts) {
    if (draft.status !== "scheduled" || !draft.scheduledAt) {
      continue;
    }
    const at = Date.parse(draft.scheduledAt);
    if (Number.isNaN(at) || at > nowMs) {
      continue;
    }
    const approval = draft.approvalId ? findApproval(store, draft.approvalId) : undefined;
    const gate = canPublishPostDraft(draft, approval);
    if (!gate.allowed) {
      continue;
    }
    due.push({
      draft,
      recommendedTool: resolveRecommendedPublishTool(draft.channel),
      reason: gate.reason ?? "scheduled and approved",
    });
  }

  return due.sort(
    (a, b) => Date.parse(a.draft.scheduledAt ?? "") - Date.parse(b.draft.scheduledAt ?? ""),
  );
}
