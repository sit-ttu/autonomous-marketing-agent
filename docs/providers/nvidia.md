---
summary: "Use NVIDIA's OpenAI-compatible API in FoxFang"
read_when:
  - You want to use NVIDIA models in FoxFang
  - You need NVIDIA_API_KEY setup
title: "NVIDIA"
---

# NVIDIA

NVIDIA provides an OpenAI-compatible NIM API at `https://integrate.api.nvidia.com/v1` for models listed on NVIDIA Build. Authenticate with an API key from NVIDIA Build/NGC.

## CLI setup

Export the key once, then run onboarding and set an NVIDIA model:

```bash
export NVIDIA_API_KEY="nvapi-..."
foxfang onboard --auth-choice nvidia-api-key
foxfang models set nvidia/nvidia/nemotron-3-ultra-550b-a55b
```

If you still pass `--token`, remember it lands in shell history and `ps` output; prefer the env var when possible.

## Config snippet

```json5
{
  env: { NVIDIA_API_KEY: "nvapi-..." },
  models: {
    providers: {
      nvidia: {
        baseUrl: "https://integrate.api.nvidia.com/v1",
        api: "openai-completions",
      },
    },
  },
  agents: {
    defaults: {
      model: { primary: "nvidia/nvidia/nemotron-3-ultra-550b-a55b" },
    },
  },
}
```

## Model IDs

When `NVIDIA_API_KEY` is available, FoxFang loads the live model list from:

```text
https://integrate.api.nvidia.com/v1/models
```

Static fallback examples include:

- `nvidia/nemotron-3-ultra-550b-a55b` (reasoning)
- `nvidia/nemotron-3-nano-30b-a3b` (reasoning)
- `moonshotai/kimi-k2-thinking` (reasoning)
- `qwen/qwen3-next-80b-a3b-thinking` (reasoning)
- `deepseek-ai/deepseek-v3.2` (reasoning)
- `nvidia/llama-3.1-nemotron-70b-instruct`
- `meta/llama-3.3-70b-instruct`
- `nvidia/mistral-nemo-minitron-8b-8k-instruct`

Use the smoke script to inspect your live catalog:

```bash
NVIDIA_API_KEY="nvapi-..." pnpm test:provider:nvidia -- --list-models
```

## Reasoning models

NVIDIA NIM reasoning models use the OpenAI-compatible `reasoning_effort` request field. FoxFang injects this field for NVIDIA-hosted reasoning model families such as Nemotron 3, Kimi K2 Thinking, Qwen3 thinking, and DeepSeek V3.x so they do not stay in non-think mode.

Direct smoke test:

```bash
NVIDIA_API_KEY="nvapi-..." pnpm test:provider:nvidia -- \
  --model nvidia/nemotron-3-ultra-550b-a55b \
  --reasoning-effort high \
  --prompt "Reply with OK"
```

## Notes

- OpenAI-compatible `/v1` endpoint; use an API key from NVIDIA Build/NGC.
- Provider auto-enables when `NVIDIA_API_KEY` is set and falls back to static model rows if the live `/models` request is unavailable.
