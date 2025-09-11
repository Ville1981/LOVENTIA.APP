// PATH: scripts/i18nBackfillFromEN.mjs
/* eslint-disable no-console */
/* Node ESM */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.resolve(ROOT, "client", "public", "locales");

const NAMESPACES = [
  "common","profile","lifestyle","discover","chat","navbar","footer","translation",
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

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
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

function unflatten(dict) {
  const out = {};
  for (const [k, v] of Object.entries(dict)) {
    const parts = k.split(".");
    let cur = out;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) {
        cur[p] = v;
      } else {
        if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
        cur = cur[p];
      }
    }
  }
  return out;
}

function loadEN() {
  const en = {};
  for (const ns of NAMESPACES) {
    const f = path.join(LOCALES_ROOT, "en", `${ns}.json`);
    const json = readJsonSafe(f, {});
    const flat = flatten(json);
    for (const k of Object.keys(flat)) en[`${ns}:${k}`] = flat[k];
  }
  return en;
}

function backfillLanguage(lng, enMap, useENText = true) {
  let changed = 0;
  for (const ns of NAMESPACES) {
    const f = path.join(LOCALES_ROOT, lng, `${ns}.json`);
    const json = readJsonSafe(f, {});
    const flat = flatten(json);

    // collect missing keys for this namespace vs EN
    const missing = [];
    for (const [fullKey, enVal] of Object.entries(enMap)) {
      const [enNs, rest] = fullKey.split(":");
      if (enNs !== ns) continue;
      if (!(rest in flat)) missing.push([rest, enVal]);
    }

    if (!missing.length) continue;

    // fill missing keys (copy EN text or TODO placeholder)
    for (const [k, enVal] of missing) {
      flat[k] = useENText ? enVal : "TODO: translate";
    }

    writeJson(f, unflatten(flat));
    console.log(`Backfilled ${lng}/${ns}.json  +${missing.length}`);
    changed += missing.length;
  }
  return changed;
}

(function run() {
  const enMap = loadEN();
  if (!Object.keys(enMap).length) {
    console.error("ERROR: EN baseline empty. Check /client/public/locales/en/*.json");
    process.exitCode = 2;
    return;
  }
  // default: copy EN text as fallback; switch to false to write TODOs instead
  const useENText = true;

  let total = 0;
  for (const lng of SUPPORTED) {
    if (lng === "en") continue;
    total += backfillLanguage(lng, enMap, useENText);
  }
  console.log(`\nDone. Backfilled ${total} missing key(s) across locales.`);
})();
