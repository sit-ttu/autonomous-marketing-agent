import {
  MARKETING_WRITE_ACTION_KINDS,
  type MarketingWriteActionKind,
  POST_DRAFT_PUBLISHABLE_STATUSES,
} from "./constants.js";
import type { Approval, PostDraft, PostDraftStatus } from "./types.js";

export function requiresMarketingApproval(
  actionKind: string,
): actionKind is MarketingWriteActionKind {
  return (MARKETING_WRITE_ACTION_KINDS as readonly string[]).includes(actionKind);
}

export function canPublishPostDraft(
  draft: PostDraft,
  approval?: Approval,
): {
  allowed: boolean;
  reason?: string;
} {
  if (
    !POST_DRAFT_PUBLISHABLE_STATUSES.includes(
      draft.status as (typeof POST_DRAFT_PUBLISHABLE_STATUSES)[number],
    )
  ) {
    return {
      allowed: false,
      reason: `PostDraft status must be approved or scheduled (current: ${draft.status}).`,
    };
  }
  if (!draft.approvalId) {
    return { allowed: false, reason: "PostDraft has no linked approval." };
  }
  if (!approval || approval.id !== draft.approvalId) {
    return { allowed: false, reason: "Approval record not found for this draft." };
  }
  if (approval.status !== "approved") {
    return {
      allowed: false,
      reason: `Approval status must be approved (current: ${approval.status}).`,
    };
  }
  return { allowed: true };
}

export function assertMarketingWriteAllowed(params: {
  actionKind: string;
  approval?: Approval;
}): void {
  if (!requiresMarketingApproval(params.actionKind)) {
    return;
  }
  if (!params.approval || params.approval.status !== "approved") {
    throw new Error(
      `Marketing write blocked: action "${params.actionKind}" requires an approved Approval record.`,
    );
  }
}

export function isTerminalPostDraftStatus(status: PostDraftStatus): boolean {
  return status === "published" || status === "measured";
}
