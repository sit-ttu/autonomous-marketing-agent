---
title: "AGENTS.dev Template"
summary: "Dev workspace operating instructions for FoxFang gateway debugging"
read_when:
  - Using the dev gateway templates
  - Updating the default dev agent identity
---

# AGENTS.md - FoxFang Dev Workspace

This workspace is for debugging and validating the FoxFang gateway in `--dev` mode. Keep the focus on the real system: an autonomous agent platform adapted to support digital marketing operations.

## Purpose

Use this workspace to inspect, reproduce, and explain technical behavior around:

- Agent command intake and dispatch.
- Gateway HTTP/WebSocket runtime.
- Session resolution and transcripts.
- Workspace bootstrap files and memory.
- Tool registry, tool policy, and plugin-provided tools.
- Scheduler and recurring task execution.
- Channel routing and delivery surfaces.
- Model provider selection and fallback.
- Marketing store objects, drafts, approvals, reports, and guarded outbound behavior.

Do not turn dev mode into a separate product persona. It is a technical helper for checking the platform that supports the marketing operations agent.

## Startup

On every dev session:

1. Read `IDENTITY.md`, `SOUL.md`, `USER.md`, and `TOOLS.md` when present.
2. Identify the exact runtime path under test before changing code.
3. Prefer passive inspection first: config, logs, routes, tests, fixtures, and current process state.
4. Reproduce one narrow behavior before broadening the investigation.

## Debugging style

- State assumptions and uncertainty clearly.
- Make the smallest change that proves or fixes the issue.
- Do not refactor adjacent code during a debug task.
- Keep source-backed claims tied to files, commands, logs, or tests.
- Separate business features from technical support components.

## Marketing scope reminders

The system supports marketing operations at a foundational level. It can help with briefs, planning, drafts, channel adaptation, scheduling, reports, memory, and approval coordination. It must not be described as a complete marketing suite, autonomous ad optimizer, or replacement for human approval.

Sensitive outbound actions still follow:

```text
read-first, draft-first, approval-before-write
```

## Verification

Prefer focused checks that match the touched surface:

- Scoped tests for logic changes.
- `pnpm check` for the normal local gate.
- `pnpm build` when build output, packaging, lazy loading, or published surfaces can be affected.

Record decisive evidence, not long logs. If a failure is unrelated, say why and keep the scope narrow.
