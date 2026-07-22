# FoxFang - Autonomous Agent System for Digital Marketing Operations

FoxFang is a specialized autonomous agent system for supporting digital marketing operations. It is built on an existing agent platform and adapted for marketing workflows where individuals, creators, small businesses, and lean teams need help with repeated planning, drafting, scheduling, reporting, and coordination tasks.

FoxFang is not a complete marketing platform that replaces human judgment. It is also not a one-shot copywriting chatbot. The current system is best understood as a controlled agent runtime with memory, sessions, tools, scheduling, channels, and a marketing tool layer that helps users prepare work, create drafts, summarize information, and keep important outbound actions under human approval.

## Scope

The implemented system focuses on foundational marketing-operations support:

- analyze marketing requests and turn vague asks into clearer briefs;
- support market, competitor, and audience research at an assistive level;
- create communication plans and content plans from a campaign brief;
- generate marketing drafts and adapt content for different channels;
- schedule recurring tasks such as reminders, checks, or reports;
- generate summaries and reports from provided or available data;
- coordinate work through CLI, gateway, and configured messaging channels;
- preserve context through workspace files, session transcripts, and memory search;
- keep sensitive write actions behind explicit review and approval.

The project is evaluated through simulated usage scenarios and functional test cases. It does not claim long-term business impact such as higher revenue, lower ad cost, or improved conversion rates without real campaign data and controlled measurement.

## Core workflow

Marketing work starts from a brief rather than a single isolated prompt. FoxFang is designed around this controlled operations loop:

```text
Brief -> Strategy -> Plan -> Create -> Approve -> Publish -> Measure -> Learn -> Optimize
```

| Stage    | Current role in FoxFang                                                                         |
| -------- | ----------------------------------------------------------------------------------------------- |
| Brief    | Receive campaign requirements, product context, audience, constraints, and missing information. |
| Strategy | Help reason about positioning, audience, message direction, and channel fit.                    |
| Plan     | Produce content plans, task lists, schedules, and campaign outlines.                            |
| Create   | Generate draft posts, scripts, captions, FAQs, report text, and follow-up messages.             |
| Approve  | Require human review before sensitive outbound actions.                                         |
| Publish  | Support scheduling or sending only through configured tools and approval gates.                 |
| Measure  | Summarize provided metrics or read-only data when available.                                    |
| Learn    | Store reusable notes, decisions, and insights in memory/workspace state.                        |
| Optimize | Suggest improvements for later cycles based on available context and results.                   |

## Safety model

FoxFang follows this product rule:

```text
read-first, draft-first, approval-before-write
```

The agent may read context, create drafts, build plans, summarize data, and recommend next steps. Actions that can affect external systems must remain controlled by the user.

| Action                                  | Approval required                  |
| --------------------------------------- | ---------------------------------- |
| Generate ideas, plans, or drafts        | No                                 |
| Summarize reports or provided metrics   | No                                 |
| Search/read configured data sources     | Usually no, subject to tool policy |
| Schedule or publish social posts        | Yes                                |
| Send bulk or targeted outbound messages | Yes                                |
| Publish or modify ads                   | Yes                                |
| Change ad budget or targeting           | Yes                                |
| Enable, disable, or mutate campaigns    | Yes                                |

In the current source, the marketing layer is implemented primarily as a draft, approval, scheduling, and guarded outbound workflow. Future publishing or ad-management integrations must preserve the same approval-before-write rule.

## Architecture overview

FoxFang is organized into five practical layers.

```text
Client surfaces
-> Gateway runtime
-> Agent command boundary
-> Execution backends and capability layer
-> Storage and memory
```

### Client surfaces

Users and integrations can reach the system through the CLI, the Control UI, paired nodes, or configured messaging channels.

### Gateway runtime

The gateway accepts HTTP/WebSocket traffic, manages channel integrations, applies scopes and pairing rules, tracks run state, handles cron scheduling, and dispatches agent requests into the agent command boundary.

### Agent command boundary

Agent turns enter through either:

- `agentCommandFromIngress` for gateway/network-originated requests with explicit trust and model-override flags; or
- `agentCommand` for trusted local/CLI execution.

This boundary resolves configuration, workspace, session, skills, model defaults, and delivery behavior before choosing an execution path.

### Execution backends

FoxFang can run an agent turn through different backends depending on configuration:

- Agent Control Protocol (ACP) sessions;
- an external CLI backend provider;
- the embedded Pi agent runtime.

The embedded runtime assembles tools, applies tool policy, loads context, handles model calls, supports compaction/retry behavior, and persists session output.

### Capability layer

Capabilities come from core tools and plugins. They include model providers, media providers, channel tools, memory tools, scheduler tools, session/subagent tools, marketing tools, and plugin-provided tools. Tool policy filters what is actually available in a run.

### Storage layer

The system stores state locally by default:

- configuration in JSON/JSON5;
- session metadata in JSON;
- session transcripts and run logs in JSONL;
- workspace memory in Markdown files;
- memory search indexes in SQLite;
- cron jobs and cron run history;
- credentials and SecretRefs;
- marketing store data such as brands, products, campaigns, drafts, approvals, insights, and leads.

## Marketing data model

FoxFang treats marketing work as stateful operations, not disconnected chat messages. The main domain objects are:

