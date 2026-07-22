# FoxFang — Implementation notes (upstream sync & marketing)

Living log of **decisions not in spec**, **tradeoffs**, and **deviations** while implementing [`upstream-openclaw-sync-todo.md`](upstream-openclaw-sync-todo.md).

**Spec anchors:** [`AGENT_MARKETING_VI.md`](../AGENT_MARKETING_VI.md), [`features_ads.md`](../features_ads.md), [`features_cross_platform_social_post.md`](../features_cross_platform_social_post.md)

**Last updated:** 2026-05-25 (Wave 2)

---

## 1. Scope of this implementation wave

### 1.1. In scope (done or started in repo)

| Area               | Deliverable                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| Product foundation | `src/marketing/*` — typed objects, JSON store, approval gate, brand context |
| Config types       | `src/config/types.marketing.ts` + optional `marketing` on `FoxFangConfig`   |
| Meta Ads           | `extensions/meta-ads` — Phase A read-only tools + Graph client stub         |
| Agent guidance     | `skills/marketing-*` — four specialist skills                               |
| Examples           | `docs/marketing/agents.example.json`                                        |
| Ops                | `scripts/dev/add-upstream-remote.sh`, `ip-address` pnpm override            |
| Tracking           | This file + checkbox updates in sync todo                                   |

### 1.2. Explicitly out of scope (deferred)

| Item                                                               | Reason                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Full `git merge` / cherry-pick from OpenClaw `2026.5.25`           | Hundreds of commits; needs dedicated sync branches per P0/P1 in todo                  |
| Generated config schema (`pnpm config:schema:gen`) for `marketing` | Avoids large baseline drift in one PR; config key is optional TypeScript-only for now |
| Notion / Google Workspace plugins                                  | Level 1 backlog; no stable SDK contract in fork yet                                   |
| Live Meta Graph API in CI                                          | Requires secrets; tools return structured “not configured” errors                     |
| Control UI marketing screens                                       | Operators can use CLI/channels + skills first                                         |

---

## 2. Architectural decisions

### 2.1. Marketing state: workspace JSON store, not only config file

**Decision:** Persist `Brand`, `Product`, `Campaign`, `PostDraft`, `Approval`, `Insight`, `Lead` under `{stateDir}/marketing/store.json` (see `src/marketing/store.ts`).

**Why not only `foxfang.json`?**

- Marketing objects are many, change often, and belong to **long-running campaigns** — polluting core config increases merge conflict risk and doctor noise.
- Matches positioning: “process with state”, not single chat session.

**Tradeoff:** No UI editor yet; operators edit via agent tools / future CLI. Config `marketing.defaultBrandId` only points to defaults.

**Future:** Optional sync slice to `~/.foxfang/foxfang.json` for _pointers_ (default brand, default ad account), not full object graphs.

### 2.2. Config `marketing` section (optional, loosely validated)

**Decision:** `marketing?: MarketingConfig` on `FoxFangConfig`; Zod `MarketingSchema` in `zod-schema.marketing.ts`; `pnpm config:schema:gen` updates `schema.base.generated.ts` + `schema.help.ts` entries.

### 2.3. Approval gate: central registry + action kinds

**Decision:** `src/marketing/approval-gate.ts` defines `MarketingWriteActionKind` and `requiresMarketingApproval()`.

**Not in spec:** Exact enum list — derived from AGENT_MARKETING_VI §6 table + `features_ads.md` write scopes.

**Mapping:**

- Read/analyze/draft → no gate
- `publish_post`, `bulk_message`, `ads_write`, `integration_write` → gate required

**Upstream honesty:** Through Wave 3, **no bulk OpenClaw merge** was performed — only FoxFang marketing features. Real upstream file ports started 2026-05-25; see `docs/upstream-port-status.md`.

**Wave 2:** Core `message` outbound is guarded when callers pass `marketingPostDraftId` (`src/marketing/outbound-guard.ts` + `message-action-runner.ts`). Meta-ads and future social write plugins must still avoid registering write tools without the same gate.

### 2.3b. Cross-platform posting Phase B (draft path only)

**Decision:** `src/marketing/cross-post.ts` does deterministic length/hashtag adaptation (no LLM). `post-draft-ops.ts` creates drafts, approval requests, schedule markers.

**Agent tools:** `marketing_*` in `src/agents/tools/marketing-tools.ts`, registered from `createFoxFangTools`.

**Publish flow:**

1. `marketing_post_cross_platform_create` or `marketing_post_draft_create`
2. `marketing_post_request_publish` → pending Approval
3. Operator `marketing_approval_resolve` with `approved`
4. `message` tool `send` with `marketingPostDraftId` + matching body/channel
5. `marketing_post_mark_published` after successful send

**Phase C (partial):** `extensions/social-post` — `social_meta_page_publish` calls Graph `/{page-id}/feed` only after `canPublishPostDraft`. TikTok/LinkedIn/X and cron executor still deferred.

