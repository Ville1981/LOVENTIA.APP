// --- REPLACE START: i18n key auditor (+ optional fill) ---
// Usage:
//   node client/scripts/i18n/audit-i18n.mjs \
//     --locales-dir client/public/locales \
//     --out-dir client/i18n-report [--fill]
//
// What it does:
//  1) Loads EN (source of truth) and all other languages from locales-dir
//  2) Flattens nested keys (dot-notation)
//  3) Reports missing & extra keys per language
//  4) Writes:
//     - summary.csv
//     - missing_keys.json
//     - extra_keys.json
//     - invalid_json.json
//  5) If --fill is provided: fills missing keys in each language with EN values
//
// Notes:
//  - Keeps existing translations intact; fills only missing keys
//  - Produces stable, pretty-printed JSON
//  - Safe for Git (no merge markers; newline at EOF)
// -----------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- CLI --------------------
const args = process.argv.slice(2);
const getFlag = (name, def = undefined) => {
  const i = args.findIndex(a => a === name || a.startsWith(`${name}=`));
  if (i === -1) return def;
  const eq = args[i].indexOf("=");
  if (eq >= 0) return args[i].slice(eq + 1);
  return args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
};

const LOCALES_DIR = path.resolve(getFlag("--locales-dir", "client/public/locales"));
const OUT_DIR = path.resolve(getFlag("--out-dir", "client/i18n-report"));
const DO_FILL = Boolean(getFlag("--fill", false));

// -------------------- Helpers --------------------
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

const readJSON = (file) => {
  try {
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""); // strip BOM
    return JSON.parse(raw);
  } catch (e) {
    return { __INVALID__: e?.message || String(e) };
  }
};

const writeJSON = (file, data) => {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
};

const writeCSV = (file, rows) => {
  ensureDir(path.dirname(file));
  if (!rows.length) {
    fs.writeFileSync(file, "lang,status,missing,extra\n", "utf8");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")].concat(
    rows.map(r => headers.map(h => String(r[h] ?? "")).join(","))
  );
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
    if (isPlainObject(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
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
      if (isLeaf) {
        node[part] = value;
      } else {
        if (!isPlainObject(node[part])) {
          node[part] = {};
        }
        node = node[part];
      }
    }
  };
  const keys = Object.keys(pairs).sort();
  for (const k of keys) {
    setPath(root, k.split("."), pairs[k]);
  }
  return root;
};

// -------------------- Main --------------------
const abort = (msg) => {
  console.error(`\n[audit-i18n] ${msg}\n`);
  process.exit(1);
};

if (!fs.existsSync(LOCALES_DIR)) {
  abort(`Locales directory not found: ${LOCALES_DIR}`);
}

const languages = fs.readdirSync(LOCALES_DIR).filter((d) =>
  fs.existsSync(path.join(LOCALES_DIR, d, "translation.json"))
);

if (!languages.includes("en")) {
  abort(`EN translation missing under ${LOCALES_DIR}/en/translation.json`);
}

console.log(`[audit-i18n] Scanning: ${LOCALES_DIR}`);
console.log(`[audit-i18n] Output to: ${OUT_DIR}`);
console.log(`[audit-i18n] Fill missing with EN: ${DO_FILL ? "YES" : "NO"}`);

ensureDir(OUT_DIR);

const enPath = path.join(LOCALES_DIR, "en", "translation.json");
const enDataRaw = readJSON(enPath);
if (enDataRaw.__INVALID__) {
  abort(`Invalid EN JSON: ${enPath}\n  -> ${enDataRaw.__INVALID__}`);
}
const enFlat = flatten(enDataRaw);

const summary = [];
const missingAll = {};
const extraAll = {};
const invalidAll = {};

// Process each language
for (const lang of languages.sort()) {
  const file = path.join(LOCALES_DIR, lang, "translation.json");
  if (lang === "en") {
    summary.push({ lang, status: "ok", missing: 0, extra: 0 });
    continue;
  }

  const dataRaw = readJSON(file);
  if (dataRaw.__INVALID__) {
    invalidAll[lang] = { file, error: dataRaw.__INVALID__ };
    summary.push({ lang, status: "INVALID JSON", missing: "", extra: "" });
    continue;
  }

  const flat = flatten(dataRaw);
  const enKeys = new Set(Object.keys(enFlat));
  const langKeys = new Set(Object.keys(flat));

  const missing = [...enKeys].filter((k) => !langKeys.has(k)).sort();
  const extra = [...langKeys].filter((k) => !enKeys.has(k)).sort();

  if (missing.length) missingAll[lang] = missing;
  if (extra.length) extraAll[lang] = extra;

  summary.push({
    lang,
    status: "ok",
    missing: missing.length,
    extra: extra.length,
  });

  // Optional: fill missing from EN and write back
  if (DO_FILL && missing.length) {
    const filled = { ...flat };
    for (const k of missing) filled[k] = enFlat[k];
    const tree = unflatten(filled);
    writeJSON(file, tree);
    console.log(`[audit-i18n] Filled ${lang} with ${missing.length} keys`);
  }
}

// Write reports
writeCSV(path.join(OUT_DIR, "summary.csv"), summary);
writeJSON(path.join(OUT_DIR, "missing_keys.json"), missingAll);
writeJSON(path.join(OUT_DIR, "extra_keys.json"), extraAll);
writeJSON(path.join(OUT_DIR, "invalid_json.json"), invalidAll);

console.log("\n[audit-i18n] Done.");
console.log(` - ${path.join(OUT_DIR, "summary.csv")}`);
console.log(` - ${path.join(OUT_DIR, "missing_keys.json")}`);
console.log(` - ${path.join(OUT_DIR, "extra_keys.json")}`);
console.log(` - ${path.join(OUT_DIR, "invalid_json.json")}`);
// --- REPLACE END ---
