---
summary: "CLI reference for `foxfang agents` (isolated workspaces, identities, auth, and routing bindings)"
read_when:
  - You want multiple isolated agents with separate workspaces, routing, or auth profiles
  - You need to route channel traffic to a specific agent
  - You need to clarify the difference between CLI agents and marketing specialist roles
title: "agents"
---

# `foxfang agents`

Manage isolated FoxFang agents: workspace roots, agent state directories, identities, model defaults, auth profile behavior, and channel routing bindings.

In the marketing-operations architecture, these CLI agents are **runtime isolation units**. They are not automatically the same thing as product roles such as "Strategy Lead" or "Growth Analyst". You can model specialist behavior with separate workspaces, identities, prompts, skills, and routing, but the command itself only manages the runtime containers and routing metadata.

Related:

- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Common examples

```bash
foxfang agents list
foxfang agents list --bindings
foxfang agents add work --workspace ~/.foxfang/workspace-work
foxfang agents bindings
foxfang agents bind --agent work --bind telegram:ops
foxfang agents unbind --agent work --bind telegram:ops
foxfang agents set-identity --workspace ~/.foxfang/workspace --from-identity
foxfang agents set-identity --agent main --avatar avatars/foxfang.png
foxfang agents delete work
```

## When to use multiple agents

Use multiple agents when you need separate state or routing boundaries, for example:

- one workspace for general marketing planning and another for operational reports;
- one channel account routed to an `ops` agent and another to a `content` agent;
- different model defaults or auth profiles per agent;
- different `IDENTITY.md`, `BRAND.md`, `PRODUCT.md`, or memory files per workspace.

Do not create separate agents only to rename a marketing stage. If the same workspace, same memory, and same routing are enough, keep one agent and use clear prompts or skills instead.

## Routing bindings

Use routing bindings to pin inbound channel traffic to a specific agent.

List bindings:

```bash
foxfang agents bindings
foxfang agents bindings --agent work
foxfang agents bindings --json
```

Add bindings:

```bash
foxfang agents bind --agent work --bind telegram:ops --bind discord:guild-a
```

If you omit `accountId` (`--bind <channel>`), FoxFang resolves it from channel defaults and plugin setup hooks when available.

### Binding scope behavior

- A binding without `accountId` matches the channel default account only.
- `accountId: "*"` is the channel-wide fallback for all accounts and is less specific than an explicit account binding.
- If the same agent already has a matching channel binding without `accountId`, and you later bind with an explicit or resolved `accountId`, FoxFang upgrades that existing binding in place instead of adding a duplicate.

Example:

```bash
# Initial channel-only binding.
foxfang agents bind --agent work --bind telegram

# Later upgrade to account-scoped binding.
foxfang agents bind --agent work --bind telegram:ops
```

After the upgrade, routing for that binding is scoped to `telegram:ops`. If you also want default-account routing, add it explicitly, for example `--bind telegram:default`.

Remove bindings:

```bash
foxfang agents unbind --agent work --bind telegram:ops
foxfang agents unbind --agent work --all
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.foxfang/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root, unless you pass `--identity-file`

Avatar paths resolve relative to the workspace root. Use generic, non-secret identity files; do not put credentials, private customer data, or live campaign secrets in an identity file.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Load from `IDENTITY.md`:

```bash
foxfang agents set-identity --workspace ~/.foxfang/workspace --from-identity
```

Override fields explicitly:

```bash
foxfang agents set-identity --agent main --name "FoxFang" --emoji "🦊" --avatar avatars/foxfang.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "FoxFang",
          theme: "digital marketing operations",
          emoji: "🦊",
          avatar: "avatars/foxfang.png",
        },
      },
    ],
  },
}
```

## Approval and outbound actions

Routing an inbound channel to an agent does not bypass FoxFang's safety model. Marketing workflows should remain read-first and draft-first. Publishing, bulk messaging, ad mutation, budget changes, or other sensitive outbound writes must go through the relevant approval and tool-policy checks.
