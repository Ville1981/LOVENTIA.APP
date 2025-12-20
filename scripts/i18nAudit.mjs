// PATH: scripts/i18nAudit.mjs

// --- REPLACE START: single source-of-truth i18n audit (supports translation.json and namespace *.json) ---
//
// This script is intended to be the ONE canonical i18n audit implementation.
// It supports both common repo layouts:
//
// A) Single-file i18next layout (translation.json):
//    <locales>/<lang>/translation.json
//
// B) Namespace layout (multiple json files):
//    <locales>/<lang>/common.json, discover.json, ...
//
// It compares ALL keys present in EN against every other language and reports:
// - Missing keys (in target lang but present in EN)
// - Extra keys (in target lang but not in EN)
// - Invalid JSON files
//
// Exit codes:
// - 0 => OK, no missing keys, no invalid JSON
// - 1 => Missing keys and/or invalid JSON found
//
// Optional report output (CSV + JSON):
//   node scripts/i18nAudit.mjs --out-dir client/i18n-report
//
// Optional auto-fill (ONLY for translation.json layout):
//   node scripts/i18nAudit.mjs --fill
//
// Notes:
// - This script never deletes translations arbitrarily.
// - When --fill is used, only missing keys are filled with EN values.
// - IMPORTANT: If EN expects a "leaf" value (array/string/number/bool/null) at key K,
//   but a target language has nested keys under K.* (i.e. K is an object), then K is a
//   TYPE MISMATCH and must be normalized. In --fill mode we remove K.* before writing K,
//   so the file ends up with the correct shape.
//
// Comments are in English by request.
//
// ------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- CLI --------------------
const args = process.argv.slice(2);

const getFlag = (name, def = undefined) => {
  const i = args.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i === -1) return def;
  const eq = args[i].indexOf("=");
  if (eq >= 0) return args[i].slice(eq + 1);
  return args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
};

const hasFlag = (name) => Boolean(getFlag(name, false));

const LOCALES_DIR_CLI = getFlag("--locales-dir", "");
const OUT_DIR = getFlag("--out-dir", "");
const DO_FILL = hasFlag("--fill");

// -------------------- Utilities --------------------
const exists = (p) => {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
};

const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

const readText = (file) => fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""); // strip BOM

const readJsonSafe = (file) => {
  try {
    const raw = readText(file);
    if (!raw.trim()) return { __INVALID__: "Empty JSON file" };
    return JSON.parse(raw);
  } catch (e) {
    return { __INVALID__: e?.message || String(e) };
  }
};

const writeJson = (file, data) => {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
};

const writeCsv = (file, rows) => {
  ensureDir(path.dirname(file));
  const headers = ["lang", "status", "missing", "extra", "invalidFiles"];
  const lines = [headers.join(",")];

  for (const r of rows) {
    const row = headers.map((h) => String(r[h] ?? "")).join(",");
    lines.push(row);
  }

  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
};

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

const flatten = (obj, parent = "", out = {}) => {
  // Arrays are leaf values (do not flatten indexes)
  if (Array.isArray(obj)) {
    out[parent] = obj;
    return out;
  }

  if (!isPlainObject(obj)) {
    out[parent] = obj;
    return out;
  }

  for (const [k, v] of Object.entries(obj)) {
    const key = parent ? `${parent}.${k}` : k;
    if (isPlainObject(v)) flatten(v, key, out);
    else out[key] = v; // includes arrays
  }
  return out;
};

// Build nested tree from flat pairs; safely promote scalars/arrays to objects if needed
// NOTE: If both "a.b" (leaf) and "a.b.c" (descendant) exist, the descendant will force "a.b" to become object.
// Therefore in --fill we remove "a.b.*" descendants when EN expects "a.b" as a leaf.
const unflatten = (pairs) => {
  const root = {};
  const setPath = (obj, parts, value) => {
    let node = obj;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      if (isLeaf) node[part] = value;
      else {
        if (!isPlainObject(node[part])) node[part] = {};
        node = node[part];
      }
    }
  };

  const keys = Object.keys(pairs).sort();
  for (const k of keys) setPath(root, k.split("."), pairs[k]);
  return root;
};

const abort = (msg) => {
  console.error(`\n[i18nAudit] ${msg}\n`);
  process.exit(1);
};

