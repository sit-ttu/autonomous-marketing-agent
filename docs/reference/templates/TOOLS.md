---
title: "TOOLS.md Template"
summary: "Workspace template for local tool notes"
read_when:
  - Bootstrapping a workspace manually
---

# TOOLS.md - Local Tool Notes

Skills and plugins define which tools exist. This file records workspace-specific details that help the agent use configured tools safely for marketing operations.

Do not store secrets, access tokens, passwords, private keys, or live customer data here.

## Marketing data sources

```markdown
### Analytics

- Source:
- Account/property:
- Read-only? yes/no
- Notes:

### Ads platform

- Source:
- Account:
- Read-only? yes/no
- Budget or mutation allowed only after approval: yes
- Notes:
```

## Channels

```markdown
### Social or messaging channel

- Channel:
- Purpose: briefs / approvals / alerts / publishing
- Approval owner:
- Posting allowed only after explicit approval: yes
- Notes:
```

## Browser and research

```markdown
### Browser

- Use for live page review, screenshots, and interactive sites.
- Verify product pages before making claims.
- Save screenshots or reports only in approved workspace paths.
```

## Scheduling

```markdown
### Recurring tasks

- Weekly report:
- Content planning reminder:
- Approval follow-up:
```

## File and artifact conventions

```markdown
### Outputs

- Drafts:
- Reports:
- Screenshots:
- Logs or evidence:
```

## Tool policy reminders

- Reading, summarizing, drafting, and creating internal reminders are safe by default.
- External publishing, bulk messages, ads changes, budget changes, and production writes require explicit approval.
- When a tool fails, report the specific failure and suggest the next safe fallback.
