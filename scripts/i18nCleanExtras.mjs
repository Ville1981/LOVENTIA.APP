#!/usr/bin/env node
// --- REPLACE START: remove extras + (optional) backfill missing keys, keep `_legacy`, dry-run, backups, stats ---
/* eslint-disable no-console */
/* Node ESM script */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.resolve(ROOT, "client", "public", "locales");

/**
 * Namespaces that exist in /client/public/locales/<lng>/
 * Adjust if you add/remove namespaces.
 */
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

/**
 * Keep in sync with your build (same set the app/i18n loads).
 */
const SUPPORTED = [
  "en","fi","sv","de","fr","es","it","pt","pl","ro","tr","nl","no","da","cs","sk",
  "hu","et","lt","lv","bg","el","uk","ru","ja","ko","zh","ar","he","hi","sw","ur",
];

/**
 * CLI flags:
 *  --dry-run / -n               : do not write files, only report
 *  --backfill / -b              : also add missing keys from EN with placeholder value
 *  --placeholder="__MISSING__"  : placeholder text when backfilling (default = "<TODO: translate>")
 *  --only=<ns1,ns2>             : restrict to comma-separated namespaces
 *  --only-langs=<fi,sv,...>     : restrict to comma-separated languages (en always used as baseline)
 *  --no-backup                  : do not write .bak when modifying files
 *  --verbose                    : print additional details
 */
const args = new Set(process.argv.slice(2));
const getArg = (name, def = undefined) => {
  const found = [...args].find((a) => a.startsWith(name + "="));
  return found ? found.split("=").slice(1).join("=") : def;
};
const hasArg = (name) => args.has(name);

const DRY_RUN       = hasArg("--dry-run") || hasArg("-n");
const DO_BACKFILL   = hasArg("--backfill") || hasArg("-b");
const NO_BACKUP     = hasArg("--no-backup");
const VERBOSE       = hasArg("--verbose");
const ONLY_NS_ARG   = getArg("--only");
const ONLY_LANGS    = getArg("--only-langs");
const PLACEHOLDER   = getArg("--placeholder", "<TODO: translate>");

const ONLY_NAMESPACES = ONLY_NS_ARG
  ? ONLY_NS_ARG.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

const ONLY_LANG_LIST = ONLY_LANGS
  ? ONLY_LANGS.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

/* ---------- io helpers ---------- */
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
  const out = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(file, out, "utf8");
}

function ensureBackup(file) {
  if (NO_BACKUP) return;
  const bak = `${file}.bak`;
  try {
    if (!fs.existsSync(bak)) {
      fs.copyFileSync(file, bak);
    }
  } catch {
    /* ignore */
  }
}

/* ---------- flatten/unflatten ---------- */
function flatten(obj, prefix = "", out = {}) {
  if (obj == null) return out;
  if (typeof obj !== "object" || Array.isArray(obj)) {
    if (prefix) out[prefix] = obj;
    return out;
  }
  for (const k of Object.keys(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    flatten(obj[k], next, out);
  }
  return out;
}

function unflatten(flat) {
  const result = {};
  for (const dotKey of Object.keys(flat)) {
    const val = flat[dotKey];
    if (!dotKey) continue;
    const parts = dotKey.split(".");
    let cur = result;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const last = i === parts.length - 1;
      if (last) {
        cur[p] = val;
      } else {
        if (typeof cur[p] !== "object" || cur[p] == null || Array.isArray(cur[p])) {
          cur[p] = {};
        }
        cur = cur[p];
      }
    }
  }
  return result;
}

/* ---------- baseline EN keys ---------- */
function loadEnBaselineFlat(namespaces) {
  const allow = {};
  for (const ns of namespaces) {
    const f = path.join(LOCALES_ROOT, "en", `${ns}.json`);
    const json = readJsonSafe(f, {});
    const flat = flatten(json);
    for (const k of Object.keys(flat)) {
      // store as namespaced flat key: "ns:key.path"
      allow[`${ns}:${k}`] = true;
    }
  }
  return allow;
}

