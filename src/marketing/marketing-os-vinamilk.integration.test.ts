import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { canPublishPostDraft } from "./approval-gate.js";
import { assertMarketingOutboundAllowed } from "./outbound-guard.js";
import {
  createCrossPlatformDrafts,
  requestPublishApproval,
  resolveApproval,
  schedulePostDraft,
} from "./post-draft-ops.js";
import { listDueScheduledPostDrafts } from "./scheduled-publish.js";
import {
  findApproval,
  findBrand,
  findPostDraft,
  loadMarketingStore,
  nowIso,
  resolveMarketingStorePath,
  saveMarketingStore,
  upsertBrand,
} from "./store.js";
import type { Brand, MarketingStore } from "./types.js";

type VinamilkFixture = {
  brandId: string;
  name: string;
  product: {
    name: string;
    description: string;
    uniqueSellingPoints: string[];
  };
  audience: {
    primarySegment: string;
    painPoints: string[];
  };
  brandVoice: string[];
  guardrails: string[];
};

const fixturePath = path.resolve(process.cwd(), "test-fixtures/marketing-os/brand-vinamilk.json");

async function loadVinamilkFixture(): Promise<VinamilkFixture> {
  const raw = await fs.readFile(fixturePath, "utf8");
  return JSON.parse(raw) as VinamilkFixture;
}

function buildBrand(fixture: VinamilkFixture): Brand {
  const now = nowIso();
  return {
    id: fixture.brandId,
    createdAt: now,
    updatedAt: now,
    name: fixture.name,
    voice: fixture.brandVoice.join(", "),
    positioning: `${fixture.name} truyền thông về dinh dưỡng hằng ngày với sản phẩm ${fixture.product.name}.`,
    audience: fixture.audience.primarySegment,
    guardrails: fixture.guardrails,
    messagingPillars: [
      "dinh dưỡng hằng ngày",
      "nguồn gốc và chất lượng sản phẩm",
      "thông tin tích cực nhưng không phóng đại công dụng sức khỏe",
    ],
  };
}

function emptyMarketingStore(): MarketingStore {
  return {
    version: 1,
    brands: [],
    products: [],
    campaigns: [],
    contentPlans: [],
    postDrafts: [],
    approvals: [],
    insights: [],
    leads: [],
  };
}

