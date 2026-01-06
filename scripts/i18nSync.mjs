// PATH: scripts/i18nSync.mjs

// --- REPLACE START: robust i18n sync that tolerates string↔object collisions & safe README write ---
/* eslint-disable no-console */
/* Node ESM script */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

/**
 * This script syncs non-English locale files against English baselines.
 * - Source of truth: client/public/locales/en/{ns}.json
 * - Target dirs   : client/public/locales/{lng}/{ns}.json for each supported lng
 * - On missing keys: adds them (defaults to EN for critical UI, otherwise TODO placeholders)
 * - On shape conflict (string vs object): preserves old string as `_legacy` and expands object keys
 * - Safe README write: only creates file if not present
 *
 * Special rules (requested):
 * - Ensure likes.json.subtitle exists in every locale:
 *     - If locale already has subtitle -> keep it
 *     - Else fallback to EN subtitle (no TODO markers)
 * - Ensure translation.json has:
 *     - etusivu.heroTekstit (array)
 *     - home.texts (array)
 *   but build arrays from existing locale translations if found (do NOT overwrite):
 *     - Prefer locale arrays if present
 *     - Else build from hero.0/1/2 or etusivu.heroTekstit.0/1/2 (flat keys) when available
 *     - Only fill missing items from EN (avoid copying EN unnecessarily)
 */

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from scripts/ (adjust here if your repo differs)
const ROOT = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.resolve(ROOT, "client", "public", "locales");

// Namespaces kept in sync – align with i18n init
const NAMESPACES = [
  "common",
  "profile",
  "lifestyle",
  "discover",
  "chat",
  "navbar",
  "footer",
  "translation",
  // Ensure likes.json is also synced (subtitle requirement)
  "likes",
];

// Supported languages – align with i18n init (English is source of truth)
const SUPPORTED = [
  "en",
  "fi",
  "sv",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "pl",
  "ro",
  "tr",
  "nl",
  "no",
  "da",
  "cs",
  "sk",
  "hu",
  "et",
  "lt",
  "lv",
  "bg",
  "el",
  "uk",
  "ru",
  "ja",
  "ko",
  "zh",
  "ar",
  "he",
  "hi",
  "sw",
  "ur",
];

/* ------------------------- FS helpers ------------------------- */
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`WARN: Could not read JSON ${filePath}:`, e.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  ensureDirSync(dir);
  const out = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(filePath, out, "utf8");
}

/** Append " // TODO: translate" only when generating placeholder strings. */
function todo(val) {
  return String(val) + "  // TODO: translate";
}

