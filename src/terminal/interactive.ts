import { formatCliCommand } from "../cli/command-format.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";

export type InteractiveTerminalProbe = { ok: true } | { ok: false; reason: string };

export function isSetRawModeTerminalError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { code?: unknown; syscall?: unknown; message?: unknown };
  const code = typeof err.code === "string" ? err.code : "";
  const syscall = typeof err.syscall === "string" ? err.syscall : "";
  const message = typeof err.message === "string" ? err.message : "";
  if (syscall === "setRawMode" && (code === "EIO" || code === "EBADF")) {
    return true;
  }
  return /setRawMode/i.test(message) && /(?:EIO|EBADF)/i.test(message);
}

export function probeInteractiveTerminal(): InteractiveTerminalProbe {
  const stdin = process.stdin;
  const stdout = process.stdout;
  if (!stdin.isTTY || !stdout.isTTY) {
    return {
      ok: false,
      reason: "stdin and stdout must be attached to an interactive terminal (TTY)",
    };
  }
  if (typeof stdin.setRawMode !== "function") {
    return { ok: false, reason: "stdin does not support interactive raw mode" };
  }
  const wasRaw = typeof stdin.isRaw === "boolean" ? stdin.isRaw : false;
  try {
    stdin.setRawMode(true);
    stdin.setRawMode(wasRaw);
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `cannot enable raw terminal input (${detail})` };
  }
}

export function formatInteractiveTerminalRequiredMessage(probe: InteractiveTerminalProbe): string {
  const reason = probe.ok ? "" : probe.reason;
  return [
    "Interactive setup requires a real terminal (TTY).",
    reason ? `Reason: ${reason}` : "",
    "",
    "Try one of these:",
    "- Run in Terminal.app, iTerm, Windows Terminal, or another full TTY (not a piped/non-interactive session).",
    `- Or use non-interactive setup: ${formatCliCommand("foxfang onboard --non-interactive --mode local --auth-choice skip --gateway-port 18789 --gateway-bind loopback")}`,
    "",
    "Docs: https://docs.foxfang.ai/start/wizard-cli-automation",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function assertInteractiveTerminal(runtime: RuntimeEnv = defaultRuntime): void {
  const probe = probeInteractiveTerminal();
  if (probe.ok) {
    return;
  }
  runtime.error(formatInteractiveTerminalRequiredMessage(probe));
  runtime.exit(1);
}
