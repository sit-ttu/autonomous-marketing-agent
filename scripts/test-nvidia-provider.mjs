#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct";
const DEFAULT_PROMPT = "Reply with exactly: NVIDIA_PROVIDER_OK";

function printHelp() {
  console.log(`Usage: NVIDIA_API_KEY=nvapi-... node scripts/test-nvidia-provider.mjs [options]

Smoke-test NVIDIA's OpenAI-compatible chat completions endpoint.

Options:
  --model <id>       NVIDIA model id (default: ${DEFAULT_MODEL})
  --prompt <text>    User prompt (default: ${DEFAULT_PROMPT})
  --base-url <url>   API base URL (default: ${DEFAULT_BASE_URL})
  --timeout <ms>     Request timeout in milliseconds (default: 30000)
  --max-tokens <n>   max_tokens for the response (default: 128)
  --reasoning-effort <level>
                     Optional NIM reasoning_effort value
  --list-models      List model ids from /v1/models instead of sending chat
  --help             Show this help

Examples:
  NVIDIA_API_KEY=nvapi-... node scripts/test-nvidia-provider.mjs
  NVIDIA_API_KEY=nvapi-... node scripts/test-nvidia-provider.mjs --model meta/llama-3.3-70b-instruct
  NVIDIA_API_KEY=nvapi-... node scripts/test-nvidia-provider.mjs --model nvidia/nemotron-3-ultra-550b-a55b --reasoning-effort high
  NVIDIA_API_KEY=nvapi-... node scripts/test-nvidia-provider.mjs --list-models
`);
}

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function readIntArg(name, fallback) {
  const raw = readArg(name, String(fallback));
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${raw}`);
  }
  return Math.floor(value);
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing NVIDIA_API_KEY. Export it first: export NVIDIA_API_KEY=nvapi-...");
  }

  const baseUrl = readArg("--base-url", process.env.NVIDIA_BASE_URL || DEFAULT_BASE_URL);
  const model = readArg("--model", process.env.NVIDIA_MODEL || DEFAULT_MODEL);
  const prompt = readArg("--prompt", DEFAULT_PROMPT);
  const timeoutMs = readIntArg("--timeout", 30_000);
  const maxTokens = readIntArg("--max-tokens", 128);
  const reasoningEffort = readArg("--reasoning-effort", process.env.NVIDIA_REASONING_EFFORT || "");
  const listModels = process.argv.includes("--list-models");
  const url = joinUrl(baseUrl, listModels ? "/models" : "/chat/completions");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: listModels ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: listModels
        ? undefined
        : JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            max_tokens: maxTokens,
            ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
            stream: false,
          }),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      console.error("NVIDIA provider smoke test failed.");
      console.error(
        JSON.stringify(
          { status: response.status, statusText: response.statusText, payload },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }

    const content = payload?.choices?.[0]?.message?.content ?? "";
    console.log("NVIDIA provider smoke test passed.");
    console.log(
      JSON.stringify(
        {
          model,
          baseUrl,
          status: response.status,
          durationMs: Date.now() - startedAt,
          ...(reasoningEffort ? { reasoningEffort } : {}),
          response: content,
        },
        null,
        2,
      ),
    );
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
