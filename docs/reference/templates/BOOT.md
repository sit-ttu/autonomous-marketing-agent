---
title: "BOOT.md Template"
summary: "Optional startup checklist for a FoxFang marketing operations workspace"
read_when:
  - Adding a BOOT.md checklist
---

# BOOT.md

Short startup checklist for gateway restart hooks when `hooks.internal.enabled` is enabled.

Keep this file small. Good startup tasks include checking for due reminders, pending approval alerts, or recurring report preparation. Do not publish, send bulk messages, or change ads/budgets from startup hooks without explicit approval.

If a startup task sends a message, use the message tool and then reply with `NO_REPLY`.
