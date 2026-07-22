export const MARKETING_STORE_VERSION = 1 as const;

export const MARKETING_STORE_DIR = "marketing";

export const MARKETING_STORE_FILENAME = "store.json";

/** Write actions that require human approval (draft-first, approval-before-write). */
export const MARKETING_WRITE_ACTION_KINDS = [
  "publish_post",
  "bulk_message",
  "ads_write",
  "integration_write",
] as const;

export type MarketingWriteActionKind = (typeof MARKETING_WRITE_ACTION_KINDS)[number];

export const POST_DRAFT_PUBLISHABLE_STATUSES = ["approved", "scheduled"] as const;