| Object      | Purpose                                                     |
| ----------- | ----------------------------------------------------------- |
| Brand       | Voice, positioning, audience, values, and guardrails.       |
| Product     | Features, benefits, FAQs, pricing, and objections.          |
| Campaign    | Campaign brief, channels, timeline, objectives, and KPIs.   |
| ContentPlan | Calendar or plan for content production and review.         |
| PostDraft   | Channel-specific draft with lifecycle state.                |
| Approval    | Review state for sensitive outbound actions.                |
| Insight     | Reusable learning from previous work.                       |
| Lead        | Potential customer/contact information and follow-up notes. |

Some of these objects are already represented in the marketing store and tools; others remain expansion surfaces for deeper product, analytics, CRM, and campaign-management workflows.

## What FoxFang is not

FoxFang should not be described as:

- a fully autonomous system that publishes or changes budgets without review;
- a complete replacement for a marketing department;
- a single generic chatbot with a marketing label;
- a fixed automation pipeline where every step is predetermined;
- a finished ads optimization platform.

A more accurate description is:

> FoxFang is a marketing operations agent: a context-aware, tool-connected, extensible agent system that helps small teams prepare marketing work, generate drafts, schedule tasks, produce reports, remember useful context, and keep humans in control of sensitive outbound actions.

## Installation for local development

Runtime baseline: Node.js 22+.

```bash
git clone https://github.com/PotLock/foxfang.git
cd foxfang
pnpm install
pnpm build
pnpm foxfang onboard
```

## Quick start

```bash
# Run onboarding for gateway, workspace, providers, and skills
pnpm foxfang onboard

# Start the gateway for Control UI, channels, cron, and remote requests
pnpm foxfang gateway run

# Run one agent turn through the gateway
pnpm foxfang agent --message "Create a 14-day content plan for a new coffee product"

# Run the embedded local agent path instead of the gateway path
pnpm foxfang agent --local --message "Draft three Facebook post ideas for this campaign"

# Check configured channels and recent session recipients
pnpm foxfang status

# Inspect stored sessions
pnpm foxfang sessions

# Manage scheduled jobs
pnpm foxfang cron list
```

## Example workflow

A user can provide a campaign brief such as:

```text
We are launching a new coffee product for office workers.
Audience: people who need convenient morning coffee.
Channels: Facebook and TikTok.
Tone: friendly, practical, not too sales-heavy.
Goal: introduce the product and collect interest during the first two weeks.
```

FoxFang can then help with:

1. clarifying missing campaign information;
2. identifying likely audience pain points;
3. proposing message direction and content pillars;
4. creating a 14-day content plan;
5. drafting channel-specific posts or scripts;
6. preparing review tasks or scheduled reminders;
7. summarizing results from provided metrics;
8. storing reusable brand or campaign notes for later turns.

It should not publish the posts, send bulk messages, or change advertising settings unless the relevant integration is configured and the required human approval has been recorded.

## Main CLI surfaces

| Command             | Purpose                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `foxfang onboard`   | Interactive onboarding for gateway, workspace, and skills.                       |
| `foxfang configure` | Configure credentials, channels, gateway, and agent defaults.                    |
| `foxfang agent`     | Run one agent turn through the Gateway, or use `--local` for embedded execution. |
| `foxfang agents`    | Manage isolated agents, workspaces, identities, and routing bindings.            |
| `foxfang gateway`   | Run, inspect, and query the WebSocket Gateway.                                   |
| `foxfang channels`  | Manage connected chat channels.                                                  |
| `foxfang message`   | Send, read, and manage channel messages through configured providers.            |
| `foxfang cron`      | Manage scheduled jobs through the Gateway scheduler.                             |
| `foxfang sessions`  | List stored conversation sessions.                                               |
| `foxfang models`    | Discover, scan, and configure model providers.                                   |
| `foxfang plugins`   | Manage FoxFang plugins and extensions.                                           |
| `foxfang status`    | Show channel health and recent session recipients.                               |
| `foxfang doctor`    | Run health checks and quick fixes for gateway and channels.                      |

For CLI help, run:

```bash
pnpm foxfang --help
pnpm foxfang agent --help
pnpm foxfang agents --help
```

## Development commands

```bash
pnpm install
pnpm build
pnpm check
pnpm test
```

Use scoped tests when changing a narrow surface, and run the broader gate when touching build output, published surfaces, plugin boundaries, or runtime architecture.

## Repository map

```text
src/
  agents/          Agent command boundary, backend selection, embedded runtime, tools.
  gateway/         HTTP/WebSocket gateway, method handlers, channel lifecycle, cron runtime.
  cli/             CLI registration and command wiring.
  commands/        Command implementations for agent, agents, status, channels, doctor, etc.
  marketing/       Marketing store, post draft operations, approval gates, outbound guards.
  cron/            Scheduled job store, scheduler service, cron run logs.
  channels/        Channel registry and shared channel abstractions.
  config/          Config paths, schema, session stores, and state management.
  context-engine/  Context engine registry and default legacy implementation.
extensions/
  */               Workspace plugins, channel plugins, memory plugin, providers, and tools.
docs/
  */               Mintlify documentation.
latex/
  */               Thesis source, figures, and generated PDF artifacts.
```

## Roadmap

Future work should be treated as planned expansion unless the corresponding integration and approval gate are implemented and tested:

- deeper campaign object lifecycle and campaign status tracking;
- content calendar UI and approval history;
- read-only ads metrics integrations;
- social publishing after explicit approval;
- KPI dashboard and longer-term reporting;
- CRM lead scoring and follow-up workflows;
- A/B testing planner;
- brand compliance reviewer;
- budget guardrails for paid ads;
- stronger learning loop from real campaign data.

## License

MIT