**SDK:** `foxfang/plugin-sdk/marketing` re-exports store/gate helpers for extensions.

**Strict mode:** `marketing.requireApprovedDraftForMessageSend` blocks all message sends without `marketingPostDraftId`.

### 2.4. Meta Ads Phase A: real Graph client, no write tools

**Decision:** Implement `extensions/meta-ads` with Graph API v21.0 fetch helpers; register **read-only** tools only.

**Not in spec:**

- API version pin `v21.0` (Meta current stable pattern; bump in dedicated change).
- When token missing, tools return JSON `{ ok: false, error: "..." }` instead of throwing — better for agent recovery.

**Deferred Phase B:** `meta_ads_campaign_draft_create` creates local `Approval` + draft record, not Graph POST.

### 2.5. Upstream OpenClaw sync strategy

**Decision:** Do **not** bulk-merge upstream in this change. Provide `scripts/dev/add-upstream-remote.sh` and document port waves in sync todo.

**Why:** FoxFang rename (`foxfang` / `FOXFANG_`), deleted docs, and marketing-only positioning cause high conflict rate. Marketing product code should land on current fork first.

**Tradeoff:** P0 security GHSA fixes still outstanding until manual port — tracked in sync todo §4.

### 2.6. Agent specialists: skills, not hard-coded subagents in core

**Decision:** Ship `skills/marketing-orchestrator`, `marketing-strategy`, `marketing-content`, `marketing-growth` instead of modifying core agent registry.

**Why:** Matches existing FoxFang pattern (skills + `agents.list` config). Users opt in via `docs/marketing/agents.example.json`.

**Not in spec:** Skill names — chosen to match AGENTS.md four roles.

### 2.7. Brand context injection: file-based `brand.kit.md`

**Decision:** `src/marketing/brand-context.ts` loads `brand.kit.md` from workspace or `marketing/brands/{id}.md` under state dir.

**Why:** AGENT_MARKETING_VI §5.1 says avoid stuffing brand into every prompt manually; markdown kit is operator-friendly.

**Tradeoff:** No enforcement hook in Pi embed yet — skills instruct orchestrator; future: pre-turn hook.

---

## 3. Changes from / gaps in spec

| Spec says                              | Implementation choice                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `read-first, draft-first` in AGENTS.md | AGENT_MARKETING_VI uses **`draft-first, approval-before-write`** — implementation follows **VI doc**    |
| Meta plugin path `extensions/meta-ads` | Created; tools names match `features_ads.md` table                                                      |
| Cross-platform post feature            | **Phase B** — drafts + adapt + approval + message guard; **Phase C** — live social API plugins deferred |
| document-extract plugin                | Not ported from upstream (sync backlog)                                                                 |
| Telegram 👍 approval                   | Relies on existing core approval; not reimplemented in marketing module                                 |

---

## 4. Security & dependencies

| Change                               | Notes                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `pnpm.overrides.ip-address = 10.2.0` | Aligns with OpenClaw `2026.5.5` Dependabot fix; FoxFang lacked override                                                  |
| Meta access token                    | Stored via plugin config / `META_ADS_ACCESS_TOKEN` env — **never** log token; audit log only operation name + account id |
| Upstream GHSA patches                | **Not applied** in this commit — see §2.5                                                                                |

---

## 5. Files added (reference)

```text
docs/implementation-notes.md          (this file)
docs/marketing/agents.example.json
src/config/types.marketing.ts
src/marketing/*
src/agents/tools/marketing-tools.ts
extensions/meta-ads/*
skills/marketing-*/
scripts/dev/add-upstream-remote.sh
```

---

## 6. Open questions (need your input)

1. **Default state dir for marketing store:** global `~/.foxfang/marketing` vs per-agent `~/.foxfang/agents/{id}/marketing` — currently **global** with optional `agentId` on records.
2. **Config schema gen now or next PR?** Running `pnpm config:schema:gen` will touch large generated baselines.
3. **Meta Ads token:** User-level long-lived token vs Business System User — Phase A assumes **long-lived user/system token** in plugin config.
4. **Upstream sync priority:** Confirm order P0 security → channels → plugins before more marketing features.

---

## 7. Changelog of implementation waves

| Date       | Wave   | Summary                                                                                                                     |
| ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-25 | Wave 1 | Marketing core module, meta-ads read-only plugin, skills, implementation notes, ip-address override, upstream remote script |
| 2026-05-25 | Wave 2 | Cross-post adapt, post-draft ops, marketing agent tools, outbound message guard                                             |
| 2026-05-25 | Wave 3 | Zod `marketing` config + schema gen; `foxfang/plugin-sdk/marketing`; `extensions/social-post` Meta Page publish tool        |

### Test status

`src/marketing/marketing.test.ts` added; full `pnpm test` wrapper failed in this environment (`scripts/test-parallel.mjs` missing / vitest config). Run locally after `pnpm install` when harness is intact.

---

_Update this file whenever you make a non-obvious choice during sync or marketing work._
