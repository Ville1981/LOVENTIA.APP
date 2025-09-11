// PATH: scripts/i18nFixBodyType.mjs

// --- REPLACE START: mirror EN translation.profile.bodyType subtree to all langs ---
/* eslint-disable no-console */
/* Node ESM script */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ROOT         = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.join(ROOT, "client", "public", "locales");
const NS_FILE      = "translation.json";          // audit uses .json
const DOT_PATH     = "profile.bodyType";

const SUPPORTED = [
  "en","fi","sv","de","fr","es","it","pt","pl","ro","tr","nl","no","da","cs","sk",
  "hu","et","lt","lv","bg","el","uk","ru","ja","ko","zh","ar","he","hi","sw","ur",
];

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
function getDot(obj, dotPath) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
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
function deepClone(x) {
  return x === undefined ? x : JSON.parse(JSON.stringify(x));
}

/**
 * Merge target node to match EN node shape at DOT_PATH:
 * - If EN is object:
 *   - If target is missing => deep clone EN, marking leaves with " // TODO: translate"
 *   - If target is string/number/bool => convert to object: { _legacy: "<old>", ...EN-skeleton }
 *   - If target is object => ensure it has all EN keys (recursively), keeping existing translations
 * - If EN is primitive: ensure target has at least a primitive; if missing, add "EN + TODO"
 */
function fillFromEN(enNode, tgtNode) {
  // EN is primitive -> require a primitive
  if (typeof enNode !== "object" || enNode === null) {
    if (tgtNode === undefined) return String(enNode) + "  // TODO: translate";
    return tgtNode;
  }

  // EN is object
  const makeSkeletonWithTODO = (src) => {
    const out = {};
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (typeof v === "object" && v !== null) {
        out[k] = makeSkeletonWithTODO(v);
      } else {
        out[k] = String(v) + "  // TODO: translate";
      }
    }
    return out;
  };

  // target missing
  if (tgtNode === undefined) {
    return makeSkeletonWithTODO(enNode);
  }

  // target is primitive -> preserve in _legacy and add skeleton
  if (typeof tgtNode !== "object" || tgtNode === null) {
    return {
      _legacy: String(tgtNode),
      ...makeSkeletonWithTODO(enNode),
    };
  }

  // both objects -> merge recursively
  const out = { ...tgtNode };
  for (const k of Object.keys(enNode)) {
    out[k] = fillFromEN(enNode[k], tgtNode[k]);
  }
  return out;
}

function fixAll() {
  // 1) Load EN
  const enFile = path.join(LOCALES_ROOT, "en", NS_FILE);
  const enJson = readJsonSafe(enFile, {});
  const enNode = getDot(enJson, DOT_PATH);

  if (enNode === undefined) {
    // If EN is missing, add a sensible primitive default and proceed
    setDot(enJson, DOT_PATH, "Body type");
    writeJson(enFile, enJson);
    console.log(`[en] Added missing ${NS_FILE}:${DOT_PATH} = "Body type"`);
  }

  const finalEn = getDot(readJsonSafe(enFile, {}), DOT_PATH);

  // 2) Apply to all languages
  for (const lng of SUPPORTED) {
    if (lng === "en") continue;

    const file = path.join(LOCALES_ROOT, lng, NS_FILE);
    const json = readJsonSafe(file, {});
    const cur  = getDot(json, DOT_PATH);

    const merged = fillFromEN(finalEn, cur);
    if (JSON.stringify(merged) !== JSON.stringify(cur)) {
      setDot(json, DOT_PATH, deepClone(merged));
      writeJson(file, json);
      console.log(`[${lng}] updated ${NS_FILE}:${DOT_PATH}`);
    }
  }
  console.log("\nDone. Now run:\n  npm run i18n:audit\n");
}

fixAll();
// --- REPLACE END ---
