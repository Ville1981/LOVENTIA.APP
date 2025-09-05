// PATH: scripts/i18nAudit.mjs

// --- REPLACE START: robust i18n audit (counts only EN keys, reports extras & _legacy without inflating %) ---
/* eslint-disable no-console */
/* Node ESM script */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust if your monorepo layout differs
const ROOT = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.resolve(ROOT, "client", "public", "locales");

const NAMESPACES = [
  "common",
  "profile",
  "lifestyle",
  "discover",
  "chat",
  "navbar",
  "footer",
  "translation",
];

const SUPPORTED = [
  "en","fi","sv","de","fr","es","it","pt","pl","ro","tr","nl","no","da","cs","sk",
  "hu","et","lt","lv","bg","el","uk","ru","ja","ko","zh","ar","he","hi","sw","ur",
];

function readJsonSafe(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`WARN: cannot read JSON ${file}: ${e.message}`);
    return fallback;
  }
}

function flatten(obj, prefix = "", out = {}) {
  if (obj == null) return out;
  if (typeof obj !== "object") {
    out[prefix || ""] = obj;
    return out;
  }
  for (const k of Object.keys(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    flatten(obj[k], next, out);
  }
  return out;
}

// Load EN baseline as single flattened map of dotKeys -> value
function loadEnBaseline() {
  const acc = {};
  for (const ns of NAMESPACES) {
    const f = path.join(LOCALES_ROOT, "en", `${ns}.json`);
    const json = readJsonSafe(f, {});
    const flat = flatten(json);
    for (const k of Object.keys(flat)) {
      const dotKey = `${ns}:${k}`; // keep ns to avoid collisions
      acc[dotKey] = true;
    }
  }
  return acc;
}

function loadLangAllKeys(lng) {
  const keys = {};
  for (const ns of NAMESPACES) {
    const f = path.join(LOCALES_ROOT, lng, `${ns}.json`);
    const json = readJsonSafe(f, {});
    const flat = flatten(json);
    for (const k of Object.keys(flat)) {
      const dotKey = `${ns}:${k}`;
      keys[dotKey] = flat[k];
    }
  }
  return keys;
}

function padRight(s, n) {
  const str = String(s);
  return str + " ".repeat(Math.max(0, n - str.length));
}

function fmtPct(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function audit() {
  const en = loadEnBaseline();
  const enKeys = Object.keys(en);
  const enTotal = enKeys.length;

  if (enTotal === 0) {
    console.error("ERROR: English baseline contains 0 keys. Check /client/public/locales/en/*.json");
    process.exitCode = 2;
    return;
  }

  const rows = [];

  for (const lng of SUPPORTED) {
    if (lng === "en") continue;
    const langKeys = loadLangAllKeys(lng);
    const langKeyNames = Object.keys(langKeys);

    // Count translated only if key exists in EN
    const translated = enKeys.filter((k) => k in langKeys);
    const missing = enKeys.filter((k) => !(k in langKeys));

    // Extras (not in EN)
    const extras = langKeyNames.filter((k) => !(k in en));

    // _legacy counters (informational only)
    const legacyCount = langKeyNames.filter((k) => k.endsWith("._legacy")).length;

    const cov = (translated.length / enTotal) * 100;

    rows.push({
      lng,
      translated: translated.length,
      enTotal,
      perc: cov,
      missingCount: missing.length,
      missing,
      extrasCount: extras.length,
      extras,
      legacy: legacyCount,
    });
  }

  // Print compact table like the earlier script (but correct %)
  for (const r of rows) {
    const left = padRight(r.lng, 5);
    const t = padRight(`${r.translated}/${r.enTotal}`, 9);
    const p = padRight(`(${fmtPct(r.perc)}%)`, 8);
    const m = padRight(`missing: ${r.missingCount}`, 14);
    const ex = r.extrasCount ? `  extras: ${r.extrasCount}` : "";
    const lg = r.legacy ? `  _legacy: ${r.legacy}` : "";
    console.log(`${left}: ${t} ${p}   ${m}${ex}${lg}`);
  }

  const anyMissing = rows.some((r) => r.missingCount > 0);
  if (anyMissing) {
    console.log("\n❌ Some languages are missing keys. Run: node scripts/i18nSync.mjs");
  } else {
    console.log("\n✅ All languages have at least the English keys.");
  }

  // Optional: uncomment to dump top N missing keys per language
  // for (const r of rows.filter(x => x.missingCount)) {
  //   console.log(`\n--- Missing (${r.lng}) first 20 ---\n` + r.missing.slice(0,20).join("\n"));
  // }
}

audit();
// --- REPLACE END ---
