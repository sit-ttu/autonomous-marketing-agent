import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import type { FoxFangConfig } from "../config/types.js";
import { findBrand, loadMarketingStore } from "./store.js";
import type { Brand } from "./types.js";

export type BrandContextBlock = {
  brandId: string;
  markdown: string;
  source: "store" | "brand.kit.md" | "config-path";
};

function formatBrandFromStore(brand: Brand): string {
  const lines = [
    `# Brand: ${brand.name}`,
    brand.voice ? `\n## Voice\n${brand.voice}` : "",
    brand.positioning ? `\n## Positioning\n${brand.positioning}` : "",
    brand.audience ? `\n## Audience\n${brand.audience}` : "",
    brand.guardrails?.length
      ? `\n## Guardrails\n${brand.guardrails.map((g) => `- ${g}`).join("\n")}`
      : "",
    brand.messagingPillars?.length
      ? `\n## Messaging pillars\n${brand.messagingPillars.map((p) => `- ${p}`).join("\n")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

async function readBrandKitFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function resolveBrandContextBlock(params: {
  config?: FoxFangConfig;
  brandId?: string;
  workspaceDir?: string;
  stateDir?: string;
}): Promise<BrandContextBlock | null> {
  const brandId = params.brandId ?? params.config?.marketing?.defaultBrandId;
  if (!brandId) {
    return null;
  }

  const configPath = params.config?.marketing?.brandKitPath;
  if (configPath && params.workspaceDir) {
    const resolved = path.isAbsolute(configPath)
      ? configPath
      : path.join(params.workspaceDir, configPath);
    const markdown = await readBrandKitFile(resolved);
    if (markdown?.trim()) {
      return { brandId, markdown: markdown.trim(), source: "config-path" };
    }
  }

  const stateDir = params.stateDir ?? resolveStateDir();
  const brandFile = path.join(stateDir, "marketing", "brands", `${brandId}.md`);
  const kitMarkdown = await readBrandKitFile(brandFile);
  if (kitMarkdown?.trim()) {
    return { brandId, markdown: kitMarkdown.trim(), source: "brand.kit.md" };
  }

  const store = await loadMarketingStore(stateDir);
  const brand = findBrand(store, brandId);
  if (!brand) {
    return null;
  }

  return {
    brandId,
    markdown: formatBrandFromStore(brand),
    source: "store",
  };
}

export function brandContextRequired(config?: FoxFangConfig): boolean {
  return config?.marketing?.requireBrandContext === true;
}
