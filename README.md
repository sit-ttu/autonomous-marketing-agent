# 🦊 FoxFang — Marketing Operations Agent

<p align="center">
  <a href="https://github.com/sit-ttu/autonomous-marketing-agent/releases"><img src="https://img.shields.io/github/v/release/sit-ttu/autonomous-marketing-agent?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.com/invite/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**FoxFang** is a *specialized autonomous agent system for supporting digital marketing operations* — built on a general agent platform and adapted for the marketing use case. It helps individuals, creators, small businesses, and lean teams handle repeated marketing work: brief analysis, content planning, draft creation, channel adaptation, recurring reports, and team coordination.

It is not a one-shot copywriting chatbot and not fixed workflow automation. FoxFang keeps brand context, product intelligence, work history, and past insights across turns, uses tools and memory to plan and draft, and keeps sensitive outbound actions — publishing, bulk sends, ad/budget changes — under explicit human approval.

[Docs](https://docs.foxfang.ai) · [Getting Started](https://docs.foxfang.ai/start/getting-started) · [Onboarding](https://docs.foxfang.ai/start/wizard) · [Configuration](https://docs.foxfang.ai/gateway/configuration) · [Discord](https://discord.com/invite/clawd) · [Releases](https://github.com/sit-ttu/autonomous-marketing-agent/releases)

New here? Start with [Getting started](https://docs.foxfang.ai/start/getting-started).

## Install (recommended)

Runtime: **Node 22.14+**.

```bash
npm install -g foxfang@latest
# or: pnpm add -g foxfang@latest

foxfang onboard --install-daemon
```

FoxFang Onboard walks you through the gateway, workspace, model provider, and channels, and installs the Gateway as a background service so it stays running.

## Quick start

```bash
# Run onboarding for gateway, workspace, providers, and skills
foxfang onboard

# Start the gateway for the Control UI, channels, cron, and remote requests
foxfang gateway run

# Run one agent turn through the gateway
foxfang agent --message "Create a 14-day content plan for a new coffee product"

# Run the embedded local agent path instead of the gateway path
foxfang agent --local --message "Draft three Facebook post ideas for this campaign"

# Check configured channels and recent session recipients
foxfang status
```

## Core operations loop

Marketing work starts from a brief, not a single isolated prompt. FoxFang is built around this loop:

```text
Brief -> Strategy -> Plan -> Create -> Approve -> Publish -> Measure -> Learn -> Optimize
```

Every feature aligns with one or more stages: reasoning about brand/audience/positioning, building content plans and schedules, drafting channel-specific content, gating sensitive actions behind approval, and storing reusable insights for the next cycle.

## Approval defaults (read-first, draft-first, approval-before-write)

FoxFang can read context, create drafts, build plans, summarize data, and recommend next steps on its own. Anything that affects the outside world stays behind explicit approval.

| Action                                     | Approval required |
| ------------------------------------------- | ------------------ |
| Generate ideas, plans, or drafts            | No                  |
| Summarize reports or provided metrics       | No                  |
| Search/read configured data sources         | Usually no, subject to tool policy |
| Schedule or publish social posts            | Yes                 |
| Send bulk or targeted outbound messages     | Yes                 |
| Publish or modify ads                       | Yes                 |
| Change ad budget or targeting               | Yes                 |
| Enable, disable, or mutate campaigns        | Yes                 |

## Highlights

- **Marketing operations loop** — brief, strategy, plan, create, approve, publish, measure, learn, optimize as one connected process.
- **Draft & approval workflow** — post drafts, channel adaptation, and approval gates before anything goes out.
- **[Multi-channel delivery](https://docs.foxfang.ai/channels)** — WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Microsoft Teams, Matrix, and more, through the same gateway.
- **[Cron scheduling](https://docs.foxfang.ai/automation/cron-jobs)** — recurring reports, reminders, and checks.
- **[Workspace memory](https://docs.foxfang.ai/concepts/agent)** — brand, product, and campaign context persists across sessions instead of resetting every turn.
- **Marketing data objects** — brands, products, campaigns, content plans, post drafts, approvals, insights, and leads modeled explicitly, not flattened into chat text.
- **[Plugins & tool policy](https://docs.foxfang.ai/plugins/architecture)** — extend capabilities while keeping tool access filtered and scoped.

## What FoxFang is not

- Not a fully autonomous system that publishes or changes budgets without review.
- Not a complete replacement for a marketing department.
- Not a generic chatbot with a marketing label.
- Not fixed automation where every step is predetermined.
- Not a finished ads-optimization platform.

## Docs by goal

- New here: [Getting started](https://docs.foxfang.ai/start/getting-started), [Onboarding](https://docs.foxfang.ai/start/wizard), [Updating](https://docs.foxfang.ai/install/updating)
- Channel setup: [Channels index](https://docs.foxfang.ai/channels), [WhatsApp](https://docs.foxfang.ai/channels/whatsapp), [Telegram](https://docs.foxfang.ai/channels/telegram), [Discord](https://docs.foxfang.ai/channels/discord), [Slack](https://docs.foxfang.ai/channels/slack)
- Config + security: [Configuration](https://docs.foxfang.ai/gateway/configuration), [Security](https://docs.foxfang.ai/gateway/security), [Sandboxing](https://docs.foxfang.ai/gateway/sandboxing)
- Automation: [Cron jobs](https://docs.foxfang.ai/automation/cron-jobs), [Webhooks](https://docs.foxfang.ai/automation/webhook)
- Internals: [Architecture](https://docs.foxfang.ai/concepts/architecture), [Agent](https://docs.foxfang.ai/concepts/agent), [Plugins](https://docs.foxfang.ai/plugins/architecture)
- Troubleshooting: [Channel troubleshooting](https://docs.foxfang.ai/channels/troubleshooting), [Logging](https://docs.foxfang.ai/logging), [Docs home](https://docs.foxfang.ai)

## Main CLI surfaces

| Command             | Purpose                                                                          |
| -------------------- | --------------------------------------------------------------------------------- |
| `foxfang onboard`   | Interactive onboarding for gateway, workspace, and skills.                       |
| `foxfang configure` | Configure credentials, channels, gateway, and agent defaults.                    |
| `foxfang agent`     | Run one agent turn through the gateway, or use `--local` for embedded execution. |
| `foxfang agents`    | Manage isolated agents, workspaces, identities, and routing bindings.            |
| `foxfang gateway`   | Run, inspect, and query the gateway.                                             |
| `foxfang channels`  | Manage connected chat channels.                                                  |
| `foxfang cron`      | Manage scheduled jobs through the gateway scheduler.                             |
| `foxfang sessions`  | List stored conversation sessions.                                               |
| `foxfang models`    | Discover, scan, and configure model providers.                                   |
| `foxfang plugins`   | Manage FoxFang plugins and extensions.                                           |
| `foxfang status`    | Show channel health and recent session recipients.                              |
| `foxfang doctor`    | Run health checks and quick fixes for gateway and channels.                      |

For CLI help, run:

```bash
foxfang --help
foxfang agent --help
foxfang agents --help
```

## From source (development)

```bash
git clone https://github.com/sit-ttu/autonomous-marketing-agent.git
cd autonomous-marketing-agent

pnpm install
pnpm build
pnpm foxfang onboard
```

Dev loop:

```bash
pnpm check
pnpm test
```

Use scoped tests when changing a narrow surface, and run the broader gate (`pnpm check`, `pnpm test`, `pnpm build`) when touching build output, published surfaces, plugin boundaries, or runtime architecture.

## License

MIT