/* ---------- main clean/backfill ---------- */
function cleanOneFile(lng, ns, enAllowSet) {
  const file = path.join(LOCALES_ROOT, lng, `${ns}.json`);
  const json = readJsonSafe(file, {});
  const flat = flatten(json);

  // Build namespaced keys for comparison
  const flatNamespaced = {};
  for (const k of Object.keys(flat)) {
    flatNamespaced[`${ns}:${k}`] = flat[k];
  }

  // Prepare EN keys for just this ns to detect "missing" for backfill/reporting
  const enNsKeys = Object.keys(enAllowSet)
    .filter((nk) => nk.startsWith(`${ns}:`))
    .map((nk) => nk.slice(ns.length + 1));

  const kept = {};
  const extras = [];
  for (const nk of Object.keys(flatNamespaced)) {
    const rawKey = nk.slice(ns.length + 1); // strip "ns:"
    // Keep if in EN baseline or is a `_legacy` leaf (we never delete _legacy keys)
    if (enAllowSet[nk] || rawKey.endsWith("._legacy")) {
      kept[nk] = flatNamespaced[nk];
    } else {
      extras.push(nk);
    }
  }

  // Convert back to non-namespaced flat map
  const keptFlat = {};
  for (const nk of Object.keys(kept)) {
    const rawKey = nk.slice(ns.length + 1);
    keptFlat[rawKey] = kept[nk];
  }

  // Missing keys (present in EN but absent here)
  const missing = enNsKeys.filter((k) => !(k in keptFlat));

  // Optional backfill: add missing keys with placeholder
  if (DO_BACKFILL && missing.length) {
    for (const k of missing) {
      keptFlat[k] = PLACEHOLDER;
    }
  }

  const cleaned = unflatten(keptFlat);
  const before = JSON.stringify(json);
  const after = JSON.stringify(cleaned);

  let changed = before !== after;
  if (changed && !DRY_RUN) {
    // backup once per file before writing
    if (fs.existsSync(file)) ensureBackup(file);
    writeJson(file, cleaned);
  }

  return {
    file,
    changed,
    extrasRemoved: extras.length,
    extrasSample: extras.slice(0, 5),
    missingCount: missing.length,
    missingSample: missing.slice(0, 5),
    backfilled: DO_BACKFILL ? missing.length : 0,
  };
}

function pad(s, n) {
  const str = String(s);
  return str + " ".repeat(Math.max(0, n - str.length));
}

(function run() {
  const activeNamespaces = ONLY_NAMESPACES || NAMESPACES;
  const activeLangs = ONLY_LANG_LIST
    ? SUPPORTED.filter((l) => l === "en" || ONLY_LANG_LIST.includes(l))
    : SUPPORTED;

  if (!fs.existsSync(LOCALES_ROOT)) {
    console.error(`❌ Locales root not found: ${LOCALES_ROOT}`);
    process.exit(1);
  }

  console.log(`🌍 i18n clean${DRY_RUN ? " (dry-run)" : ""} @ ${LOCALES_ROOT}`);
  console.log(`Namespaces: ${activeNamespaces.join(", ")}`);
  console.log(
    `Languages : ${activeLangs.join(", ")}  ${DO_BACKFILL ? "(with backfill)" : "(no backfill)"}`
  );
  if (DO_BACKFILL) {
    console.log(`Placeholder for backfill: ${JSON.stringify(PLACEHOLDER)}`);
  }
  if (ONLY_NAMESPACES) console.log(`(Restricted by --only=${ONLY_NAMESPACES.join(",")})`);
  if (ONLY_LANG_LIST) console.log(`(Restricted by --only-langs=${ONLY_LANG_LIST.join(",")})`);
  if (NO_BACKUP) console.log("(Backups disabled)");

  const enAllow = loadEnBaselineFlat(activeNamespaces);

  let totalRemoved = 0;
  let totalMissing = 0;
  let totalBackfilled = 0;
  let touchedFiles = 0;

  for (const lng of activeLangs) {
    if (lng === "en") continue; // EN is our baseline
    console.log(`\n==> ${lng}${DRY_RUN ? " (dry-run)" : ""}`);
    for (const ns of activeNamespaces) {
      const res = cleanOneFile(lng, ns, enAllow);
      const tag = res.changed ? "[~]" : "[=]";
      const status = res.changed ? (DRY_RUN ? "would-update" : "updated") : "up-to-date";
      const fileLabel = `${ns}.json`;

      let extraInfo = "";
      if (res.extrasRemoved) {
        extraInfo += `  removed: ${res.extrasRemoved}`;
        if (VERBOSE && res.extrasSample.length) {
          extraInfo += ` (e.g. ${res.extrasSample.join(", ")})`;
        }
      }
      if (res.missingCount) {
        extraInfo += `${extraInfo ? " |" : ""} missing: ${res.missingCount}`;
        if (VERBOSE && res.missingSample.length) {
          extraInfo += ` (e.g. ${res.missingSample.join(", ")})`;
        }
      }
      if (DO_BACKFILL && res.backfilled) {
        extraInfo += `${extraInfo ? " |" : ""} backfilled: ${res.backfilled}`;
      }

      console.log(`  ${tag} ${pad(fileLabel, 16)} ${status}${extraInfo ? "  " + extraInfo : ""}`);

      if (res.changed) touchedFiles += 1;
      totalRemoved += res.extrasRemoved;
      totalMissing += res.missingCount;
      totalBackfilled += res.backfilled;
    }
  }

  console.log(
    `\n${DRY_RUN ? "Would remove" : "Removed"} ${totalRemoved} extra key(s) across ${touchedFiles} file(s).`
  );
  if (DO_BACKFILL) {
    console.log(
      `${DRY_RUN ? "Would backfill" : "Backfilled"} ${totalBackfilled} missing key(s) with placeholder.`
    );
  } else {
    console.log(`Total missing keys (not backfilled): ${totalMissing}`);
  }
  if (DRY_RUN) {
    console.log("\nRun again without --dry-run to write changes.");
  }
})();
// --- REPLACE END ---
