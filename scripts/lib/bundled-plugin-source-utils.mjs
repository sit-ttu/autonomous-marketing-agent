import fs from "node:fs";
import path from "node:path";

export const BUNDLED_PLUGIN_MANIFEST_FILENAMES = ["foxfang.plugin.json", "openclaw.plugin.json"];
export const BUNDLED_PACKAGE_MANIFEST_KEYS = ["foxfang", "openclaw"];

/**
 * @param {unknown} packageJson
 */
export function resolveBundledPackageManifest(packageJson) {
  if (!packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) {
    return undefined;
  }
  for (const key of BUNDLED_PACKAGE_MANIFEST_KEYS) {
    const manifest = packageJson[key];
    if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
      return manifest;
    }
  }
  return undefined;
}

export function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export function resolveBundledPluginManifestPath(pluginDir) {
  for (const filename of BUNDLED_PLUGIN_MANIFEST_FILENAMES) {
    const manifestPath = path.join(pluginDir, filename);
    if (fs.existsSync(manifestPath)) {
      return manifestPath;
    }
  }
  return undefined;
}

export function collectBundledPluginSources(params = {}) {
  const repoRoot = path.resolve(params.repoRoot ?? process.cwd());
  const extensionsRoot = path.join(repoRoot, "extensions");
  if (!fs.existsSync(extensionsRoot)) {
    return [];
  }

  const requirePackageJson = params.requirePackageJson === true;
  const entries = [];
  for (const dirent of fs.readdirSync(extensionsRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const pluginDir = path.join(extensionsRoot, dirent.name);
    const manifestPath = resolveBundledPluginManifestPath(pluginDir);
    const packageJsonPath = path.join(pluginDir, "package.json");
    if (!manifestPath) {
      continue;
    }
    if (requirePackageJson && !fs.existsSync(packageJsonPath)) {
      continue;
    }

    entries.push({
      dirName: dirent.name,
      pluginDir,
      manifestPath,
      manifest: JSON.parse(fs.readFileSync(manifestPath, "utf8")),
      ...(fs.existsSync(packageJsonPath)
        ? {
            packageJsonPath,
            packageJson: JSON.parse(fs.readFileSync(packageJsonPath, "utf8")),
          }
        : {}),
    });
  }

  return entries.toSorted((left, right) => left.dirName.localeCompare(right.dirName));
}
