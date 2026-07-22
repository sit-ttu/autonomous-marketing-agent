import type { FoxFangConfig } from "../config/config.js";
import { canPublishPostDraft } from "./approval-gate.js";
import { findApproval, findPostDraft, loadMarketingStore } from "./store.js";

const GUARDED_MESSAGE_ACTIONS = new Set([
  "send",
  "reply",
  "broadcast",
  "sendWithEffect",
  "sendAttachment",
]);

export type MarketingOutboundGuardParams = {
  cfg?: FoxFangConfig;
  action: string;
  params: Record<string, unknown>;
  dryRun?: boolean;
};

/**
 * When `marketingPostDraftId` is set on a message action, enforce approved PostDraft + Approval
 * before any non-dry-run outbound send (draft-first, approval-before-write).
 */
export async function assertMarketingOutboundAllowed(
  input: MarketingOutboundGuardParams,
): Promise<void> {
  if (input.dryRun) {
    return;
  }
  const draftId = readMarketingPostDraftId(input.params);
  if (!draftId) {
    if (input.cfg?.marketing?.requireApprovedDraftForMessageSend === true) {
      throw new Error(
        "Marketing outbound blocked: marketing.requireApprovedDraftForMessageSend is enabled. " +
          "Pass marketingPostDraftId for an approved PostDraft on message send.",
      );
    }
    return;
  }
  if (!GUARDED_MESSAGE_ACTIONS.has(input.action)) {
    return;
  }
  const store = await loadMarketingStore();
  const draft = findPostDraft(store, draftId);
  if (!draft) {
    throw new Error(
      `Marketing outbound blocked: PostDraft "${draftId}" not found. Create and approve a draft first.`,
    );
  }
  const approval = draft.approvalId ? findApproval(store, draft.approvalId) : undefined;
  const gate = canPublishPostDraft(draft, approval);
  if (!gate.allowed) {
    throw new Error(
      `Marketing outbound blocked for PostDraft "${draftId}": ${gate.reason ?? "not approved"}`,
    );
  }
}

export function readMarketingPostDraftId(params: Record<string, unknown>): string | undefined {
  const raw = params.marketingPostDraftId;
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
