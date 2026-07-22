#!/usr/bin/env tsx
/**
 * Copy bundled skills from <repo>/skills to <repo>/dist/skills
 * so that `resolveBundledSkillsDir` can find them when running from a built
 * distribution (npm global install, bun --compile, etc.).
 */

import fs from "node:fs";
import path from "node:path";
import { ensureDirectory, logVerboseCopy, resolveBuildCopyContext } from "./lib/copy-assets.ts";

const context = resolveBuildCopyContext(import.meta.url);

const srcSkills = path.join(context.projectRoot, "skills");
const distSkills = path.join(context.projectRoot, "dist", "skills");

function copyBundledSkills() {
  if (!fs.existsSync(srcSkills)) {
    console.warn(`${context.prefix} Source directory not found:`, srcSkills);
    return;
  }

  ensureDirectory(distSkills);

  const entries = fs.readdirSync(srcSkills, { withFileTypes: true });
  let copiedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.startsWith(".")) {
      continue;
    }
    const srcDir = path.join(srcSkills, entry.name);
    const srcSkill = path.join(srcDir, "SKILL.md");
    if (!fs.existsSync(srcSkill)) {
      continue;
    }
    const destDir = path.join(distSkills, entry.name);
    fs.cpSync(srcDir, destDir, { recursive: true, force: false });
    copiedCount += 1;
    logVerboseCopy(context, `Copied ${entry.name}/`);
  }

  for (const entry of fs.readdirSync(distSkills, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }
    const srcDir = path.join(srcSkills, entry.name);
    if (!fs.existsSync(srcDir)) {
      fs.rmSync(path.join(distSkills, entry.name), { recursive: true, force: true });
      skippedCount += 1;
      logVerboseCopy(context, `Removed stale ${entry.name}/`);
    }
  }

  console.log(`${context.prefix} Copied ${copiedCount} bundled skills.`);
  if (skippedCount > 0) {
    console.log(`${context.prefix} Removed ${skippedCount} stale skills.`);
  }
}

copyBundledSkills();
