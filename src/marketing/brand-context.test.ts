import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { brandContextRequired, resolveBrandContextBlock } from "./brand-context.js";
import { loadMarketingStore, upsertBrand } from "./store.js";
import type { Brand } from "./types.js";

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  const now = new Date().toISOString();
  return {
    id: "brand-ctx-1",
    createdAt: now,
    updatedAt: now,
    name: "Acme",
    voice: "warm",
    positioning: "daily nutrition",
    audience: "young families",
    guardrails: ["do not auto-publish"],
    messagingPillars: ["trust", "origin"],
    ...overrides,
  };
}

describe("marketing brand-context", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("returns null when no brandId is configured", async () => {
    const block = await resolveBrandContextBlock({});
    expect(block).toBeNull();
  });

  it("prefers config brandKitPath over the marketing store", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-bctx-ws-"));
    tempDirs.push(workspace);
    const kitPath = path.join(workspace, "BRAND.md");
    await fs.writeFile(kitPath, "# Custom kit\nvoice: bold", "utf8");

    const block = await resolveBrandContextBlock({
      config: {
        marketing: {
          brandKitPath: "BRAND.md",
        },
      } as never,
      brandId: "brand-ctx-1",
      workspaceDir: workspace,
    });

    expect(block?.source).toBe("config-path");
    expect(block?.markdown).toContain("Custom kit");
  });

  it("falls back to brand.kit.md under stateDir when config path is missing", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-bctx-"));
    tempDirs.push(stateDir);
    const kitDir = path.join(stateDir, "marketing", "brands");
    await fs.mkdir(kitDir, { recursive: true });
    await fs.writeFile(path.join(kitDir, "brand-ctx-1.md"), "# Kit File\nvoice: calm", "utf8");

    const block = await resolveBrandContextBlock({ brandId: "brand-ctx-1", stateDir });
    expect(block?.source).toBe("brand.kit.md");
    expect(block?.markdown).toContain("Kit File");
  });

  it("formats brand from the marketing store when no kit file exists", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-bctx-store-"));
    tempDirs.push(stateDir);
    await upsertBrand(makeBrand(), stateDir);

    const block = await resolveBrandContextBlock({ brandId: "brand-ctx-1", stateDir });
    expect(block?.source).toBe("store");
    expect(block?.markdown).toContain("# Brand: Acme");
    expect(block?.markdown).toContain("Voice");
    expect(block?.markdown).toContain("Guardrails");
    expect(block?.markdown).toContain("do not auto-publish");
  });

  it("returns null when the brandId is not in the store and no kit file exists", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-bctx-empty-"));
    tempDirs.push(stateDir);
    const block = await resolveBrandContextBlock({ brandId: "missing", stateDir });
    expect(block).toBeNull();
  });

  it("reads defaultBrandId from config when brandId is not provided", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-bctx-cfg-"));
    tempDirs.push(stateDir);
    await upsertBrand(makeBrand({ id: "default-brand" }), stateDir);

    const block = await resolveBrandContextBlock({
      stateDir,
      config: { marketing: { defaultBrandId: "default-brand" } } as never,
    });
    expect(block?.brandId).toBe("default-brand");
    expect(block?.source).toBe("store");
  });

  it("omits optional sections when fields are missing in the store", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-bctx-min-"));
    tempDirs.push(stateDir);
    await upsertBrand(
      makeBrand({
        voice: undefined,
        positioning: undefined,
        audience: undefined,
        guardrails: undefined,
        messagingPillars: undefined,
      }),
      stateDir,
    );

    const block = await resolveBrandContextBlock({ brandId: "brand-ctx-1", stateDir });
    expect(block?.markdown).toContain("# Brand: Acme");
    expect(block?.markdown).not.toContain("## Voice");
    expect(block?.markdown).not.toContain("## Guardrails");
  });

  it("exposes a brandContextRequired helper that mirrors config flag", () => {
    expect(brandContextRequired(undefined)).toBe(false);
    expect(brandContextRequired({ marketing: { requireBrandContext: true } } as never)).toBe(true);
    expect(brandContextRequired({ marketing: { requireBrandContext: false } } as never)).toBe(
      false,
    );
  });
});