/* ------------------------- Small helpers (no data loss) ------------------------- */
function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function getDeep(obj, parts) {
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function setDeep(obj, parts, value) {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isPlainObject(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function coerceArrayOfStrings(val) {
  if (Array.isArray(val)) {
    const out = val.map((v) => (typeof v === "string" ? v : String(v))).filter(Boolean);
    return out.length ? out : null;
  }
  return null;
}

/* ------------------------- Deep sync logic ------------------------- */
/**
 * Walk the English (source) object and ensure target has all keys.
 * Handles three cases:
 * 1) en: string,  tgt: missing      → add placeholder string
 * 2) en: object,  tgt: missing      → clone shape with TODO placeholders
 * 3) en & tgt both objects          → recurse
 * 4) en: object,  tgt: string       → promote tgt to object: { _legacy: "<old>" , ...newKeys }
 * 5) en: string,  tgt: object       → keep object (assume local customization)
 */
function syncNode(enNode, tgtNode) {
  // If English is a string or number or boolean → treat as leaf
  if (typeof enNode !== "object" || enNode === null) {
    if (tgtNode === undefined) return todo(enNode);
    // If target already exists: keep as-is (respect existing translations)
    return tgtNode;
  }

  // English is object
  const out = {};
  const enKeys = Object.keys(enNode);

  // If target is string → structure conflict: preserve as _legacy
  if (typeof tgtNode === "string") {
    out._legacy = tgtNode;
  } else if (typeof tgtNode === "number" || typeof tgtNode === "boolean") {
    out._legacy = String(tgtNode);
  } else if (tgtNode && typeof tgtNode === "object") {
    // keep object; merge later
  } else {
    // no target → start empty object, will fill
  }

  for (const k of enKeys) {
    const enVal = enNode[k];
    const tgtVal = tgtNode && typeof tgtNode === "object" ? tgtNode[k] : undefined;

    if (typeof enVal === "object" && enVal !== null) {
      // nested object
      if (tgtVal === undefined) {
        // Build a whole nested skeleton with TODOs
        out[k] = cloneSkeleton(enVal);
      } else if (typeof tgtVal === "object" && tgtVal !== null) {
        out[k] = syncNode(enVal, tgtVal);
      } else {
        // target is primitive → conflict; preserve old into _legacy and expand
        out[k] = { _legacy: String(tgtVal ?? ""), ...cloneSkeleton(enVal) };
      }
    } else {
      // leaf in English
      if (tgtVal === undefined) {
        out[k] = todo(enVal);
      } else {
        // keep existing translation
        out[k] = tgtVal;
      }
    }
  }

  // Also keep any extra keys that target already had (not in English), to avoid data loss
  if (tgtNode && typeof tgtNode === "object") {
    for (const extra of Object.keys(tgtNode)) {
      if (!(extra in out)) out[extra] = tgtNode[extra];
    }
  }

  return out;
}

/** Create a skeleton object with same shape as `src`, leaves replaced by TODO strings. */
function cloneSkeleton(src) {
  if (typeof src !== "object" || src === null) return todo(src);
  const out = {};
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (typeof v === "object" && v !== null) {
      out[k] = cloneSkeleton(v);
    } else {
      out[k] = todo(v);
    }
  }
  return out;
}

/* ------------------------- Special sync rules (requested) ------------------------- */
/**
 * Ensure likes.subtitle exists.
 * - Never overwrite existing locale subtitle
 * - If missing, set to EN subtitle (no TODO marker)
 */
function applySpecialLikesSubtitle(tgtMerged, tgtOriginal, enJson) {
  if (!isPlainObject(tgtMerged)) return;
  const hasSubtitle = tgtOriginal && Object.prototype.hasOwnProperty.call(tgtOriginal, "subtitle");
  if (hasSubtitle) return;

  if (!Object.prototype.hasOwnProperty.call(tgtMerged, "subtitle")) {
    // Prefer EN as requested (no TODO markers in UI)
    if (enJson && Object.prototype.hasOwnProperty.call(enJson, "subtitle")) {
      tgtMerged.subtitle = enJson.subtitle;
    }
  } else {
    // If a placeholder exists (from generic sync), replace with EN (clean UI)
    if (typeof tgtMerged.subtitle === "string" && tgtMerged.subtitle.includes("// TODO: translate")) {
      if (enJson && Object.prototype.hasOwnProperty.call(enJson, "subtitle")) {
        tgtMerged.subtitle = enJson.subtitle;
      }
    }
  }
}

/**
 * Build a 3-item hero text array from existing locale keys, then fill missing with EN.
 * Sources (locale), in priority order:
 *  - Existing array at deepPath (kept as-is)
 *  - Flat keys: "etusivu.heroTekstit.0/1/2"
 *  - Deep keys: hero["0/1/2"]
 *  - Flat keys: "hero.0/1/2"
 * Fallback:
 *  - EN array at deepPath
 */
function buildHeroArrayFromLocale(localeJson, enJson, deepPathParts, fallbackDeepPathParts) {
  const deepExisting = getDeep(localeJson, deepPathParts);
  const existingArr = coerceArrayOfStrings(deepExisting);
  if (existingArr && existingArr.length) return existingArr;

  const want = [0, 1, 2];
  const out = [];

  // Flat keys like "etusivu.heroTekstit.0"
  const flatPrefix = deepPathParts.join(".");
  for (const i of want) {
    const k = `${flatPrefix}.${i}`;
    const v = localeJson && Object.prototype.hasOwnProperty.call(localeJson, k) ? localeJson[k] : undefined;
    if (typeof v === "string" && v.trim()) out[i] = v;
  }

  // Deep hero["0/1/2"]
  for (const i of want) {
    if (out[i]) continue;
    const v = getDeep(localeJson, ["hero", String(i)]);
    if (typeof v === "string" && v.trim()) out[i] = v;
  }

  // Flat "hero.0/1/2"
  for (const i of want) {
    if (out[i]) continue;
    const k = `hero.${i}`;
    const v = localeJson && Object.prototype.hasOwnProperty.call(localeJson, k) ? localeJson[k] : undefined;
    if (typeof v === "string" && v.trim()) out[i] = v;
  }

  // If we found nothing at all, fallback to EN array
  const anyFound = out.some((x) => typeof x === "string" && x.trim());
  const enArr = coerceArrayOfStrings(getDeep(enJson, fallbackDeepPathParts));
  if (!anyFound) return enArr || [];

  // Fill missing items from EN to avoid copying EN unnecessarily
  for (const i of want) {
    if (!out[i] && enArr && enArr[i]) out[i] = enArr[i];
  }

  // Compact + ensure strings
  return out.filter((v) => typeof v === "string" && v.trim());
}

/**
 * Ensure translation arrays exist:
 * - etusivu.heroTekstit (array)
 * - home.texts (array)
 * Rule: Do NOT overwrite existing locale arrays; only create if missing/invalid.
 * Build arrays from locale keys first, then fill missing from EN.
 */
function applySpecialTranslationHeroArrays(tgtMerged, tgtOriginal, enJson) {
  if (!isPlainObject(tgtMerged)) return;

  // etusivu.heroTekstit
  {
    const origArr = coerceArrayOfStrings(getDeep(tgtOriginal, ["etusivu", "heroTekstit"]));
    const mergedArr = coerceArrayOfStrings(getDeep(tgtMerged, ["etusivu", "heroTekstit"]));
    if (!origArr && !mergedArr) {
      const arr = buildHeroArrayFromLocale(
        tgtOriginal || tgtMerged,
        enJson,
        ["etusivu", "heroTekstit"],
        ["etusivu", "heroTekstit"]
      );
      if (arr && arr.length) setDeep(tgtMerged, ["etusivu", "heroTekstit"], arr);
    }
  }

  // home.texts
  {
    const origArr = coerceArrayOfStrings(getDeep(tgtOriginal, ["home", "texts"]));
    const mergedArr = coerceArrayOfStrings(getDeep(tgtMerged, ["home", "texts"]));
    if (!origArr && !mergedArr) {
      // Try build from locale home.texts.* first; if empty, allow hero sources too.
      const arr = buildHeroArrayFromLocale(
        tgtOriginal || tgtMerged,
        enJson,
        ["home", "texts"],
        ["home", "texts"]
      );
      if (arr && arr.length) setDeep(tgtMerged, ["home", "texts"], arr);
    }
  }

  // Clean up: if generic sync produced TODO markers in arrays, prefer EN items (UI cleanliness)
  // (Only when locale didn't have real items)
  const enEtusivuArr = coerceArrayOfStrings(getDeep(enJson, ["etusivu", "heroTekstit"])) || [];
  const enHomeArr = coerceArrayOfStrings(getDeep(enJson, ["home", "texts"])) || [];

  const curEtusivu = getDeep(tgtMerged, ["etusivu", "heroTekstit"]);
  if (Array.isArray(curEtusivu)) {
    const cleaned = curEtusivu.map((v, i) => {
      if (typeof v === "string" && v.includes("// TODO: translate")) return enEtusivuArr[i] || v.replace("  // TODO: translate", "");
      return v;
    });
    setDeep(tgtMerged, ["etusivu", "heroTekstit"], cleaned);
  }

  const curHome = getDeep(tgtMerged, ["home", "texts"]);
  if (Array.isArray(curHome)) {
    const cleaned = curHome.map((v, i) => {
      if (typeof v === "string" && v.includes("// TODO: translate")) return enHomeArr[i] || v.replace("  // TODO: translate", "");
      return v;
    });
    setDeep(tgtMerged, ["home", "texts"], cleaned);
  }
}

/* ------------------------- Per-namespace sync ------------------------- */
function syncNamespace(lng, ns) {
  const enFile = path.join(LOCALES_ROOT, "en", `${ns}.json`);
  const tgtFile = path.join(LOCALES_ROOT, lng, `${ns}.json`);

  const enJson = readJson(enFile, {});
  const tgtJson = readJson(tgtFile, undefined);

  // If English file missing → nothing to sync
  if (!Object.keys(enJson).length) {
    return { status: "skip-en-missing", file: tgtFile };
  }

  // If no target → just write skeleton with TODOs based on English
  if (tgtJson === undefined) {
    const filled = syncNode(enJson, undefined);

    // Apply special rules after generic sync
    if (ns === "likes") applySpecialLikesSubtitle(filled, undefined, enJson);
    if (ns === "translation") applySpecialTranslationHeroArrays(filled, undefined, enJson);

    writeJson(tgtFile, filled);
    return { status: "added", file: tgtFile };
  }

  // Otherwise merge/sync
  const merged = syncNode(enJson, tgtJson);

  // Apply special rules after generic sync (do not overwrite real translations)
  if (ns === "likes") applySpecialLikesSubtitle(merged, tgtJson, enJson);
  if (ns === "translation") applySpecialTranslationHeroArrays(merged, tgtJson, enJson);

  // Detect changes
  const before = JSON.stringify(tgtJson);
  const after = JSON.stringify(merged);
  if (before === after) {
    return { status: "equal", file: tgtFile };
  } else {
    writeJson(tgtFile, merged);
    return { status: "updated", file: tgtFile };
  }
}

/* ------------------------- README ------------------------- */
function ensureReadmeOnce() {
  const readmePath = path.join(LOCALES_ROOT, "README_LOCALES.txt");
  const dir = path.dirname(readmePath);
  ensureDirSync(dir);

  if (!fs.existsSync(readmePath)) {
    const content = [
      "Locales directory structure:",
      "  /client/public/locales/{lng}/{ns}.json",
      "",
      "Use scripts:",
      "  npm run i18n:audit   # show coverage",
      "  npm run i18n:sync    # add missing keys with TODO placeholders",
      "",
      "Rules:",
      "- English is the source of truth.",
      "- When a key is an object in English but a string in a translation, the old string is kept in `_legacy` and the object keys are added with TODO placeholders.",
      "- Do not remove `_legacy` unless you manually migrate its value.",
      "",
    ].join("\n");
    fs.writeFileSync(readmePath, content, "utf8");
    console.log("==> README_LOCALES.txt created");
  } else {
    // no-op
  }
}

/* ------------------------- Main ------------------------- */
function formatResult(ns, res) {
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
  let tag = "[=]";
  if (res.status === "updated") tag = "[~]";
  if (res.status === "added") tag = "[+]";
  if (res.status === "skip-en-missing") tag = "[×]";
  return `  ${tag} ${pad(ns + ".json", 14)} ${res.status === "equal" ? "up-to-date" : res.status}`;
}

function syncLanguage(lng) {
  console.log(`\n==> Sync ${lng}`);
  for (const ns of NAMESPACES) {
    const res = syncNamespace(lng, ns);
    console.log(formatResult(ns, res));
  }
}

(async function run() {
  ensureDirSync(LOCALES_ROOT);

  // Always ensure English exists (it is the baseline)
  const enDir = path.join(LOCALES_ROOT, "en");
  if (!fs.existsSync(enDir)) {
    console.error(`ERROR: English baseline missing at ${enDir}`);
    process.exitCode = 2;
    return;
  }

  // Make sure README exists without throwing if it already exists
  ensureReadmeOnce();

  // Sync each language except 'en'
  for (const lng of SUPPORTED) {
    if (lng === "en") continue;
    syncLanguage(lng);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
// --- REPLACE END ---