// Returns true if flat-map contains any descendant key under prefix "k."
const hasDescendants = (flatMap, k) => {
  const prefix = `${k}.`;
  for (const kk of Object.keys(flatMap)) {
    if (kk.startsWith(prefix)) return true;
  }
  return false;
};

// Remove all descendant keys under "k." from a flat-map (in-place)
const deleteDescendants = (flatMap, k) => {
  const prefix = `${k}.`;
  for (const kk of Object.keys(flatMap)) {
    if (kk.startsWith(prefix)) delete flatMap[kk];
  }
};

// Determine if EN expects a "leaf" at key k (i.e. not a plain object)
const enExpectsLeaf = (enFlat, k) => {
  // If EN flatten created key "k", that is by definition a leaf in EN (array/string/number/bool/null).
  // If EN does not have key "k" but has descendants, then EN expects object.
  return Object.prototype.hasOwnProperty.call(enFlat, k);
};

// --- REPLACE START: robust shape enforcement helpers for leaf keys (fixes array/scalar -> object regressions) ---
// Get a value at dotted path; returns undefined if any segment is missing or not an object before the leaf.
const getAtPath = (obj, dotted) => {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
};

// Set a value at dotted path; creates intermediate objects as needed.
// If an intermediate segment exists but is not an object (or is an array), it is replaced with an object.
const setAtPath = (obj, dotted, value) => {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const isLeaf = i === parts.length - 1;
    if (isLeaf) {
      cur[p] = value;
    } else {
      if (!cur[p] || typeof cur[p] !== "object" || Array.isArray(cur[p])) cur[p] = {};
      cur = cur[p];
    }
  }
};
// --- REPLACE END ---

// -------------------- Locales dir detection --------------------
const detectLocalesDir = () => {
  if (LOCALES_DIR_CLI) return path.resolve(LOCALES_DIR_CLI);

  // Typical monorepo layout: repoRoot/client/public/locales
  const candidateA = path.resolve(__dirname, "..", "client", "public", "locales");
  // Typical single-app layout when running from client/: client/public/locales or public/locales
  const candidateB = path.resolve(process.cwd(), "public", "locales");

  if (exists(candidateA)) return candidateA;
  if (exists(candidateB)) return candidateB;

  // Last resort: try repoRoot/public/locales
  const candidateC = path.resolve(__dirname, "..", "public", "locales");
  if (exists(candidateC)) return candidateC;

  return "";
};

const LOCALES_DIR = detectLocalesDir();
if (!LOCALES_DIR) {
  abort(
    "Locales directory not found. Provide it explicitly:\n" +
      "  node scripts/i18nAudit.mjs --locales-dir client/public/locales"
  );
}

// -------------------- Determine layout: translation.json vs namespaces --------------------
const getLanguages = () => {
  const dirs = fs.readdirSync(LOCALES_DIR).filter((d) => {
    const full = path.join(LOCALES_DIR, d);
    return fs.statSync(full).isDirectory() && !d.startsWith(".");
  });
  return dirs;
};

const listJsonFiles = (lang) => {
  const dir = path.join(LOCALES_DIR, lang);
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .sort();
};

const languages = getLanguages();
if (!languages.includes("en")) {
  abort(`EN language folder not found under: ${LOCALES_DIR}`);
}

// Decide mode based on EN files
const enFiles = listJsonFiles("en");
const hasTranslationJson = enFiles.includes("translation.json");

// If translation.json exists, treat that as the baseline source-of-truth.
// Otherwise, treat ALL *.json files in EN as namespaces.
const mode = hasTranslationJson ? "translation" : "namespaces";

console.log(`[i18nAudit] Locales dir: ${LOCALES_DIR}`);
console.log(
  `[i18nAudit] Mode: ${mode === "translation" ? "translation.json" : "namespace *.json files"}`
);
console.log(`[i18nAudit] Fill missing: ${DO_FILL && mode === "translation" ? "YES" : "NO"}`);

if (DO_FILL && mode !== "translation") {
  console.log("[i18nAudit] Notice: --fill is only supported for translation.json mode. Ignoring --fill.");
}