describe("Marketing OS Vinamilk real integration", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  async function createStateDir() {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-vinamilk-mkt-"));
    tempDirs.push(stateDir);
    return stateDir;
  }

  it("seeds Vinamilk brand, creates drafts, enforces approval, and lists due scheduled publish", async () => {
    const stateDir = await createStateDir();
    const fixture = await loadVinamilkFixture();
    const brand = buildBrand(fixture);

    await upsertBrand(brand, stateDir);
    let store = await loadMarketingStore(stateDir);
    expect(resolveMarketingStorePath(stateDir)).toContain("marketing/store.json");
    expect(findBrand(store, "brand-vinamilk")?.name).toBe("Vinamilk");
    expect(findBrand(store, "brand-vinamilk")?.guardrails).toContain(
      "không tự động đăng bài khi chưa được duyệt",
    );

    const drafts = await createCrossPlatformDrafts({
      stateDir,
      brandId: brand.id,
      campaignId: "campaign-vinamilk-green-farm-14d",
      title: "Vinamilk Green Farm - bản nháp kiểm thử",
      channels: ["facebook", "tiktok", "linkedin", "email"],
      body: "Giới thiệu Sữa tươi tiệt trùng Vinamilk Green Farm nguyên chất không đường cho gia đình trẻ. Nội dung cần tích cực, gần gũi và không phóng đại công dụng sức khỏe.",
    });

    expect(drafts).toHaveLength(4);
    expect(drafts.map((draft) => draft.status)).toEqual(["draft", "draft", "draft", "draft"]);
    expect(drafts.every((draft) => draft.brandId === "brand-vinamilk")).toBe(true);

    const facebookDraft = drafts.find((draft) => draft.channel === "facebook");
    expect(facebookDraft).toBeDefined();
    if (!facebookDraft) {
      throw new Error("Facebook draft missing");
    }

    const { draft: pendingDraft, approval } = await requestPublishApproval({
      stateDir,
      postDraftId: facebookDraft.id,
      summary: "Xin duyệt bản nháp Facebook cho chiến dịch Vinamilk Green Farm.",
    });

    expect(approval.status).toBe("pending");
    expect(pendingDraft.status).toBe("pending_approval");
    expect(canPublishPostDraft(pendingDraft, approval).allowed).toBe(false);

    const previousStateDir = process.env.FOXFANG_STATE_DIR;
    process.env.FOXFANG_STATE_DIR = stateDir;
    try {
      await expect(
        assertMarketingOutboundAllowed({
          action: "send",
          params: { marketingPostDraftId: pendingDraft.id },
          dryRun: false,
        }),
      ).rejects.toThrow(/Marketing outbound blocked/);
    } finally {
      if (previousStateDir === undefined) {
        delete process.env.FOXFANG_STATE_DIR;
      } else {
        process.env.FOXFANG_STATE_DIR = previousStateDir;
      }
    }

    const resolved = await resolveApproval({
      stateDir,
      approvalId: approval.id,
      status: "approved",
      resolvedBy: "integration-test-operator",
    });
    expect(resolved.approval.status).toBe("approved");
    expect(resolved.drafts[0]?.status).toBe("approved");

    const scheduledAt = new Date(Date.now() - 60_000).toISOString();
    const scheduled = await schedulePostDraft({
      stateDir,
      postDraftId: pendingDraft.id,
      scheduledAt,
    });
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.scheduledAt).toBe(scheduledAt);

    const due = await listDueScheduledPostDrafts({ stateDir, nowMs: Date.now() });
    expect(due).toHaveLength(1);
    expect(due[0]?.draft.id).toBe(pendingDraft.id);
    expect(due[0]?.recommendedTool).toBe("social_meta_page_publish");

    store = await loadMarketingStore(stateDir);
    const storedDraft = findPostDraft(store, pendingDraft.id);
    const storedApproval = findApproval(store, approval.id);
    expect(storedDraft?.status).toBe("scheduled");
    expect(storedApproval?.status).toBe("approved");
  });

  it("does not list unapproved or future scheduled Vinamilk drafts as due", async () => {
    const stateDir = await createStateDir();
    const fixture = await loadVinamilkFixture();
    await upsertBrand(buildBrand(fixture), stateDir);

    const [unapprovedDraft] = await createCrossPlatformDrafts({
      stateDir,
      brandId: fixture.brandId,
      campaignId: "campaign-vinamilk-green-farm-14d",
      title: "Draft chưa duyệt",
      channels: ["facebook"],
      body: "Bản nháp chưa duyệt cho Vinamilk Green Farm.",
    });
    expect(unapprovedDraft).toBeDefined();
    if (!unapprovedDraft) {
      throw new Error("Unapproved draft missing");
    }

    await requestPublishApproval({
      stateDir,
      postDraftId: unapprovedDraft.id,
      summary: "Approval vẫn pending.",
    });

    const dueBeforeApproval = await listDueScheduledPostDrafts({ stateDir, nowMs: Date.now() });
    expect(dueBeforeApproval).toHaveLength(0);

    const [futureDraft] = await createCrossPlatformDrafts({
      stateDir,
      brandId: fixture.brandId,
      campaignId: "campaign-vinamilk-green-farm-14d",
      title: "Draft đã duyệt nhưng chưa đến lịch",
      channels: ["facebook"],
      body: "Bản nháp đã duyệt nhưng lịch đăng nằm trong tương lai.",
    });
    expect(futureDraft).toBeDefined();
    if (!futureDraft) {
      throw new Error("Future draft missing");
    }

    const { approval } = await requestPublishApproval({
      stateDir,
      postDraftId: futureDraft.id,
      summary: "Duyệt draft tương lai.",
    });
    await resolveApproval({ stateDir, approvalId: approval.id, status: "approved" });
    await schedulePostDraft({
      stateDir,
      postDraftId: futureDraft.id,
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    const dueAfterFutureSchedule = await listDueScheduledPostDrafts({
      stateDir,
      nowMs: Date.now(),
    });
    expect(dueAfterFutureSchedule).toHaveLength(0);
  });

  it("keeps result fixture compatible with the official results store shape", async () => {
    const stateDir = await createStateDir();
    await saveMarketingStore(emptyMarketingStore(), stateDir);

    const store = await loadMarketingStore(stateDir);
    expect(store.version).toBe(1);
    expect(store.brands).toEqual([]);
    expect(store.postDrafts).toEqual([]);
    expect(store.approvals).toEqual([]);
  });
});
