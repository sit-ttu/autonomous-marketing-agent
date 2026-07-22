import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertMarketingWriteAllowed,
  canPublishPostDraft,
  requiresMarketingApproval,
} from "./approval-gate.js";
import { adaptBodyForChannel, adaptMasterCopyToChannels } from "./cross-post.js";
import { assertMarketingOutboundAllowed } from "./outbound-guard.js";
import {
  createPostDraft,
  markPostDraftPublished,
  requestPublishApproval,
  resolveApproval,
  schedulePostDraft,
} from "./post-draft-ops.js";
import { listDueScheduledPostDrafts } from "./scheduled-publish.js";
import {
  loadMarketingStore,
  resolveMarketingStorePath,
  upsertBrand,
} from "./store.js";
import type { Approval, Brand, PostDraft } from "./types.js";

describe("marketing approval-gate", () => {
  it("requires approval for write action kinds", () => {
    expect(requiresMarketingApproval("publish_post")).toBe(true);
    expect(requiresMarketingApproval("ads_write")).toBe(true);
    expect(requiresMarketingApproval("analyze")).toBe(false);
  });

  it("blocks publish without approved approval", () => {
    const draft: PostDraft = {
      id: "d1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      channel: "telegram",
      status: "approved",
      body: "hello",
      approvalId: "a1",
    };
    const pending: Approval = {
      id: "a1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actionKind: "publish_post",
      summary: "publish",
      status: "pending",
    };
    expect(canPublishPostDraft(draft, pending).allowed).toBe(false);
  });

  it("allows publish when approval is approved", () => {
    const draft: PostDraft = {
      id: "d1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      channel: "telegram",
      status: "approved",
      body: "hello",
      approvalId: "a1",
    };
    const approval: Approval = {
      id: "a1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actionKind: "publish_post",
      summary: "publish",
      status: "approved",
    };
    expect(canPublishPostDraft(draft, approval).allowed).toBe(true);
    expect(() =>
      assertMarketingWriteAllowed({ actionKind: "publish_post", approval }),
    ).not.toThrow();
  });

  it("blocks publish when the draft is missing an approvalId link", () => {
    const draft: PostDraft = {
      id: "d1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      channel: "telegram",
      status: "approved",
      body: "hello",
    };
    const result = canPublishPostDraft(draft);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("linked approval");
  });

  it("blocks publish when the linked approval id does not match", () => {
    const draft: PostDraft = {
      id: "d1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      channel: "telegram",
      status: "approved",
      body: "hello",
      approvalId: "a1",
    };
    const approval: Approval = {
      id: "a2",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actionKind: "publish_post",
      summary: "publish",
      status: "approved",
    };
    expect(canPublishPostDraft(draft, approval).allowed).toBe(false);
  });

  it("blocks publish when draft status is not approved or scheduled", () => {
    const draft: PostDraft = {
      id: "d1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      channel: "telegram",
      status: "draft",
      body: "hello",
      approvalId: "a1",
    };
    const approval: Approval = {
      id: "a1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actionKind: "publish_post",
      summary: "publish",
      status: "approved",
    };
    expect(canPublishPostDraft(draft, approval).allowed).toBe(false);
  });

  it("throws when assertMarketingWriteAllowed is called with a denied approval", () => {
    const approval: Approval = {
      id: "a1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actionKind: "publish_post",
      summary: "publish",
      status: "denied",
    };
    expect(() => assertMarketingWriteAllowed({ actionKind: "publish_post", approval })).toThrow(
      /blocked/i,
    );
  });

  it("returns no-op for non-write action kinds in assertMarketingWriteAllowed", () => {
    expect(() => assertMarketingWriteAllowed({ actionKind: "analyze" })).not.toThrow();
  });

  it("blocks publish with a denied approval record", () => {
    const draft: PostDraft = {
      id: "d1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      channel: "telegram",
      status: "approved",
      body: "hello",
      approvalId: "a1",
    };
    const approval: Approval = {
      id: "a1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actionKind: "publish_post",
      summary: "publish",
      status: "denied",
    };
    expect(canPublishPostDraft(draft, approval).allowed).toBe(false);
  });
});

