/** Lifecycle for outbound marketing content (AGENT_MARKETING_VI §5.8). */
export type PostDraftStatus =
  | "idea"
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "published"
  | "measured";

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";

export type MarketingRecordBase = {
  id: string;
  createdAt: string;
  updatedAt: string;
  agentId?: string;
  campaignId?: string;
};

export type Brand = MarketingRecordBase & {
  name: string;
  voice?: string;
  positioning?: string;
  audience?: string;
  guardrails?: string[];
  messagingPillars?: string[];
};

export type Product = MarketingRecordBase & {
  brandId?: string;
  name: string;
  description?: string;
  features?: string[];
  benefits?: string[];
  usps?: string[];
  faqs?: Array<{ question: string; answer: string }>;
  pricingNote?: string;
};

export type Campaign = MarketingRecordBase & {
  brandId?: string;
  productId?: string;
  title: string;
  brief?: string;
  audience?: string;
  channels?: string[];
  kpis?: string[];
  constraints?: string[];
  startAt?: string;
  endAt?: string;
};

export type ContentPlanSlot = {
  id: string;
  scheduledAt?: string;
  channel?: string;
  format?: string;
  topic?: string;
  goal?: string;
  postDraftId?: string;
};

export type ContentPlan = MarketingRecordBase & {
  campaignId: string;
  slots: ContentPlanSlot[];
};

export type PostDraft = MarketingRecordBase & {
  brandId?: string;
  campaignId?: string;
  channel: string;
  status: PostDraftStatus;
  title?: string;
  body: string;
  scheduledAt?: string;
  publishedAt?: string;
  approvalId?: string;
};

export type Approval = MarketingRecordBase & {
  actionKind: string;
  summary: string;
  status: ApprovalStatus;
  payload?: Record<string, unknown>;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type Insight = MarketingRecordBase & {
  brandId?: string;
  campaignId?: string;
  text: string;
  source?: string;
};

export type Lead = MarketingRecordBase & {
  brandId?: string;
  name?: string;
  channel?: string;
  status?: "new" | "qualified" | "nurturing" | "won" | "lost";
  notes?: string;
};

export type MarketingStore = {
  version: 1;
  brands: Brand[];
  products: Product[];
  campaigns: Campaign[];
  contentPlans: ContentPlan[];
  postDrafts: PostDraft[];
  approvals: Approval[];
  insights: Insight[];
  leads: Lead[];
};
