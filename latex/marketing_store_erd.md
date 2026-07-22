# FoxFang Marketing Store — Data Model (ERD)

> Verified against source: `src/marketing/types.ts`, `src/marketing/store.ts`,
> `src/marketing/post-draft-ops.ts`. Field names and relationships match the
> implemented `MarketingStore` (JSON store, version 1).
>
> Render check: paste any block into <https://mermaid.live> or open this file in a
> Mermaid-aware viewer (VS Code "Markdown Preview Mermaid Support", GitHub, Obsidian).
> Rendered PNGs live in `media/` (see file names under each diagram).
> All labels are in English so the diagrams can be dropped straight into Chapter 3.

> **Shared base fields.** Every record extends `MarketingRecordBase`:
> `id`, `createdAt`, `updatedAt`, optional `agentId`, optional `campaignId`.
> To keep the diagram readable, only `id` and the distinctive fields are shown per entity.

---

## 1. Entity Relationship Diagram (core marketing store)

> Rendered: `media/figure_3_4_marketing_store_erd.png`

```mermaid
---
config:
  theme: base
  themeVariables:
    primaryColor: '#EAF2FB'
    primaryBorderColor: '#1A73E8'
    primaryTextColor: '#1A2330'
    lineColor: '#5F6368'
    tertiaryColor: '#F5F7FA'
---
erDiagram
    BRAND        ||--o{ PRODUCT           : "owns"
    BRAND        ||--o{ CAMPAIGN          : "runs"
    PRODUCT      ||--o{ CAMPAIGN          : "featured in"
    BRAND        ||--o{ POST_DRAFT        : "scopes"
    CAMPAIGN     ||--o{ POST_DRAFT        : "scopes"
    CAMPAIGN     ||--o{ CONTENT_PLAN      : "has"
    CONTENT_PLAN ||--o{ CONTENT_PLAN_SLOT : "contains"
    CONTENT_PLAN_SLOT |o--o| POST_DRAFT   : "fills"
    APPROVAL     ||--o{ POST_DRAFT        : "gates"
    BRAND        ||--o{ INSIGHT           : "accumulates"
    CAMPAIGN     ||--o{ INSIGHT           : "accumulates"
    BRAND        ||--o{ LEAD              : "collects"
    CAMPAIGN     ||--o{ LEAD              : "collects"

    BRAND {
        string id PK
        string name
        string voice
        string positioning
        string audience
        list   guardrails
        list   messagingPillars
    }

    PRODUCT {
        string id PK
        string brandId FK
        string name
        string description
        list   features
        list   benefits
        list   usps
        json   faqs
        string pricingNote
    }

    CAMPAIGN {
        string id PK
        string brandId FK
        string productId FK
        string title
        string brief
        string audience
        list   channels
        list   kpis
        list   constraints
        datetime startAt
        datetime endAt
    }

    CONTENT_PLAN {
        string id PK
        string campaignId FK
        list   slots
    }

    CONTENT_PLAN_SLOT {
        string id PK
        datetime scheduledAt
        string channel
        string format
        string topic
        string goal
        string postDraftId FK
    }

    POST_DRAFT {
        string id PK
        string brandId FK
        string campaignId FK
        string approvalId FK
        string channel
        enum   status
        string title
        text   body
        datetime scheduledAt
        datetime publishedAt
    }

    APPROVAL {
        string id PK
        string campaignId FK
        string actionKind
        string summary
        enum   status
        json   payload
        datetime resolvedAt
        string resolvedBy
    }

    INSIGHT {
        string id PK
        string brandId FK
        string campaignId FK
        text   text
        string source
    }

    LEAD {
        string id PK
        string brandId FK
        string campaignId FK
        string name
        string channel
        enum   status
        string notes
    }
```

### Relationship summary

