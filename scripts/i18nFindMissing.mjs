// PATH: scripts/i18nFindMissing.mjs

// --- REPLACE START: print exactly which keys are missing per language ---
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.join(ROOT, "client", "public", "locales");

// Keep in sync with your app
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
  } catch {
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

function loadEnKeys() {
  const acc = {};
  for (const ns of NAMESPACES) {
    const f = path.join(LOCALES_ROOT, "en", `${ns}.json`);
    const json = readJsonSafe(f, {});
    const flat = flatten(json);
    for (const k of Object.keys(flat)) acc[`${ns}:${k}`] = true;
  }
  return Object.keys(acc);
}

function loadLangKeys(lng) {
  const acc = {};
  for (const ns of NAMESPACES) {
    const f = path.join(LOCALES_ROOT, lng, `${ns}.json`);
    const json = readJsonSafe(f, {});
    const flat = flatten(json);
    for (const k of Object.keys(flat)) acc[`${ns}:${k}`] = true;
  }
  return new Set(Object.keys(acc));
}

(function run() {
  const enKeys = loadEnKeys();
  if (!enKeys.length) {
    console.error("ERROR: English baseline has 0 keys. Check /client/public/locales/en/*.json");
    process.exit(2);
  }

  const offenders = [];
  for (const lng of SUPPORTED) {
    if (lng === "en") continue;
    const set = loadLangKeys(lng);
    const missing = enKeys.filter(k => !set.has(k));
    if (missing.length) {
      offenders.push({ lng, missing });
    }
  }

  if (!offenders.length) {
    console.log("✅ All languages have all EN keys.");
    return;
  }

  for (const o of offenders) {
    console.log(`\n--- Missing in ${o.lng} (${o.missing.length}) ---`);
    // Show all if only a few; otherwise first 30
    const list = o.missing.length <= 30 ? o.missing : o.missing.slice(0, 30);
    console.log(list.join("\n"));
    if (o.missing.length > 30) {
      console.log(`...and ${o.missing.length - 30} more`);
    }
  }
})();
// --- REPLACE END ---