describe("marketing cross-post", () => {
  it("truncates long copy for X", () => {
    const long = "word ".repeat(200);
    const adapted = adaptBodyForChannel({ body: long, channel: "x" });
    expect(adapted.body.length).toBeLessThanOrEqual(280);
    expect(adapted.truncated).toBe(true);
  });

  it("adapts master copy to multiple channels", () => {
    const long = `${"Launch day. ".repeat(80)}#marketing #launch`;
    const variants = adaptMasterCopyToChannels({
      body: long,
      channels: ["linkedin", "x"],
    });
    expect(variants).toHaveLength(2);
    const xVariant = variants.find((v) => v.channel === "x");
    const linkedinVariant = variants.find((v) => v.channel === "linkedin");
    expect(xVariant?.body.length).toBeLessThanOrEqual(280);
    expect(linkedinVariant?.body.length ?? 0).toBeGreaterThan(xVariant?.body.length ?? 0);
  });

  it("keeps short copy unchanged and does not mark it truncated", () => {
    const short = "Short post";
    const adapted = adaptBodyForChannel({ body: short, channel: "x" });
    expect(adapted.body).toBe(short);
    expect(adapted.truncated).toBe(false);
  });

  it("prepends title to body when title is provided", () => {
    const adapted = adaptBodyForChannel({
      body: "Post body",
      channel: "linkedin",
      title: "Weekly Report",
    });
    expect(adapted.body).toContain("Weekly Report");
    expect(adapted.body).toContain("Post body");
  });

  it("caps hashtag count on Instagram to the channel limit", () => {
    const body =
      "#one #two #three #four #five #six #seven #eight #nine #ten #11 #12 #13 #14 #15 #16 #17 #18 #19 #20 #21 #22 #23 #24 #25 #26 #27 #28 #29 #30 #31 #32 #33 #34 #35";
    const adapted = adaptBodyForChannel({ body, channel: "instagram" });
    const hashtags = adapted.body.match(/#\S+/g) ?? [];
    expect(hashtags.length).toBeLessThanOrEqual(30);
  });

  it("normalizes known channel aliases to canonical ids", () => {
    const variants = adaptMasterCopyToChannels({
      body: "hello",
      channels: ["x", "instagram", "facebook"],
    });
    const ids = variants.map((v) => v.channel);
    expect(ids).toContain("x");
    expect(ids).toContain("instagram");
    expect(ids).toContain("facebook");
    expect(variants.length).toBeGreaterThanOrEqual(3);
    variants.forEach((v) => {
      expect(v.body.length).toBeGreaterThan(0);
      expect(v.toneHint.length).toBeGreaterThan(0);
    });
  });

  it("returns generic spec for unknown channel ids", () => {
    const variants = adaptMasterCopyToChannels({
      body: "hello",
      channels: ["unknown-channel"],
    });
    expect(variants).toHaveLength(1);
    expect(variants[0]?.channel).toBe("unknown-channel");
  });

  it("deduplicates repeated channel ids in master copy expansion", () => {
    const variants = adaptMasterCopyToChannels({
      body: "hello",
      channels: ["x", "x", "instagram"],
    });
    const ids = variants.map((v) => v.channel);
    const xCount = ids.filter((id) => id === "x").length;
    expect(xCount).toBe(1);
    expect(ids).toContain("instagram");
  });
});

describe("marketing outbound guard", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("blocks send when draft is not approved", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-guard-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({
      channel: "telegram",
      body: "hi",
      stateDir,
    });
    const { approval } = await requestPublishApproval({
      postDraftId: draft.id,
      stateDir,
    });
    expect(approval.status).toBe("pending");

    const prev = process.env.FOXFANG_STATE_DIR;
    process.env.FOXFANG_STATE_DIR = stateDir;
    try {
      await expect(
        assertMarketingOutboundAllowed({
          action: "send",
          params: { marketingPostDraftId: draft.id },
          dryRun: false,
        }),
      ).rejects.toThrow(/blocked/i);
    } finally {
      if (prev === undefined) {
        delete process.env.FOXFANG_STATE_DIR;
      } else {
        process.env.FOXFANG_STATE_DIR = prev;
      }
    }
  });

  it("allows send after approval", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-guard-ok-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({
      channel: "telegram",
      body: "hi",
      stateDir,
    });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    await resolveApproval({ approvalId: approval.id, status: "approved", stateDir });

    const prev = process.env.FOXFANG_STATE_DIR;
    process.env.FOXFANG_STATE_DIR = stateDir;
    try {
      await expect(
        assertMarketingOutboundAllowed({
          action: "send",
          params: { marketingPostDraftId: draft.id },
          dryRun: false,
        }),
      ).resolves.toBeUndefined();
    } finally {
      if (prev === undefined) {
        delete process.env.FOXFANG_STATE_DIR;
      } else {
        process.env.FOXFANG_STATE_DIR = prev;
      }
    }
  });

  it("skips guard in dry-run mode even when no draftId is provided", async () => {
    await expect(
      assertMarketingOutboundAllowed({
        action: "send",
        dryRun: true,
      }),
    ).resolves.toBeUndefined();
  });

  it("skips guard when no marketingPostDraftId is provided and the strict flag is off", async () => {
    await expect(
      assertMarketingOutboundAllowed({
        action: "send",
        dryRun: false,
        params: {},
      }),
    ).resolves.toBeUndefined();
  });

  it("throws when the marketingPostDraftId references a non-existent draft", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-guard-missing-"));
    tempDirs.push(stateDir);

    const prev = process.env.FOXFANG_STATE_DIR;
    process.env.FOXFANG_STATE_DIR = stateDir;
    try {
      await expect(
        assertMarketingOutboundAllowed({
          action: "send",
          params: { marketingPostDraftId: "nonexistent-id" },
          dryRun: false,
        }),
      ).rejects.toThrow();
    } finally {
      if (prev === undefined) {
        delete process.env.FOXFANG_STATE_DIR;
      } else {
        process.env.FOXFANG_STATE_DIR = prev;
      }
    }
  });

  it("enforces guard for non-send actions when a draftId is provided", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-guard-nonsend-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({
      channel: "telegram",
      body: "hi",
      stateDir,
    });

    const prev = process.env.FOXFANG_STATE_DIR;
    process.env.FOXFANG_STATE_DIR = stateDir;
    try {
      await expect(
        assertMarketingOutboundAllowed({
          action: "reply",
          params: { marketingPostDraftId: draft.id },
          dryRun: false,
        }),
      ).rejects.toThrow(/blocked/i);
    } finally {
      if (prev === undefined) {
        delete process.env.FOXFANG_STATE_DIR;
      } else {
        process.env.FOXFANG_STATE_DIR = prev;
      }
    }
  });

  it("ignores actions not in the guarded list even when draftId is set", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-guard-unlisted-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({
      channel: "telegram",
      body: "hi",
      stateDir,
    });

    const prev = process.env.FOXFANG_STATE_DIR;
    process.env.FOXFANG_STATE_DIR = stateDir;
    try {
      await expect(
        assertMarketingOutboundAllowed({
          action: "think",
          params: { marketingPostDraftId: draft.id },
          dryRun: false,
        }),
      ).resolves.toBeUndefined();
    } finally {
      if (prev === undefined) {
        delete process.env.FOXFANG_STATE_DIR;
      } else {
        process.env.FOXFANG_STATE_DIR = prev;
      }
    }
  });
});

