/**
 * Marketing domain config (pointers and defaults).
 * Full objects live in the marketing JSON store — see src/marketing/store.ts.
 */

export type MarketingConfig = {
  /** Default brand id for briefs without explicit brand. */
  defaultBrandId?: string;
  /** Default Meta ad account id (act_...) for meta-ads plugin. */
  defaultMetaAdAccountId?: string;
  /** Require brand context before content-generation tools (enforced via skills/hooks). */
  requireBrandContext?: boolean;
  /** Workspace-relative path to brand kit markdown (overrides per-brand files). */
  brandKitPath?: string;
  /**
   * When true, all non-dry-run `message` sends require `marketingPostDraftId` linked to an approved draft.
   */
  requireApprovedDraftForMessageSend?: boolean;
};
