---
title: "SKILLS.md Template"
summary: "Workspace task patterns for a FoxFang marketing operations agent"
read_when:
  - Agent needs guidance on handling specific marketing task types
---

# SKILLS.md - Marketing Task Patterns

This file describes how to combine available tools and workspace context for common marketing operations tasks.

## Brief intake

When the operator gives a vague request:

1. Read `BRAND.md`, `PRODUCT.md`, `USER.md`, and relevant memory.
2. Produce a short brief with objective, audience, product/offer, channels, timeline, constraints, KPIs, and missing information.
3. Infer low-risk details from existing context and label assumptions.
4. Ask only for missing facts that block useful work.
5. End with the next stage: strategy, plan, draft, report, or approval request.

## Strategy support

Use when the operator asks for positioning, campaign direction, audience fit, or message angles.

Return:

- Current objective and audience.
- Product or offer context used.
- 2-4 strategic directions with rationale.
- Risks, claims to avoid, and needed proof.
- Recommended next step.

Do not claim to have validated market performance unless measured data is available.

## Planning

Use when the operator needs a content plan, campaign outline, or task list.

Return:

- Campaign goal and KPI.
- Timeline or phases.
- Channel mix and role of each channel.
- Calendar or task list.
- Required assets and approvals.
- Risks and open questions.

## Draft creation

Before drafting, read brand and product context. Return drafts as reviewable artifacts, not final outbound actions.

Include:

- Channel/platform.
- Audience segment.
- Draft copy or script.
- CTA.
- Notes on assumptions or claims used.
- Approval status: `draft - not published`.

## Channel adaptation

When adapting one idea across platforms:

1. Preserve the core message and factual claims.
2. Adjust length, tone, CTA, and format for each channel.
3. Keep disclaimers or compliance notes when required.
4. Mark all outputs as drafts until approved.

## Reporting and measurement

Use provided/read-only data. Do not invent performance numbers.

Return:

- Data source and date range.
- Key metrics provided.
- Short interpretation.
- Anomalies or risks.
- Suggested next experiments or follow-ups.
- Items that need human review.

## Approval workflow

For sensitive outbound actions, prepare an approval packet:

- Proposed action.
- Target channel/account/audience.
- Exact content or setting change.
- Timing.
- Risks or constraints.
- Clear question: "Approve this action?"

Execute only after explicit approval and only through configured tools.

## Memory update

After confirmed decisions, approvals, reports, or results:

- Add raw notes to `memory/YYYY-MM-DD.md`.
- Promote durable facts to `MEMORY.md`.
- Keep secrets and credentials out of memory.