// -------------------- Load EN baseline keys --------------------
const loadEnBaseline = () => {
  const baseline = {
    files: {}, // fileName -> flat map of keys
    allKeys: new Set(), // fileName:key -> present
  };

  const filesToUse = mode === "translation" ? ["translation.json"] : enFiles;

  if (!filesToUse.length) {
    abort("EN does not contain any JSON files to audit.");
  }

  for (const fileName of filesToUse) {
    const filePath = path.join(LOCALES_DIR, "en", fileName);
    const json = readJsonSafe(filePath);
    if (json.__INVALID__) {
      abort(`Invalid EN JSON: ${filePath}\n  -> ${json.__INVALID__}`);
    }
    const flat = flatten(json);
    baseline.files[fileName] = flat;

    for (const k of Object.keys(flat)) {
      baseline.allKeys.add(`${fileName}:${k}`);
    }
  }

  return baseline;
};

const enBaseline = loadEnBaseline();

// -------------------- Audit each language --------------------
const summaryRows = [];
const missingReport = {};
const extraReport = {};
const invalidReport = {};

let hasProblems = false;

for (const lang of languages.sort()) {
  if (lang === "en") {
    summaryRows.push({ lang, status: "ok", missing: 0, extra: 0, invalidFiles: 0 });
    continue;
  }

  const filesToUse = mode === "translation" ? ["translation.json"] : Object.keys(enBaseline.files);

  let missingCount = 0;
  let extraCount = 0;
  let invalidFilesCount = 0;

  const missingKeysThisLang = [];
  const extraKeysThisLang = [];
  const invalidFilesThisLang = [];

  for (const fileName of filesToUse) {
    const filePath = path.join(LOCALES_DIR, lang, fileName);

    // -------------------- Missing file -> all EN keys in that file are missing --------------------
    if (!exists(filePath)) {
      const enFlat = enBaseline.files[fileName] ?? {};
      const enKeys = Object.keys(enFlat).map((k) => `${fileName}:${k}`);
      missingKeysThisLang.push(...enKeys.map((k) => `${k} (file missing)`));
      missingCount += enKeys.length;
      hasProblems = true;
      continue;
    }

    // -------------------- Read + parse --------------------
    const json = readJsonSafe(filePath);
    if (json.__INVALID__) {
      invalidFilesCount += 1;
      invalidFilesThisLang.push({ file: filePath, error: json.__INVALID__ });
      hasProblems = true;
      continue;
    }

    let flat = flatten(json);
    const enFlat = enBaseline.files[fileName] ?? {};

    // --- REPLACE START: normalize conflicting shapes during --fill, then audit against the updated flat map ---
    //
    // Key point:
    // - EN expects leaf key "etusivu.heroTekstit" (array), but FI had "etusivu.heroTekstit.*" as object children.
    //   Without removing descendants, unflatten will convert the array back into object.
    //
    // Additional hardening:
    // - Even after deleting descendants in the flat map, a file may still end up with the wrong shape
    //   due to stale conflicting structures. After building the tree we enforce EN leaf shapes:
    //   if EN expects a leaf at K, then tree[K] is overwritten with EN value (array/scalar), removing nested objects.
    //
    if (DO_FILL && mode === "translation" && fileName === "translation.json") {
      const enKeys = Object.keys(enFlat);
      const filled = { ...flat };

      let changed = 0;

      for (const k of enKeys) {
        const enHasLeaf = enExpectsLeaf(enFlat, k);

        if (enHasLeaf) {
          // EN expects a leaf at k. If target has descendants (k.*), that's a type mismatch.
          if (hasDescendants(filled, k)) {
            // Remove descendants so the leaf can survive unflatten.
            deleteDescendants(filled, k);
            changed += 1;
          }

          // If the leaf itself is missing, fill it from EN.
          if (!Object.prototype.hasOwnProperty.call(filled, k)) {
            filled[k] = enFlat[k];
            changed += 1;
          }
        } else {
          // EN expects object (descendants) at k. We do not auto-create object structures here.
        }
      }

      if (changed > 0) {
        const tree = unflatten(filled);

        // Enforce EN leaf shapes at tree-level to prevent array/scalar -> object regressions.
        // If EN expects a leaf at key K, and target tree has an object at K, overwrite K with EN value.
        let enforced = 0;
        for (const k of enKeys) {
          if (!Object.prototype.hasOwnProperty.call(enFlat, k)) continue; // only leaf keys are present in enFlat
          const expected = enFlat[k];
          const actual = getAtPath(tree, k);

          // EN leaf can be array/string/number/bool/null; EN leaf is never a plain object here.
          if (isPlainObject(actual)) {
            setAtPath(tree, k, expected);
            enforced += 1;
          } else if (Array.isArray(expected) && !Array.isArray(actual)) {
            // If EN expects array but target is scalar (or missing), force array.
            setAtPath(tree, k, expected);
            enforced += 1;
          }
        }

        writeJson(filePath, tree);

        // Re-flatten AFTER writing to ensure audit uses the real final structure.
        flat = flatten(tree);

        const total = changed + enforced;
        console.log(
          `[i18nAudit] Filled/normalized ${lang}/${fileName} (${total} structural/key updates from EN)`
        );
      }
    }
    // --- REPLACE END ---

    // -------------------- Missing keys (EN -> lang) --------------------
    // NOTE: If EN expects a leaf key K, but lang only has K.* descendants, it's a type mismatch.
    // We report it as missing K (type mismatch) because the UI expects the EN shape.
    for (const k of Object.keys(enFlat)) {
      // --- idxfix: ignore EN array index keys like "etusivu.heroTekstit.0"
      // If the target language has the base key as an array (e.g. "etusivu.heroTekstit": [...]),
      // we should NOT require .0/.1/.2.
      const mIdx = k.match(/^(.*)\.(\d+)$/);
      if (mIdx) {
        const base = mIdx[1];
        if (Object.prototype.hasOwnProperty.call(flat, base) && Array.isArray(flat[base])) continue;
      }
      if (Object.prototype.hasOwnProperty.call(flat, k)) continue;

      if (hasDescendants(flat, k)) {
        // Type mismatch: EN has leaf at k, lang has object at k (descendants exist)
        missingKeysThisLang.push(`${fileName}:${k} (type mismatch: expected leaf like EN, found nested object)`);
      } else {
        missingKeysThisLang.push(`${fileName}:${k}`);
      }
      missingCount += 1;
      hasProblems = true;
    }

    // -------------------- Extra keys (lang -> EN) --------------------
    const enKeySet = new Set(Object.keys(enFlat));
    for (const k of Object.keys(flat)) {
      if (!enKeySet.has(k)) {
        extraKeysThisLang.push(`${fileName}:${k}`);
        extraCount += 1;
      }
    }
  }

  if (missingKeysThisLang.length) missingReport[lang] = missingKeysThisLang.sort();
  if (extraKeysThisLang.length) extraReport[lang] = extraKeysThisLang.sort();
  if (invalidFilesThisLang.length) invalidReport[lang] = invalidFilesThisLang;

  summaryRows.push({
    lang,
    status: invalidFilesCount ? "invalid" : missingCount ? "missing" : "ok",
    missing: missingCount,
    extra: extraCount,
    invalidFiles: invalidFilesCount,
  });
}

