// PATH: scripts/i18nNormalizeBodyType.mjs

// --- REPLACE START: normalize bodyType keys across locales, fix EN baseline, drop dotted extras ---
/* eslint-disable no-console */
/* Node ESM script */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.resolve(ROOT, "client", "public", "locales");

const BODY_TYPE_KEYS = ["athletic", "normal", "obese", "overweight", "thin"];
const SUPPORTED = [
  "en","fi","sv","de","fr","es","it","pt","pl","ro","tr","nl","no","da","cs","sk",
  "hu","et","lt","lv","bg","el","uk","ru","ja","ko","zh","ar","he","hi","sw","ur"
];

function readJson(file, fallback = undefined) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const txt = fs.readFileSync(file, "utf8");
    if (!txt.trim()) return fallback;
    return JSON.parse(txt);
  } catch (e) {
    console.error("ERROR: Failed to read JSON:", file, e.message);
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function toTitle(s) {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

function withTodo(val) {
  return String(val) + "  // TODO: translate";
}

/**
 * Ensure profile.bodyType is an object (not a string),
 * ensure subkeys exist, and drop dotted extras.
 */
function normalizeFile(lng, file) {
  const json = readJson(file, {});
  if (!json || typeof json !== "object") return { ok: false, reason: "parse" };

  json.profile = json.profile && typeof json.profile === "object" ? json.profile : {};

  // Capture any dotted keys BEFORE changing structure
  const dotted = {};
  for (const k of BODY_TYPE_KEYS) {
    const dk = `bodyType.${k}`;
    if (Object.prototype.hasOwnProperty.call(json.profile, dk)) {
      dotted[k] = json.profile[dk];
    }
  }

  // If bodyType is a string → convert to object while preserving old value
  if (typeof json.profile.bodyType === "string") {
    const legacy = json.profile.bodyType;
    json.profile.bodyType = { _legacy: legacy };
  } else if (json.profile.bodyType == null || typeof json.profile.bodyType !== "object") {
    json.profile.bodyType = {};
  }

  // Fill subkeys
  for (const k of BODY_TYPE_KEYS) {
    const existing = json.profile.bodyType[k];
    if (existing == null) {
      // Prefer dotted value if exists, otherwise fallback
      const fromDotted = dotted[k];
      if (fromDotted != null) {
        json.profile.bodyType[k] = fromDotted;
      } else {
        // Fallbacks: EN in English; others English + TODO
        const base = toTitle(k);
        json.profile.bodyType[k] = lng === "en" ? base : withTodo(base);
      }
    }
  }

  // Drop dotted extras from profile
  for (const k of BODY_TYPE_KEYS) {
    const dk = `bodyType.${k}`;
    if (Object.prototype.hasOwnProperty.call(json.profile, dk)) {
      delete json.profile[dk];
    }
  }

  // Special: If some locales had stray "profile.bodyType" missing entirely in audit,
  // that was because EN baseline had it as a string. We've now ensured EN also has an object.

  writeJson(file, json);
  return { ok: true };
}

function run() {
  let changed = 0;
  let failed = 0;

  for (const lng of SUPPORTED) {
    const file = path.join(LOCALES_ROOT, lng, "translation.json");
    if (!fs.existsSync(file)) continue;
    const res = normalizeFile(lng, file);
    if (res.ok) {
      console.log(`Normalized: ${lng}/translation.json`);
      changed++;
    } else {
      console.warn(`Skipped (parse error): ${lng}/translation.json`);
      failed++;
    }
  }

  console.log(
    `\nDone. Updated ${changed} locale file(s)` +
      (failed ? `, ${failed} failed.` : ".")
  );
  console.log("\nNext:\n  npm run i18n:sync\n  npm run i18n:audit");
}

run();
// --- REPLACE END ---