| Relationship                       | Type   | Source field                  | Meaning                                                        |
| ---------------------------------- | ------ | ----------------------------- | -------------------------------------------------------------- |
| Brand → Product                    | 1–n    | `Product.brandId`             | A brand owns many products.                                    |
| Brand → Campaign                   | 1–n    | `Campaign.brandId`            | A brand runs many campaigns.                                   |
| Product → Campaign                 | 1–n    | `Campaign.productId`          | A product is featured in many campaigns.                       |
| Brand → PostDraft                  | 1–n    | `PostDraft.brandId`           | Each draft is scoped to a brand.                               |
| Campaign → PostDraft               | 1–n    | `PostDraft.campaignId`        | Each draft is scoped to a campaign.                            |
| Campaign → ContentPlan             | 1–n    | `ContentPlan.campaignId`      | A campaign has one or more content plans.                      |
| ContentPlan → ContentPlanSlot      | 1–n    | `ContentPlan.slots[]`         | A plan contains many calendar slots (embedded).               |
| ContentPlanSlot → PostDraft        | 0..1   | `ContentPlanSlot.postDraftId` | A slot may be filled by one draft.                            |
| Approval → PostDraft               | 1–n    | `PostDraft.approvalId`        | One approval can gate one or several cross-channel drafts.    |
| Brand / Campaign → Insight         | 1–n    | `Insight.brandId/campaignId`  | Insights accumulate under a brand and a campaign.             |
| Brand / Campaign → Lead            | 1–n    | `Lead.brandId/campaignId`     | Leads are collected under a brand and a campaign.            |

> `ContentPlanSlot` is an embedded (weak) entity stored inside `ContentPlan.slots`,
> not a separate top-level collection. `channel` is a string identifier on
> `Campaign`, `PostDraft`, `ContentPlanSlot`, and `Lead` (e.g. `facebook`,
> `telegram`); there is no separate `Channel` table. `audience` is likewise a free
> text field on `Brand` and `Campaign`.

---

## 2. PostDraft lifecycle (approval-before-write gate)

> Rendered: `media/figure_3_5_postdraft_lifecycle.png`

The `PostDraft.status` enum encodes the **read-first, draft-first,
approval-before-write** principle. A draft cannot reach `published` without first
passing through human approval.

```mermaid
---
config:
  theme: base
  themeVariables:
    fontFamily: 'Helvetica, Arial, sans-serif'
    fontSize: '15px'
    lineColor: '#5F6368'
---
stateDiagram-v2
    classDef ideaState fill:#F1F3F4,stroke:#9AA0A6,color:#3C4043
    classDef draftState fill:#EAF2FB,stroke:#1A73E8,color:#1A2330
    classDef pendingState fill:#FEF7E0,stroke:#B06000,color:#5C3C00
    classDef approvedState fill:#E6F4EA,stroke:#137333,color:#0D652D

    [*] --> idea
    idea --> draft : develop content
    draft --> pending_approval : request approval
    pending_approval --> approved : human approves
    pending_approval --> draft : human denies (revise)
    approved --> scheduled : schedule
    scheduled --> published : publish via channel
    published --> measured : collect metrics
    measured --> [*]

    class idea ideaState
    class draft draftState
    class pending_approval pendingState
    class approved approvedState
    class scheduled approvedState
    class published approvedState
    class measured approvedState
```

---

## 3. Approval lifecycle (sensitive outbound actions)

> Rendered: `media/figure_3_6_approval_lifecycle.png`

Every sensitive outbound action (`actionKind`: `publish_post`, `bulk_message`,
`ads_write`, `integration_write`) is represented by an `Approval` record. The agent
may only proceed once a human resolves it.

```mermaid
---
config:
  theme: base
  themeVariables:
    fontFamily: 'Helvetica, Arial, sans-serif'
    fontSize: '15px'
    lineColor: '#5F6368'
---
stateDiagram-v2
    classDef pendingState fill:#FEF7E0,stroke:#B06000,color:#5C3C00
    classDef approvedState fill:#E6F4EA,stroke:#137333,color:#0D652D
    classDef deniedState fill:#FCE8E6,stroke:#C5221F,color:#8C1D18

    [*] --> pending : agent requests approval
    pending --> approved : human approves
    pending --> denied : human rejects
    pending --> expired : timeout
    approved --> [*] : action allowed
    denied --> [*] : action blocked
    expired --> [*] : action blocked

    class pending pendingState
    class approved approvedState
    class denied deniedState
    class expired deniedState
```