// -------------------- Output summary --------------------
const padRight = (s, n) => {
  const str = String(s);
  return str + " ".repeat(Math.max(0, n - str.length));
};

console.log("\n[i18nAudit] Summary:");
for (const r of summaryRows) {
  const left = padRight(r.lang, 5);
  const st = padRight(r.status, 8);
  const m = padRight(`missing: ${r.missing}`, 14);
  const e = padRight(`extra: ${r.extra}`, 12);
  const inv = `invalidFiles: ${r.invalidFiles}`;
  console.log(`  ${left}  ${st}  ${m}  ${e}  ${inv}`);
}

// -------------------- Optional report files --------------------
if (OUT_DIR) {
  const out = path.resolve(OUT_DIR);

  writeCsv(path.join(out, "summary.csv"), summaryRows);
  writeJson(path.join(out, "missing_keys.json"), missingReport);
  writeJson(path.join(out, "extra_keys.json"), extraReport);
  writeJson(path.join(out, "invalid_json.json"), invalidReport);

  console.log("\n[i18nAudit] Report written:");
  console.log(`  - ${path.join(out, "summary.csv")}`);
  console.log(`  - ${path.join(out, "missing_keys.json")}`);
  console.log(`  - ${path.join(out, "extra_keys.json")}`);
  console.log(`  - ${path.join(out, "invalid_json.json")}`);
}

// -------------------- Exit code --------------------
if (hasProblems) {
  console.log("\n[i18nAudit] âŒ Missing keys and/or invalid JSON detected.");
  process.exit(1);
} else {
  console.log("\n[i18nAudit] âœ… OK (no missing keys, no invalid JSON).");
  process.exit(0);
}
// --- REPLACE END ---





