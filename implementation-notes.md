# Implementation Notes

## 2026-06-08 - Onboard startup optimization

- Task: investigate and optimize why `pnpm foxfang onboard` takes a long time to reach the first setup prompt.
- Initial assumption: the visible delay happens during CLI/onboard startup before user input, so I will measure the real runtime path before changing code.
- Constraint: keep changes surgical and avoid changing onboarding choices or user-facing behavior unless the measured bottleneck requires it.

- Baseline measurement: using a pseudo-TTY, `pnpm foxfang onboard --flow quickstart` took about 12 seconds before the banner/intro appeared and still had not reached the next prompt after 30 seconds. This means there are likely two startup costs: general CLI module loading before `runSetupWizard`, then setup-specific work after `FoxFang setup`.
- I will use temporary, clearly tagged timing probes and remove them before finishing.

- First optimization decision: change `register.onboard` to lazy-import `setupWizardCommand` inside the Commander action instead of at module load. This keeps CLI help/options unchanged while avoiding loading the full onboarding implementation during command registration.
- Measurement after the first patch: importing the built `register.onboard` chunk still took about 12.7 seconds. The remaining cost is not `setupWizardCommand`; it is module-load work in command registration, especially auth-choice/provider flag metadata loaded before the action runs.
- Second optimization decision: lazy-import `runCommandWithRuntime` in the onboard action because the current static import comes from a large runtime/auth-profiles chunk. This keeps error handling behavior once the action runs, but avoids paying that module cost while merely registering the command.
- Third optimization decision: split onboard CLI help generation into `auth-choice-help.ts`, which uses manifest metadata only. The broader `auth-choice-options.ts` still supports the interactive picker with runtime fallback providers, but command registration no longer imports that heavier path.
- Fourth optimization decision: import `normalizeProviderIdForAuth` from the small `agents/provider-id.ts` helper in `provider-auth-choices.ts` instead of `agents/model-selection.ts`, because provider auth metadata does not need model selection runtime.
- Fifth optimization decision: remove the deep plugin compatibility scan from the beginning of `runSetupWizard`. That scan loads plugin runtime and can block the first prompt for tens of seconds on configured installs; compatibility review remains available through `foxfang doctor` and `foxfang plugins inspect --all`.

## 2026-06-09 - Onboard finalize delay after Hooks

- New symptom: after the Hooks section, choosing `No` for `Install Gateway service (recommended)` appears to hang.
- Initial source finding: `finalizeSetupWizard` still calls `waitForGatewayReachable` with a 15 second deadline even when Gateway service install is skipped, so a no-install path can look frozen while it probes for a gateway that is not expected to exist.
- Fix: when Gateway service install is skipped, use a single fast gateway probe instead of the 15 second `waitForGatewayReachable` loop. The 15 second wait remains only for install/restart paths where a service may legitimately take time to come up.
- Tradeoff: a manually started gateway that takes more than ~750ms to answer immediately after setup may be shown as not detected, but the no-service path already tells users to start `foxfang gateway run`; avoiding a perceived hang is more important here.

- Regression coverage: added `src/wizard/setup.finalize.test.ts` to lock the no-service path to one fast probe and ensure it does not call the 15 second wait loop.

## 2026-06-09 - Manual foreground gateway clarification

- User intent: run/start FoxFang manually in the terminal and stop with Ctrl+C, without installing the Gateway service.
- Source/runtime finding: `foxfang daemon start` is a service-control command. On macOS it starts/restarts the LaunchAgent (`ai.foxfang.gateway`), so it is the wrong command for foreground control.
- Correct command for foreground control is `foxfang gateway run`; if an existing LaunchAgent is already listening on the configured port, stop/uninstall that service first or choose another port.

## 2026-06-09 - NVIDIA provider smoke script

- Added a direct NVIDIA provider smoke script for manual credential/API validation before wiring the provider through FoxFang runtime.
- Decision: keep the script standalone and key-driven via `NVIDIA_API_KEY`; it does not read or write FoxFang config and never prints the key.
- Tradeoff: this validates NVIDIA's OpenAI-compatible `/chat/completions` endpoint, not the full FoxFang agent loop. Use it first to isolate API key/model/base-url issues.

## 2026-06-09 - NVIDIA NIM dynamic catalog and reasoning effort

- User validated `nvidia/nemotron-3-ultra-550b-a55b` directly against `https://integrate.api.nvidia.com/v1` with a 200 response, so the provider fix targets NVIDIA NIM compatibility rather than key/network setup.
- Changed the NVIDIA provider from a tiny static catalog only to a catalog that calls `https://integrate.api.nvidia.com/v1/models` when `NVIDIA_API_KEY` is available, with a static fallback for offline/help paths.
- Added static forward-compat rows for known NVIDIA NIM reasoning families (Nemotron 3, Kimi K2 Thinking, Qwen3 thinking, DeepSeek V3.x) so model selection can work even before a live catalog refresh.
- Added a NVIDIA stream wrapper that injects `reasoning_effort` for NVIDIA-hosted reasoning models; this fixes the prior behavior where reasoning models stayed in non-think mode because the OpenAI-compatible payload never carried the NIM reasoning control.
- Tradeoff: `/v1/models` response fields are parsed defensively because NVIDIA may vary metadata names; unknown models still default to text-only, zero cost, and conservative token windows unless the API reports better limits.
- Updated `scripts/test-nvidia-provider.mjs` with `--list-models` so users can inspect the live NVIDIA NIM catalog with their own key without printing secrets.
- Smoke script also accepts `--reasoning-effort <level>` so NVIDIA NIM reasoning mode can be validated directly outside FoxFang.
