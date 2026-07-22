import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_BRAND_FILENAME,
  DEFAULT_MEMORY_DIRNAME,
  DEFAULT_MEMORY_FILENAME,
  DEFAULT_PRODUCT_FILENAME,
  ensureAgentWorkspace,
} from "./workspace.js";

describe("ensureAgentWorkspace", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await fs.rm(dir, { recursive: true, force: true });
      }),
    );
  });

  it("creates memory scaffold when bootstrapping workspace", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-workspace-"));
    tempDirs.push(dir);

    await ensureAgentWorkspace({ dir, ensureBootstrapFiles: true });

    const memoryDir = path.join(dir, DEFAULT_MEMORY_DIRNAME);
    const memoryPath = path.join(dir, DEFAULT_MEMORY_FILENAME);
    const brandPath = path.join(dir, DEFAULT_BRAND_FILENAME);
    const productPath = path.join(dir, DEFAULT_PRODUCT_FILENAME);
    const agentsPath = path.join(dir, DEFAULT_AGENTS_FILENAME);

    const memoryDirStat = await fs.stat(memoryDir);
    expect(memoryDirStat.isDirectory()).toBe(true);
    const memoryContent = await fs.readFile(memoryPath, "utf-8");
    expect(memoryContent).toContain("Long-Term Memory");
    await expect(fs.readFile(brandPath, "utf-8")).resolves.toContain("BRAND");
    await expect(fs.readFile(productPath, "utf-8")).resolves.toContain("Product");
    await expect(fs.readFile(agentsPath, "utf-8")).resolves.toContain("AGENTS");
  });

  it("does not overwrite existing MEMORY.md", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-workspace-"));
    tempDirs.push(dir);
    const memoryPath = path.join(dir, DEFAULT_MEMORY_FILENAME);
    const existing = "# Existing memory\n\n- keep me\n";
    await fs.mkdir(path.join(dir, DEFAULT_MEMORY_DIRNAME), { recursive: true });
    await fs.writeFile(memoryPath, existing, "utf-8");

    await ensureAgentWorkspace({ dir, ensureBootstrapFiles: true });

    await expect(fs.readFile(memoryPath, "utf-8")).resolves.toBe(existing);
  });

  it("does not overwrite existing BRAND.md or PRODUCT.md", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "foxfang-workspace-"));
    tempDirs.push(dir);
    const brandPath = path.join(dir, DEFAULT_BRAND_FILENAME);
    const productPath = path.join(dir, DEFAULT_PRODUCT_FILENAME);
    const brandExisting = "# My brand\n\n- custom voice\n";
    const productExisting = "# My product\n\n- custom SKU\n";
    await fs.writeFile(brandPath, brandExisting, "utf-8");
    await fs.writeFile(productPath, productExisting, "utf-8");

    await ensureAgentWorkspace({ dir, ensureBootstrapFiles: true });

    await expect(fs.readFile(brandPath, "utf-8")).resolves.toBe(brandExisting);
    await expect(fs.readFile(productPath, "utf-8")).resolves.toBe(productExisting);
  });
});
