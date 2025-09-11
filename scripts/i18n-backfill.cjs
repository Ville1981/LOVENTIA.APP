// scripts/i18n-backfill.js
// --- REPLACE START: fill common.lang.* with flags (incl. regional variants) + group labels + hero.title ---
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "client", "public", "locales");

// Lipulliset nimet KAIKILLE koodeille (peruskielet + aluevariantit)
const LABELS = {
  // Core languages
  "en": "🇬🇧 English",
  "es": "🇪🇸 Español",
  "pt": "🇵🇹 Português",
  "fr": "🇫🇷 Français",
  "de": "🇩🇪 Deutsch",
  "el": "🇬🇷 Ελληνικά",
  "it": "🇮🇹 Italiano",
  "ru": "🇷🇺 Русский",
  "pl": "🇵🇱 Polski",
  "sv": "🇸🇪 Svenska",
  "fi": "🇫🇮 Suomi",
  "tr": "🇹🇷 Türkçe",
  "nl": "🇳🇱 Nederlands",
  "no": "🇳🇴 Norsk",
  "da": "🇩🇰 Dansk",
  "cs": "🇨🇿 Čeština",
  "sk": "🇸🇰 Slovenčina",
  "hu": "🇭🇺 Magyar",
  "et": "🇪🇪 Eesti",
  "lt": "🇱🇹 Lietuvių",
  "lv": "🇱🇻 Latviešu",
  "bg": "🇧🇬 Български",
  "ro": "🇷🇴 Română",
  "uk": "🇺🇦 Українська",
  "ar": "🇸🇦 العربية",
  "he": "🇮🇱 עברית",
  "zh": "🇨🇳 中文",
  "ja": "🇯🇵 日本語",
  "ko": "🇰🇷 한국어",
  "hi": "🇮🇳 हिन्दी",
  "ur": "🇵🇰 اردو",
  "sw": "🇰🇪 Kiswahili",

  // Regional variants you listed
  "en-GB": "🇬🇧 English (UK)",
  "en-US": "🇺🇸 English (US)",
  "es-ES": "🇪🇸 Español (España)",
  "es-AR": "🇦🇷 Español (Argentina)",
  "es-CO": "🇨🇴 Español (Colombia)",
  "es-MX": "🇲🇽 Español (México)",
  "pt-BR": "🇧🇷 Português (Brasil)",
};

// Ryhmäotsikot (jos haluat näyttää ne i18n:n kautta LanguageSwitcherissa)
const GROUP_LABELS = {
  europe: "🇪🇺 EUROPE",
  northAmerica: "🇺🇸 NORTH AMERICA",
  southAmerica: "🌎 SOUTH AMERICA",
  southAsia: "🌏 SOUTH ASIA",
  middleEast: "🌍 MIDDLE EAST",
  eastAsia: "🌏 EAST ASIA",
  africa: "🌍 AFRICA",
};

// Oletus otsikko Herolle, jos translation.hero.title puuttuu
const DEFAULT_HERO_TITLE = "Meet kind singles near you";

function readJsonSafe(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error("Failed to parse JSON:", file, e.message);
    return {};
  }
}

function writeJsonPretty(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function ensureCommon(localeDir) {
  const p = path.join(localeDir, "common.json");
  const json = readJsonSafe(p);

  if (!json.lang || typeof json.lang !== "object") json.lang = {};
  if (!json.langGroups || typeof json.langGroups !== "object") json.langGroups = {};

  // Lisää kaikki puuttuvat lang-labelit (älä ylikirjoita olemassa olevia)
  for (const [code, label] of Object.entries(LABELS)) {
    if (json.lang[code] == null) json.lang[code] = label;
  }

  // Lisää ryhmäotsikot, jos puuttuvat
  for (const [key, label] of Object.entries(GROUP_LABELS)) {
    if (json.langGroups[key] == null) json.langGroups[key] = label;
  }

  writeJsonPretty(p, json);
}

function ensureTranslation(localeDir) {
  const p = path.join(localeDir, "translation.json");
  const json = readJsonSafe(p);

  if (!json.hero || typeof json.hero !== "object") json.hero = {};
  if (json.hero.title == null || typeof json.hero.title !== "string") {
    json.hero.title = DEFAULT_HERO_TITLE;
  }

  writeJsonPretty(p, json);
}

function run() {
  if (!fs.existsSync(LOCALES_DIR)) {
    console.error("Locales directory not found:", LOCALES_DIR);
    process.exit(1);
  }

  const langs = fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log("Detected locales:", langs.join(", "));

  langs.forEach((lng) => {
    const dir = path.join(LOCALES_DIR, lng);
    ensureCommon(dir);
    ensureTranslation(dir);
    console.log(`Patched: ${lng}`);
  });

  console.log("Done.");
}

run();
// --- REPLACE END ---
