import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "./prompts.js";

const mocks = vi.hoisted(() => ({
  probeGatewayReachable: vi.fn(),
  waitForGatewayReachable: vi.fn(),
  resolveControlUiLinks: vi.fn(),
  healthCommand: vi.fn(),
  ensureControlUiAssetsBuilt: vi.fn(),
  setupWizardShellCompletion: vi.fn(),
}));

vi.mock("../commands/onboard-helpers.js", () => ({
  detectBrowserOpenSupport: vi.fn(async () => ({ ok: false })),
  formatControlUiSshHint: vi.fn(() => "ssh hint"),
  openUrl: vi.fn(async () => false),
  probeGatewayReachable: mocks.probeGatewayReachable,
  resolveControlUiLinks: mocks.resolveControlUiLinks,
  waitForGatewayReachable: mocks.waitForGatewayReachable,
}));

vi.mock("../commands/health.js", () => ({
  healthCommand: mocks.healthCommand,
}));

vi.mock("../infra/control-ui-assets.js", () => ({
  ensureControlUiAssetsBuilt: mocks.ensureControlUiAssetsBuilt,
}));

vi.mock("./setup.completion.js", () => ({
  setupWizardShellCompletion: mocks.setupWizardShellCompletion,
}));

vi.mock("../tui/tui.js", () => ({
  runTui: vi.fn(),
}));

vi.mock("../daemon/service.js", () => ({
  describeGatewayServiceRestart: vi.fn(() => ({
    progressMessage: "Gateway service restarted.",
    scheduled: false,
  })),
  resolveGatewayService: vi.fn(() => ({
    isLoaded: vi.fn(async () => false),
    install: vi.fn(async () => {}),
    restart: vi.fn(async () => ({})),
    uninstall: vi.fn(async () => {}),
  })),
}));

vi.mock("../daemon/systemd.js", () => ({
  isSystemdUserServiceAvailable: vi.fn(async () => true),
}));

vi.mock("../commands/daemon-install-helpers.js", () => ({
  buildGatewayInstallPlan: vi.fn(),
  gatewayInstallErrorHint: vi.fn(() => "install hint"),
}));

vi.mock("../commands/gateway-install-token.js", () => ({
  resolveGatewayInstallToken: vi.fn(async () => ({ warnings: [] })),
}));

function createRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn() as unknown as RuntimeEnv["exit"],
  };
}

function createPrompter(confirmValue: boolean): WizardPrompter {
  return {
    intro: vi.fn(async () => {}),
    outro: vi.fn(async () => {}),
    note: vi.fn(async () => {}),
    select: vi.fn(async ({ initialValue, options }) => initialValue ?? options[0]?.value),
    multiselect: vi.fn(async () => []),
    text: vi.fn(async () => ""),
    confirm: vi.fn(async () => confirmValue),
    progress: vi.fn(() => ({ update: vi.fn(), stop: vi.fn() })),
  } as WizardPrompter;
}

describe("finalizeSetupWizard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses one fast gateway probe when service install is skipped", async () => {
    mocks.resolveControlUiLinks.mockReturnValue({
      httpUrl: "http://127.0.0.1:18789/",
      wsUrl: "ws://127.0.0.1:18789",
    });
    mocks.probeGatewayReachable.mockResolvedValue({ ok: false, detail: "ECONNREFUSED" });
    mocks.ensureControlUiAssetsBuilt.mockResolvedValue({ ok: true, built: false });
    const prompter = createPrompter(false);

    const { finalizeSetupWizard } = await import("./setup.finalize.js");

    await finalizeSetupWizard({
      flow: "advanced",
      opts: { skipUi: true } as never,
      baseConfig: {},
      nextConfig: {},
      workspaceDir: "/tmp/foxfang-workspace",
      settings: {
        port: 18789,
        bind: "loopback",
        authMode: "token",
        gatewayToken: "test-token",
        tailscaleMode: "off",
        tailscaleResetOnExit: false,
      },
      prompter,
      runtime: createRuntime(),
    });

    expect(prompter.confirm).toHaveBeenCalledWith({
      message: "Install Gateway service (recommended)",
      initialValue: true,
    });
    expect(mocks.waitForGatewayReachable).not.toHaveBeenCalled();
    expect(mocks.probeGatewayReachable).toHaveBeenCalledTimes(1);
    expect(mocks.probeGatewayReachable).toHaveBeenCalledWith({
      url: "ws://127.0.0.1:18789",
      token: "test-token",
      timeoutMs: 400,
    });
    expect(mocks.ensureControlUiAssetsBuilt).not.toHaveBeenCalled();
    expect(mocks.healthCommand).not.toHaveBeenCalled();
    const noteTitles = (prompter.note as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[1],
    );
    expect(noteTitles).not.toContain("Workspace backup");
    expect(noteTitles).not.toContain("Security");
    expect(noteTitles).not.toContain("Web search");
    expect(noteTitles).not.toContain("What now");
  });
});