describe("marketing scheduled publish", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("lists due scheduled drafts after scheduledAt", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-sched-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({
      channel: "facebook",
      body: "scheduled post",
      stateDir,
    });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    await resolveApproval({ approvalId: approval.id, status: "approved", stateDir });
    await schedulePostDraft({
      postDraftId: draft.id,
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      stateDir,
    });

    const due = await listDueScheduledPostDrafts({ stateDir });
    expect(due).toHaveLength(1);
    expect(due[0]?.recommendedTool).toBe("social_meta_page_publish");
  });

  it("returns no drafts when the only scheduled draft is unapproved", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-sched-unapproved-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({
      channel: "facebook",
      body: "unapproved",
      stateDir,
    });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    await resolveApproval({ approvalId: approval.id, status: "denied", stateDir });

    const due = await listDueScheduledPostDrafts({ stateDir });
    expect(due).toHaveLength(0);
  });

  it("falls back to message tool for non-Meta channels", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-sched-tg-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({
      channel: "telegram",
      body: "tg post",
      stateDir,
    });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    await resolveApproval({ approvalId: approval.id, status: "approved", stateDir });
    await schedulePostDraft({
      postDraftId: draft.id,
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      stateDir,
    });

    const due = await listDueScheduledPostDrafts({ stateDir });
    expect(due[0]?.recommendedTool).toBe("message");
  });

  it("returns drafts sorted by scheduledAt ascending", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-sched-sort-"));
    tempDirs.push(stateDir);

    const baseTime = Date.now() - 120_000;
    const drafts = [];
    for (const channel of ["facebook", "instagram"]) {
      const draft = await createPostDraft({ channel, body: channel, stateDir });
      const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
      await resolveApproval({ approvalId: approval.id, status: "approved", stateDir });
      await schedulePostDraft({
        postDraftId: draft.id,
        scheduledAt: new Date(baseTime + drafts.length * 30_000).toISOString(),
        stateDir,
      });
      drafts.push(draft);
    }

    const due = await listDueScheduledPostDrafts({ stateDir });
    const times = due.map((d) => new Date(d.scheduledAt ?? 0).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i] ?? 0).toBeGreaterThanOrEqual(times[i - 1] ?? 0);
    }
  });

  it("respects a custom nowMs anchor for deterministic ordering", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-sched-anchor-"));
    tempDirs.push(stateDir);
    const nowMs = Date.now() + 86_400_000;

    const draft = await createPostDraft({
      channel: "facebook",
      body: "future",
      stateDir,
    });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    await resolveApproval({ approvalId: approval.id, status: "approved", stateDir });
    await schedulePostDraft({
      postDraftId: draft.id,
      scheduledAt: new Date(nowMs - 3_600_000).toISOString(),
      stateDir,
    });

    const due = await listDueScheduledPostDrafts({ stateDir, nowMs });
    expect(due).toHaveLength(1);
  });
});

