import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const readCliBannerTaglineModeMock = vi.fn();

vi.mock("./banner-config-lite.js", () => ({
  readCliBannerTaglineMode: readCliBannerTaglineModeMock,
}));

let formatCliBannerLine: typeof import("./banner.js").formatCliBannerLine;
let formatCliBannerArt: typeof import("./banner.js").formatCliBannerArt;

beforeAll(async () => {
  ({ formatCliBannerLine, formatCliBannerArt } = await import("./banner.js"));
});

beforeEach(() => {
  readCliBannerTaglineModeMock.mockReset();
  readCliBannerTaglineModeMock.mockReturnValue(undefined);
});

describe("formatCliBannerLine", () => {
  it("hides tagline text when cli.banner.taglineMode is off", () => {
    readCliBannerTaglineModeMock.mockReturnValue("off");

    const line = formatCliBannerLine("2026.3.7", {
      commit: "abc1234",
      richTty: false,
    });

    expect(line).toBe("🦊 FoxFang 2026.3.7 (abc1234)");
  });

  it("uses default tagline when cli.banner.taglineMode is default", () => {
    readCliBannerTaglineModeMock.mockReturnValue("default");

    const line = formatCliBannerLine("2026.3.7", {
      commit: "abc1234",
      richTty: false,
    });

    expect(line).toBe("🦊 FoxFang 2026.3.7 (abc1234) — All your chats, one FoxFang.");
  });

  it("renders FOXFANG ASCII art without color when rich TTY is off", () => {
    const art = formatCliBannerArt({ richTty: false });

    expect(art).toContain("_____ _____");
    expect(art).toContain("\\____|");
    expect(art).not.toMatch(/\u001b\[/);
  });

  it("prefers explicit tagline mode over config", () => {
    readCliBannerTaglineModeMock.mockReturnValue("off");

    const line = formatCliBannerLine("2026.3.7", {
      commit: "abc1234",
      richTty: false,
      mode: "default",
    });

    expect(line).toBe("🦊 FoxFang 2026.3.7 (abc1234) — All your chats, one FoxFang.");
  });
});
