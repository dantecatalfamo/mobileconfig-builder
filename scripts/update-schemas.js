#!/usr/bin/env node
/**
 * update-schemas.js
 *
 * Reads MDM profile YAMLs and Declarative Device Management YAMLs from the
 * Apple device-management submodule and writes src/schemas.json.
 *
 * Usage:
 *   npm run update-schemas          # regenerate from current submodule
 *   npm run update-schemas:pull     # git pull submodule first, then regenerate
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DM = join(ROOT, "device-management");
const PROFILES_DIR = join(DM, "mdm", "profiles");
const DECLARATIVE_DIR = join(DM, "declarative", "declarations");
const LICENSE_FILE = join(DM, "LICENSE.txt");
const OUT_FILE = join(ROOT, "src", "schemas.json");

// ── Optional pull ─────────────────────────────────────────────────────────────
const shouldPull = process.argv.includes("--pull");
if (shouldPull) {
  console.log("Pulling latest Apple device-management schema…");
  try {
    execSync("git submodule update --remote --merge device-management", {
      cwd: ROOT,
      stdio: "inherit",
    });
  } catch {
    console.error("git submodule update failed — continuing with local copy.");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Break YAML anchor shared-reference cycles by always producing a fresh clone
 * for every node. Uses a call-stack WeakSet: objects currently being visited
 * are in the set; after cloning all children we remove them, so sibling
 * branches get a full copy.
 *
 * When a cycle is detected, rather than immediately returning null, we re-enter
 * with a fresh stack (up to maxRecursion times). This unrolls the cycle by one
 * extra level, so back-referenced subkey definitions are populated one level
 * deeper before finally terminating with null.
 */
function deref(obj, maxRecursion = 1) {
  function walk(o, stack, depth) {
    if (o === null || typeof o !== "object") return o;
    if (stack.has(o)) {
      if (depth < maxRecursion) return walk(o, new WeakSet(), depth + 1);
      return null;
    }
    stack.add(o);
    const result = Array.isArray(o)
      ? o.map(v => walk(v, stack, depth))
      : Object.fromEntries(
          Object.entries(o).map(([k, v]) => [k, walk(v, stack, depth)]),
        );
    stack.delete(o);
    return result;
  }
  return walk(obj, new WeakSet(), 0);
}

function loadYaml(filepath) {
  try {
    return yaml.load(readFileSync(filepath, "utf8"));
  } catch (e) {
    console.warn(`  WARN: could not parse ${filepath}: ${e.message}`);
    return null;
  }
}

function loadDir(dir, filter) {
  const results = {};
  const skipped = [];
  let files;
  try {
    files = readdirSync(dir);
  } catch {
    return { results, skipped };
  }
  for (const file of files.filter(filter).sort()) {
    const id = file.replace(/\.yaml$/, "");
    const data = loadYaml(join(dir, file));
    if (!data || !data.payload || !data.payloadkeys) {
      skipped.push(file);
      continue;
    }
    try {
      const clean = deref(data);
      JSON.stringify(clean);
      results[id] = clean;
    } catch (e) {
      console.warn(`  WARN: skipping ${file} — ${e.message}`);
      skipped.push(file);
    }
  }
  return { results, skipped };
}

/** Recursively load all .yaml files under a directory tree */
function loadDirRecursive(dir, idPrefix = "") {
  const results = {};
  const skipped = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return { results, skipped };
  }
  for (const entry of entries.sort()) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      const sub = loadDirRecursive(
        fullPath,
        idPrefix ? `${idPrefix}/${entry}` : entry,
      );
      Object.assign(results, sub.results);
      skipped.push(...sub.skipped);
    } else if (entry.endsWith(".yaml") && entry !== "declarationbase.yaml") {
      const id = entry.replace(/\.yaml$/, "");
      const data = loadYaml(fullPath);
      if (!data || !data.payload || !data.payloadkeys) {
        skipped.push(entry);
        continue;
      }
      try {
        const clean = deref(data);
        JSON.stringify(clean);
        // Tag which category this declaration belongs to
        clean._category = idPrefix || "other";
        results[id] = clean;
      } catch (e) {
        console.warn(`  WARN: skipping ${entry} — ${e.message}`);
        skipped.push(entry);
      }
    }
  }
  return { results, skipped };
}

// ── MDM profiles ──────────────────────────────────────────────────────────────
console.log("Reading MDM profiles from:", PROFILES_DIR);

const common = loadYaml(join(PROFILES_DIR, "CommonPayloadKeys.yaml"));
const topLevel = loadYaml(join(PROFILES_DIR, "TopLevel.yaml"));
const { results: profiles, skipped: profilesSkipped } = loadDir(
  PROFILES_DIR,
  f => f.startsWith("com.apple.") && f.endsWith(".yaml"),
);

console.log(
  `  Profiles: ${Object.keys(profiles).length}  Skipped: ${profilesSkipped.length}`,
);

// ── Declarative declarations ──────────────────────────────────────────────────
console.log("Reading Declarative declarations from:", DECLARATIVE_DIR);

const base = loadYaml(join(DECLARATIVE_DIR, "declarationbase.yaml"));
const { results: declarations, skipped: declarationsSkipped } =
  loadDirRecursive(DECLARATIVE_DIR);

console.log(
  `  Declarations: ${Object.keys(declarations).length}  Skipped: ${declarationsSkipped.length}`,
);

// ── Read license ─────────────────────────────────────────────────────────────
let appleLicense = "";
try {
  appleLicense = readFileSync(LICENSE_FILE, "utf8").trim();
} catch {
  console.warn(
    "WARN: could not read LICENSE.txt from device-management submodule",
  );
}

// ── Write bundle ──────────────────────────────────────────────────────────────
const bundle = {
  _meta: {
    generatedAt: new Date().toISOString(),
    profileCount: Object.keys(profiles).length,
    declarationCount: Object.keys(declarations).length,
    source: "https://github.com/apple/device-management",
  },
  _appleLicense: appleLicense,
  commonPayloadKeys: deref(common?.payloadkeys ?? []),
  topLevel: deref(topLevel?.payloadkeys ?? []),
  declarationBase: deref(base?.payloadkeys ?? []),
  profiles,
  declarations,
};

writeFileSync(OUT_FILE, JSON.stringify(bundle, null, 2));

const sizeKB = Math.round(readFileSync(OUT_FILE).length / 1024);
console.log(`✓ Wrote ${OUT_FILE}  (${sizeKB} KB)`);