describe("marketing post-draft lifecycle", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("creates a draft with default status draft and timestamps", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-lifecycle-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({
      channel: "facebook",
      body: "test post",
      stateDir,
    });
    expect(draft.status).toBe("draft");
    expect(draft.createdAt).toBeTruthy();
    expect(draft.updatedAt).toBeTruthy();
    expect(draft.id).toBeTruthy();
  });

  it("creates cross-platform drafts and preserves the requested channels", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-lifecycle-cross-"));
    tempDirs.push(stateDir);

    const d1 = await createPostDraft({ channel: "facebook", body: "fb", stateDir });
    const d2 = await createPostDraft({ channel: "instagram", body: "ig", stateDir });
    expect(d1.channel).toBe("facebook");
    expect(d2.channel).toBe("instagram");
    expect(d1.id).not.toBe(d2.id);
  });

  it("moves a draft to pending_approval when requesting publish", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-lifecycle-pending-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({ channel: "telegram", body: "hi", stateDir });
    const { approval, draft: updatedDraft } = await requestPublishApproval({
      postDraftId: draft.id,
      stateDir,
    });
    expect(approval.status).toBe("pending");
    expect(updatedDraft.status).toBe("pending_approval");
    expect(updatedDraft.approvalId).toBe(approval.id);
  });

  it("reverts a denied approval back to draft and clears the approvalId link", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-lifecycle-deny-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({ channel: "telegram", body: "hi", stateDir });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    const { drafts } = await resolveApproval({
      approvalId: approval.id,
      status: "denied",
      stateDir,
    });
    const reverted = drafts[0] as PostDraft;
    expect(reverted.status).toBe("draft");
    expect(reverted.approvalId).toBeUndefined();
  });

  it("resolves an approval with the resolvedBy attribution", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-lifecycle-resolve-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({ channel: "telegram", body: "hi", stateDir });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    const { drafts } = await resolveApproval({
      approvalId: approval.id,
      status: "approved",
      resolvedBy: "user@example.com",
      stateDir,
    });
    const resolved = drafts[0] as PostDraft;
    expect(resolved.status).toBe("approved");
    expect(resolved.approvalId).toBe(approval.id);
  });

  it("refuses to schedule a draft that has not been approved", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-lifecycle-nosched-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({ channel: "telegram", body: "hi", stateDir });
    await expect(
      schedulePostDraft({
        postDraftId: draft.id,
        scheduledAt: new Date().toISOString(),
        stateDir,
      }),
    ).rejects.toThrow();
  });

  it("transitions a draft from approved to scheduled when scheduling", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-lifecycle-sched-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({ channel: "telegram", body: "hi", stateDir });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    await resolveApproval({ approvalId: approval.id, status: "approved", stateDir });
    const scheduled = await schedulePostDraft({
      postDraftId: draft.id,
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      stateDir,
    });
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.scheduledAt).toBeTruthy();
  });

  it("marks a draft as published with a publishedAt timestamp", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-lifecycle-pub-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({ channel: "telegram", body: "hi", stateDir });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    await resolveApproval({ approvalId: approval.id, status: "approved", stateDir });
    await schedulePostDraft({
      postDraftId: draft.id,
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      stateDir,
    });
    const published = await markPostDraftPublished({
      postDraftId: draft.id,
      stateDir,
    });
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeTruthy();
  });
});

