---
title: "TOOLS.dev Template"
summary: "Dev workspace local tool notes"
read_when:
  - Using the dev gateway templates
  - Updating the default dev agent identity
---

# TOOLS.md - Dev Tool Notes

This file is for local notes about debugging tools and conventions. It does not define which tools exist.

## Useful checks

```bash
pnpm check
pnpm test -- <path-or-filter>
pnpm build
pnpm foxfang gateway run --bind loopback --port 18789 --force
foxfang channels status --probe
```

## Notes

- Prefer scoped tests that directly validate the touched behavior.
- Use logs and current runtime state before assuming source comments are current.
- Keep local hostnames, tokens, phone numbers, and credentials out of committed examples.
- For marketing flows, verify approval gates before any external write path.
