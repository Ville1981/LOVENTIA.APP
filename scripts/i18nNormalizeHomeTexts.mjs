// Node ESM
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.resolve(ROOT, "client", "public", "locales");

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

function asKeyObjectFromArray(arr) {
  // Convert ["a","b","c"] -> {"0":"a","1":"b","2":"c"}
  const out = {};
  arr.forEach((v, i) => { out[String(i)] = v; });
  return out;
}

function ensureHomeTextsShape(obj, enCount) {
  if (!obj.home) obj.home = {};
  const t = obj.home.texts;

  // If array -> convert to keyed object
  if (Array.isArray(t)) {
    obj.home.texts = asKeyObjectFromArray(t);
  } else if (t == null) {
    obj.home.texts = {};
  } else if (typeof t !== "object") {
    // weird type, reset to object
    obj.home.texts = {};
  }

  // Fill missing keys 0..N-1 with TODO placeholder
  for (let i = 0; i < enCount; i++) {
    const k = String(i);
    if (!(k in obj.home.texts)) {
      obj.home.texts[k] = "TODO: translate";
    }
  }
}

(function run() {
  const enFile = path.join(LOCALES_ROOT, "en", "translation.json");
  const en = readJsonSafe(enFile, {});
  const enTexts = en?.home?.texts ?? [];
  const enCount = Array.isArray(enTexts) ? enTexts.length
                  : (enTexts && typeof enTexts === "object" ? Object.keys(enTexts).length : 0);

  if (enCount === 0) {
    console.error("ERROR: EN home.texts not found in translation.json — nothing to normalize.");
    process.exitCode = 2;
    return;
  }

  let changed = 0;
  for (const lng of SUPPORTED) {
    if (lng === "en") continue;
    const f = path.join(LOCALES_ROOT, lng, "translation.json");
    const json = readJsonSafe(f, {});
    const before = JSON.stringify(json);
    ensureHomeTextsShape(json, enCount);
    const after = JSON.stringify(json);
    if (before !== after) {
      writeJson(f, json);
      changed++;
      console.log(`Normalized: ${lng}/translation.json`);
    } else {
      console.log(`Up-to-date: ${lng}/translation.json`);
    }
  }
  console.log(`\nDone. Updated ${changed} file(s).`);
})();