describe("marketing store", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("persists brands to store.json", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-"));
    tempDirs.push(stateDir);

    const brand: Brand = {
      id: "brand_test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: "Test Brand",
      voice: "warm",
    };
    await upsertBrand(brand, stateDir);

    const loaded = await loadMarketingStore(stateDir);
    expect(loaded.brands).toHaveLength(1);
    expect(loaded.brands[0]?.name).toBe("Test Brand");
    expect(resolveMarketingStorePath(stateDir)).toContain("marketing/store.json");
  });

  it("updates an existing brand when upsertBrand is called twice", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-update-"));
    tempDirs.push(stateDir);

    const brand: Brand = {
      id: "brand_test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: "Original",
      voice: "warm",
    };
    await upsertBrand(brand, stateDir);
    brand.name = "Updated";
    await upsertBrand(brand, stateDir);

    const loaded = await loadMarketingStore(stateDir);
    expect(loaded.brands).toHaveLength(1);
    expect(loaded.brands[0]?.name).toBe("Updated");
  });

  it("returns an empty store when the file does not exist", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-empty-"));
    tempDirs.push(stateDir);

    const store = await loadMarketingStore(stateDir);
    expect(store.brands).toHaveLength(0);
    expect(store.products).toHaveLength(0);
    expect(store.campaigns).toHaveLength(0);
  });

  it("rejects files whose version does not match and falls back to empty store", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-version-"));
    tempDirs.push(stateDir);

    const storePath = resolveMarketingStorePath(stateDir);
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(
      storePath,
      JSON.stringify({
        version: 999,
        brands: [],
        products: [],
        campaigns: [],
        contentPlans: [],
        postDrafts: [],
        approvals: [],
        insights: [],
        leads: [],
      }),
    );

    const store = await loadMarketingStore(stateDir);
    expect(store.brands).toHaveLength(0);
  });

  it("rebuilds missing object arrays when loading older store fixtures", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-rebuild-"));
    tempDirs.push(stateDir);

    const storePath = resolveMarketingStorePath(stateDir);
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(
      storePath,
      JSON.stringify({
        version: 1,
        brands: [
          {
            id: "b1",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
            name: "Old",
            voice: "bold",
          },
        ],
      }),
    );

    const store = await loadMarketingStore(stateDir);
    expect(store.brands).toHaveLength(1);
    expect(Array.isArray(store.products)).toBe(true);
    expect(Array.isArray(store.campaigns)).toBe(true);
    expect(Array.isArray(store.contentPlans)).toBe(true);
    expect(Array.isArray(store.insights)).toBe(true);
  });
});

describe("marketing approval error paths", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("rejects an approval request that targets a non-existent draft", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-err-noreq-"));
    tempDirs.push(stateDir);

    await expect(
      requestPublishApproval({ postDraftId: "missing-draft-id", stateDir }),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects resolving an approval that does not exist", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-err-nores-"));
    tempDirs.push(stateDir);

    await expect(
      resolveApproval({ approvalId: "missing-approval-id", status: "approved", stateDir }),
    ).rejects.toThrow(/not found/i);
  });

  it("keeps a denied draft unpublishable: status reverts and the approval link is cleared", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-err-denied-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({ channel: "telegram", body: "needs approval", stateDir });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    const { drafts } = await resolveApproval({
      approvalId: approval.id,
      status: "denied",
      stateDir,
    });
    const reverted = drafts[0] as PostDraft;

    const verdict = canPublishPostDraft(reverted);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/approved or scheduled/i);
    expect(reverted.approvalId).toBeUndefined();
  });

  it("blocks the outbound guard for a draft whose approval was denied", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-err-guard-denied-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({ channel: "telegram", body: "denied post", stateDir });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    await resolveApproval({ approvalId: approval.id, status: "denied", stateDir });

    const prev = process.env.FOXFANG_STATE_DIR;
    process.env.FOXFANG_STATE_DIR = stateDir;
    try {
      await expect(
        assertMarketingOutboundAllowed({
          action: "send",
          params: { marketingPostDraftId: draft.id },
          dryRun: false,
        }),
      ).rejects.toThrow(/blocked/i);
    } finally {
      if (prev === undefined) {
        delete process.env.FOXFANG_STATE_DIR;
      } else {
        process.env.FOXFANG_STATE_DIR = prev;
      }
    }
  });

  it("refuses to schedule a draft after its approval is denied (re-publish attempt)", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-mkt-err-resched-"));
    tempDirs.push(stateDir);

    const draft = await createPostDraft({ channel: "facebook", body: "retry", stateDir });
    const { approval } = await requestPublishApproval({ postDraftId: draft.id, stateDir });
    await resolveApproval({ approvalId: approval.id, status: "denied", stateDir });

    await expect(
      schedulePostDraft({
        postDraftId: draft.id,
        scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        stateDir,
      }),
    ).rejects.toThrow(/approved before scheduling/i);
  });
});
