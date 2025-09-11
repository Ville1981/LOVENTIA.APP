// File: scripts/i18n-backfill-etusivu-array.cjs
// --- REPLACE START: ensure etusivu.heroTekstit[0..2] exists for every locale ---
// CommonJS script (works even if package.json has "type": "module")

const fs = require("fs");
const path = require("path");

// Adjust if your locales live elsewhere:
const LOCALES_DIR = path.join(__dirname, "..", "client", "public", "locales");

// English defaults (fallbacks when a translation is missing)
const DEFAULTS = [
  "Find love that lasts.",
  "Meet people who share your values.",
  "Your next match is one click away.",
];

function readJsonSafe(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error("[WARN] Failed to parse JSON:", file, "-", e.message);
    return {};
  }
}

function writeJsonPretty(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function coalesceString(v, fallback) {
  return typeof v === "string" && v.trim().length ? v : fallback;
}

/**
 * Choose which namespace file to patch for a given locale.
 * Priority: translation.json → common.json → create translation.json.
 */
function pickNamespaceFile(localeDir) {
  const t = path.join(localeDir, "translation.json");
  const c = path.join(localeDir, "common.json");
  if (fs.existsSync(t)) return t;
  if (fs.existsSync(c)) return c;
  return t; // default target to create if neither exists
}

/**
 * Ensure etusivu.heroTekstit is an array of 3 strings.
 * Sources (in priority order):
 *  1) Existing json.etusivu.heroTekstit (pad/clean to 3)
 *  2) Flat keys "etusivu.heroTekstit.0/1/2"
 *  3) hero.{0,1,2}
 *  4) hero.title as first line
 *  5) DEFAULTS
 */
function ensureEtusivuArray(localeDir) {
  const nsFile = pickNamespaceFile(localeDir);
  const json = readJsonSafe(nsFile);

  // Case 1: Already an array → normalize length and fill defaults
  if (json.etusivu && Array.isArray(json.etusivu.heroTekstit)) {
    const arr = json.etusivu.heroTekstit.slice(0, 3);
    for (let i = 0; i < 3; i++) {
      arr[i] = coalesceString(arr[i], DEFAULTS[i]);
    }
    json.etusivu.heroTekstit = arr;
    writeJsonPretty(nsFile, json);
    return { file: nsFile, from: "existing_array" };
  }

  // Build new array from available sources
  const arr = new Array(3);

  // Case 2: Flat keys
  const flat0 = json["etusivu.heroTekstit.0"];
  const flat1 = json["etusivu.heroTekstit.1"];
  const flat2 = json["etusivu.heroTekstit.2"];
  if (flat0 || flat1 || flat2) {
    arr[0] = coalesceString(flat0, DEFAULTS[0]);
    arr[1] = coalesceString(flat1, DEFAULTS[1]);
    arr[2] = coalesceString(flat2, DEFAULTS[2]);
    // Optional cleanup of flat keys
    delete json["etusivu.heroTekstit.0"];
    delete json["etusivu.heroTekstit.1"];
    delete json["etusivu.heroTekstit.2"];
  }

  // Case 3: hero.{0,1,2} block
  if (!arr[0] && json.hero && (json.hero["0"] || json.hero["1"] || json.hero["2"])) {
    arr[0] = coalesceString(json.hero["0"], DEFAULTS[0]);
    arr[1] = coalesceString(json.hero["1"], DEFAULTS[1]);
    arr[2] = coalesceString(json.hero["2"], DEFAULTS[2]);
  }

  // Case 4: hero.title as first line
  if (!arr[0] && json.hero && typeof json.hero.title === "string") {
    arr[0] = coalesceString(json.hero.title, DEFAULTS[0]);
  }

  // Fill any remaining holes with defaults
  for (let i = 0; i < 3; i++) {
    if (!arr[i]) arr[i] = DEFAULTS[i];
  }

  // Write nested array into etusivu.heroTekstit
  if (!json.etusivu || typeof json.etusivu !== "object") {
    json.etusivu = {};
  }
  json.etusivu.heroTekstit = arr;

  writeJsonPretty(nsFile, json);
  return { file: nsFile, from: "constructed" };
}

function run() {
  if (!fs.existsSync(LOCALES_DIR)) {
    console.error("[ERROR] Locales directory not found:", LOCALES_DIR);
    process.exit(1);
  }

  const langs = fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  console.log("Detected locales:", langs.join(", "));

  for (const lng of langs) {
    const dir = path.join(LOCALES_DIR, lng);
    const { file, from } = ensureEtusivuArray(dir);
    console.log(`Patched ${lng} → ${path.basename(file)} (${from})`);
  }

  console.log("Done.");
}

run();
// --- REPLACE END ---
