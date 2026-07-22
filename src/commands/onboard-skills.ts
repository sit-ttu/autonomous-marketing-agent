import fs from "node:fs";
import path from "node:path";
import { resolveBundledSkillsDir } from "../agents/skills/bundled-dir.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { FoxFangConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import { CONFIG_DIR, ensureDir } from "../utils.js";
import type { WizardPrompter } from "../wizard/prompts.js";

export type SeedBundledSkillsResult = {
  copied: string[];
  skipped: string[];
  sourceDir?: string;
  targetDir: string;
};

async function copyDirRecursive(source: string, target: string): Promise<void> {
  await fs.promises.cp(source, target, { recursive: true });
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Seed the managed skills directory (~/.foxfang/skills) with the default
 * bundled skills shipped with the FoxFang package. Existing entries are
 * never overwritten, so user customizations survive subsequent onboard runs.
 *
 * Returns the list of skills that were copied vs skipped.
 */
export async function seedBundledSkillsToManagedDir(params: {
  prompter?: WizardPrompter;
  runtime?: RuntimeEnv;
  managedDir?: string;
  sourceDir?: string;
  onlyNames?: ReadonlySet<string>;
}): Promise<SeedBundledSkillsResult> {
  const targetDir = params.managedDir ?? path.join(CONFIG_DIR, "skills");
  const sourceDir = params.sourceDir ?? resolveBundledSkillsDir();
  const copied: string[] = [];
  const skipped: string[] = [];

  if (!sourceDir) {
    if (params.runtime) {
      params.runtime.log("Bundled skills directory not found; skipping default skill seeding.");
    }
    return { copied, skipped, targetDir };
  }

  if (!(await pathExists(sourceDir))) {
    if (params.runtime) {
      params.runtime.log(
        `Bundled skills source missing (${sourceDir}); skipping default skill seeding.`,
      );
    }
    return { copied, skipped, targetDir };
  }

  await ensureDir(targetDir);

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
  } catch (err) {
    if (params.runtime) {
      params.runtime.log(`Failed to read bundled skills (${sourceDir}): ${String(err)}`);
    }
    return { copied, skipped, sourceDir, targetDir };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.startsWith(".")) {
      continue;
    }
    if (params.onlyNames && !params.onlyNames.has(entry.name)) {
      continue;
    }
    const src = path.join(sourceDir, entry.name);
    const srcSkill = path.join(src, "SKILL.md");
    if (!(await pathExists(srcSkill))) {
      continue;
    }
    const dest = path.join(targetDir, entry.name);
    if (await pathExists(dest)) {
      skipped.push(entry.name);
      continue;
    }
    try {
      await copyDirRecursive(src, dest);
      copied.push(entry.name);
    } catch (err) {
      if (params.runtime) {
        params.runtime.log(`Failed to seed bundled skill "${entry.name}": ${String(err)}`);
      }
      skipped.push(entry.name);
    }
  }

  if (params.prompter) {
    const lines: string[] = [];
    if (copied.length > 0) {
      lines.push(`Installed defaults: ${copied.join(", ")}`);
    }
    if (skipped.length > 0) {
      lines.push(`Already present (kept as-is): ${skipped.join(", ")}`);
    }
    if (lines.length > 0) {
      await params.prompter.note(lines.join("\n"), "Default skills");
    }
  }

  return { copied, skipped, sourceDir, targetDir };
}

export async function setupSkills(
  cfg: FoxFangConfig,
  _workspaceDir: string,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<FoxFangConfig> {
  const result = await seedBundledSkillsToManagedDir({
    prompter,
    runtime,
  });

  if (result.copied.length === 0 && result.skipped.length === 0) {
    await prompter.note(
      [
        "No bundled skills were detected on this install.",
        `Run \`${formatCliCommand("foxfang doctor")}\` to inspect skills state.`,
      ].join("\n"),
      "Default skills",
    );
  }

  return cfg;
}
