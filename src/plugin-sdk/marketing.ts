/**
 * Public marketing store + approval helpers for plugins (e.g. social-post, meta-ads Phase B).
 */
export {
  assertMarketingWriteAllowed,
  canPublishPostDraft,
  requiresMarketingApproval,
} from "../marketing/approval-gate.js";
export {
  adaptBodyForChannel,
  adaptMasterCopyToChannels,
  CHANNEL_FORMAT_SPECS,
  normalizeSocialChannelId,
  type ChannelFormatSpec,
  type SocialChannelId,
} from "../marketing/cross-post.js";
export {
  assertMarketingOutboundAllowed,
  readMarketingPostDraftId,
} from "../marketing/outbound-guard.js";
export { listDueScheduledPostDrafts } from "../marketing/scheduled-publish.js";
export {
  createCrossPlatformDrafts,
  createPostDraft,
  markPostDraftPublished,
  requestPublishApproval,
  resolveApproval,
  schedulePostDraft,
} from "../marketing/post-draft-ops.js";
export {
  createMarketingId,
  findApproval,
  findPostDraft,
  loadMarketingStore,
  nowIso,
  upsertBrand,
} from "../marketing/store.js";
export type {
  Approval,
  ApprovalStatus,
  Brand,
  Campaign,
  PostDraft,
  PostDraftStatus,
} from "../marketing/types.js";
