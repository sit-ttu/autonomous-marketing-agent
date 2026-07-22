import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { WizardPrompter } from "../wizard/prompts.js";

const configDirHolder: { value?: string } = {};

vi.mock("../utils.js", async () => {
  const actual = await vi.importActual<typeof import("../utils.js")>("../utils.js");
  return {
    ...actual,
    get CONFIG_DIR() {
      return configDirHolder.value ?? actual.CONFIG_DIR;
    },
    ensureDir: actual.ensureDir,
  };
});

import { seedBundledSkillsToManagedDir, setupSkills } from "./onboard-skills.js";

beforeAll(() => {
  configDirHolder.value = fs.mkdtempSync(path.join(os.tmpdir(), "foxfang-cfg-"));
});

afterEach(() => {
  // do not remove configDirHolder.value here; it must persist across tests in the file.
});

function makeBundledSkillDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "foxfang-bundled-skills-"));
  for (const name of ["marketing-orchestrator", "canvas", "trello"]) {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: bundled ${name}\n---\n# ${name}\n`,
    );
  }
  return root;
}

function makeManagedDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "foxfang-managed-skills-"));
}

function makePrompter(): {
  prompter: WizardPrompter;
  notes: Array<{ title?: string; message: string }>;
} {
  const notes: Array<{ title?: string; message: string }> = [];
  const prompter: WizardPrompter = {
    intro: vi.fn(async () => {}),
    outro: vi.fn(async () => {}),
    note: vi.fn(async (message: string, title?: string) => {
      notes.push({ title, message });
    }),
    select: vi.fn(async () => "npm") as unknown as WizardPrompter["select"],
    multiselect: vi.fn(async () => []) as unknown as WizardPrompter["multiselect"],
    text: vi.fn(async () => ""),
    confirm: vi.fn(async () => false),
    progress: vi.fn(() => ({ update: vi.fn(), stop: vi.fn() })),
  };
  return { prompter, notes };
}

describe("seedBundledSkillsToManagedDir", () => {
  let bundledDir: string;
  let managedDir: string;

  beforeEach(() => {
    bundledDir = makeBundledSkillDir();
    managedDir = makeManagedDir();
  });

  afterEach(() => {
    fs.rmSync(bundledDir, { recursive: true, force: true });
    fs.rmSync(managedDir, { recursive: true, force: true });
  });

  it("copies bundled skills that are missing in the managed dir", async () => {
    const { prompter, notes } = makePrompter();
    const result = await seedBundledSkillsToManagedDir({
      sourceDir: bundledDir,
      managedDir,
      prompter,
    });

    expect(result.copied.sort()).toEqual(["canvas", "marketing-orchestrator", "trello"]);
    expect(result.skipped).toEqual([]);
    expect(fs.existsSync(path.join(managedDir, "marketing-orchestrator", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(managedDir, "canvas", "SKILL.md"))).toBe(true);
    const note = notes.find((n) => n.title === "Default skills");
    expect(note?.message).toContain("marketing-orchestrator");
  });

  it("does not overwrite existing managed skills", async () => {
    const existing = path.join(managedDir, "marketing-orchestrator");
    fs.mkdirSync(existing, { recursive: true });
    const customSkill = path.join(existing, "SKILL.md");
    fs.writeFileSync(customSkill, "# user-customized\n");

    const result = await seedBundledSkillsToManagedDir({
      sourceDir: bundledDir,
      managedDir,
    });

    expect(result.copied.sort()).toEqual(["canvas", "trello"]);
    expect(result.skipped).toEqual(["marketing-orchestrator"]);
    expect(fs.readFileSync(customSkill, "utf-8")).toBe("# user-customized\n");
  });

  it("returns an empty result when the source dir is missing", async () => {
    const { prompter, notes } = makePrompter();
    const result = await seedBundledSkillsToManagedDir({
      sourceDir: path.join(os.tmpdir(), "definitely-not-a-skill-dir"),
      managedDir,
      prompter,
    });
    expect(result.copied).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(notes.find((n) => n.title === "Default skills")).toBeUndefined();
  });

  it("only seeds skills in the onlyNames allowlist when provided", async () => {
    const result = await seedBundledSkillsToManagedDir({
      sourceDir: bundledDir,
      managedDir,
      onlyNames: new Set(["canvas"]),
    });
    expect(result.copied).toEqual(["canvas"]);
    expect(fs.existsSync(path.join(managedDir, "canvas", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(managedDir, "marketing-orchestrator", "SKILL.md"))).toBe(false);
  });

  it("skips entries without SKILL.md", async () => {
    fs.mkdirSync(path.join(bundledDir, "not-a-skill"), { recursive: true });
    fs.writeFileSync(path.join(bundledDir, "not-a-skill", "README.md"), "ignore me");
    const result = await seedBundledSkillsToManagedDir({
      sourceDir: bundledDir,
      managedDir,
    });
    expect(result.copied.sort()).toEqual(["canvas", "marketing-orchestrator", "trello"]);
    expect(result.skipped).toEqual([]);
  });
});

describe("setupSkills (onboard)", () => {
  let bundledDir: string;
  let managedDir: string;

  beforeEach(() => {
    bundledDir = makeBundledSkillDir();
    managedDir = makeManagedDir();
    process.env.FOXFANG_BUNDLED_SKILLS_DIR = bundledDir;
  });

  afterEach(() => {
    fs.rmSync(bundledDir, { recursive: true, force: true });
    fs.rmSync(managedDir, { recursive: true, force: true });
    delete process.env.FOXFANG_BUNDLED_SKILLS_DIR;
  });

  it("seeds bundled skills without prompting for selection", async () => {
    const { prompter, notes } = makePrompter();
    const cfg = await setupSkills(
      {} as never,
      "/tmp/ws",
      { log: vi.fn(), error: vi.fn(), exit: vi.fn() as never },
      prompter,
    );

    expect(cfg).toEqual({});
    const effectiveManaged = path.join(configDirHolder.value as string, "skills");
    expect(fs.existsSync(path.join(effectiveManaged, "marketing-orchestrator", "SKILL.md"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(effectiveManaged, "canvas", "SKILL.md"))).toBe(true);
    const defaultNote = notes.find((n) => n.title === "Default skills");
    expect(defaultNote).toBeDefined();
  });
});
