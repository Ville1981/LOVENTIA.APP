// PATH: scripts/i18nAddKey.mjs

/* eslint-disable no-console */
/* Node ESM script */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ROOT         = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.join(ROOT, "client", "public", "locales");

// Keep in sync with your project
const SUPPORTED = [
  "en","fi","sv","de","fr","es","it","pt","pl","ro","tr","nl","no","da","cs","sk",
  "hu","et","lt","lv","bg","el","uk","ru","ja","ko","zh","ar","he","hi","sw","ur",
];

// ---- Configure the missing key(s) here ----
const NS        = "translation";
const DOT_PATHS = ["profile.bodyType"];
const EN_VALUE  = "Body type"; // default fallback if EN is missing
// ------------------------------------------

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
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
function writeJson(file, data) {
  ensureDirSync(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}
function hasDot(obj, dotPath) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return false;
    cur = cur[p];
  }
  return true;
}
function setDot(obj, dotPath, value) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const last = i === parts.length - 1;
    if (last) {
      cur[p] = value;
    } else {
      if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
      cur = cur[p];
    }
  }
}
function getDot(obj, dotPath, dflt) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return dflt;
    cur = cur[p];
  }
  return cur;
}

function syncEnglish() {
  const enFile = path.join(LOCALES_ROOT, "en", `${NS}.json`);
  const enJson = readJsonSafe(enFile, {});
  let changed = false;

  for (const key of DOT_PATHS) {
    if (!hasDot(enJson, key)) {
      setDot(enJson, key, EN_VALUE);
      changed = true;
      console.log(`[en] added ${NS}:${key} = "${EN_VALUE}"`);
    }
  }
  if (changed) writeJson(enFile, enJson);
}
function run() {
  // 1) Ensure English has the key(s)
  syncEnglish();

  // Load final EN value (after ensuring)
  const enFile = path.join(LOCALES_ROOT, "en", `${NS}.json`);
  const enJson = readJsonSafe(enFile, {});
  const enMap  = Object.fromEntries(DOT_PATHS.map(k => [k, getDot(enJson, k, EN_VALUE)]));

  // 2) Fill missing keys for other languages
  for (const lng of SUPPORTED) {
    if (lng === "en") continue;

    const file = path.join(LOCALES_ROOT, lng, `${NS}.json`);
    const json = readJsonSafe(file, {});
    let changed = false;

    for (const key of DOT_PATHS) {
      if (!hasDot(json, key)) {
        const base = String(enMap[key] ?? EN_VALUE);
        const val  = `${base}  // TODO: translate`;
        setDot(json, key, val);
        changed = true;
        console.log(`[${lng}] added ${NS}:${key}`);
      }
    }

    if (changed) writeJson(file, json);
  }

  console.log("\nDone. Now run:\n  npm run i18n:audit\n");
}

run();
