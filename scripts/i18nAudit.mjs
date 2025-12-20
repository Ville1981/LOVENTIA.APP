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
// - Missing keys (present in EN but missing in target language)
// - Extra keys (present in target language but not in EN)
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
// - This script never deletes translations.
// - When --fill is used, only missing keys are filled with EN values.
// - Comments are in English by request.
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

const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);

const flatten = (obj, parent = "", out = {}) => {
  if (!isPlainObject(obj)) {
    out[parent] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = parent ? `${parent}.${k}` : k;
    if (isPlainObject(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};

// Build nested tree from flat pairs; safely promote scalars to objects if needed
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

const hasOwn = (obj, key) => Object.hasOwn ? Object.hasOwn(obj, key) : Object.prototype.hasOwnProperty.call(obj, key);

// -------------------- Locales dir detection --------------------
const detectLocalesDir = () => {
  if (LOCALES_DIR_CLI) return path.resolve(LOCALES_DIR_CLI);

  // Typical monorepo layout: repoRoot/client/public/locales
  const candidateA = path.resolve(__dirname, "..", "client", "public", "locales");
  // Typical single-app layout when running from client/: public/locales
  const candidateB = path.resolve(process.cwd(), "public", "locales");

  if (exists(candidateA)) return candidateA;
  if (exists(candidateB)) return candidateB;

  // Last resort: repoRoot/public/locales
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
console.log(`[i18nAudit] Mode: ${mode === "translation" ? "translation.json" : "namespace *.json files"}`);
console.log(`[i18nAudit] Fill missing: ${DO_FILL && mode === "translation" ? "YES" : "NO"}`);

if (DO_FILL && mode !== "translation") {
  console.log("[i18nAudit] Notice: --fill is only supported for translation.json mode. Ignoring --fill.");
}

// -------------------- Load EN baseline keys --------------------
const loadEnBaseline = () => {
  const baseline = {
    files: {}, // fileName -> flat map of keys -> value
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
    const enFlat = enBaseline.files[fileName] ?? {};
    const enKeys = Object.keys(enFlat);

    if (!exists(filePath)) {
      // Missing file => all EN keys in that file are missing
      missingKeysThisLang.push(...enKeys.map((k) => `${fileName}:${k} (file missing)`));
      missingCount += enKeys.length;
      hasProblems = true;
      continue;
    }

    const json = readJsonSafe(filePath);
    if (json.__INVALID__) {
      invalidFilesCount += 1;
      invalidFilesThisLang.push({ file: filePath, error: json.__INVALID__ });
      hasProblems = true;
      continue;
    }

    // Flatten target language file
    let flat = flatten(json);

    // --- REPLACE START: apply --fill BEFORE counting missing keys ---
    if (DO_FILL && mode === "translation" && fileName === "translation.json") {
      const filled = { ...flat };
      let filledN = 0;

      for (const k of enKeys) {
        if (!hasOwn(filled, k)) {
          filled[k] = enFlat[k];
          filledN += 1;
        }
      }

      if (filledN > 0) {
        const tree = unflatten(filled);
        writeJson(filePath, tree);
        console.log(`[i18nAudit] Filled ${lang}/${fileName} with ${filledN} missing keys from EN`);
        flat = filled; // IMPORTANT: keep counting against the filled set
      }
    }
    // --- REPLACE END ---

    // Missing keys (EN -> lang)
    for (const k of enKeys) {
      if (!hasOwn(flat, k)) {
        missingKeysThisLang.push(`${fileName}:${k}`);
        missingCount += 1;
      }
    }

    // Extra keys (lang -> EN)
    const enKeySet = new Set(enKeys);
    for (const k of Object.keys(flat)) {
      if (!enKeySet.has(k)) {
        extraKeysThisLang.push(`${fileName}:${k}`);
        extraCount += 1;
      }
    }
  }

  if (missingKeysThisLang.length) {
    missingReport[lang] = missingKeysThisLang.sort();
    hasProblems = true; // mark problems once per lang if any missing remain
  }
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
  console.log("\n[i18nAudit] ❌ Missing keys and/or invalid JSON detected.");
  process.exit(1);
} else {
  console.log("\n[i18nAudit] ✅ OK (no missing keys, no invalid JSON).");
  process.exit(0);
}
// --- REPLACE END ---

