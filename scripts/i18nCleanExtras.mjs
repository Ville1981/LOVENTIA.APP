// --- REPLACE START: remove extra translation keys safely (keep `_legacy`), with dry-run + stats ---
/* eslint-disable no-console */
/* Node ESM script */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const LOCALES_ROOT = path.resolve(ROOT, "client", "public", "locales");

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

// Keep in sync with your build
const SUPPORTED = [
  "en","fi","sv","de","fr","es","it","pt","pl","ro","tr","nl","no","da","cs","sk",
  "hu","et","lt","lv","bg","el","uk","ru","ja","ko","zh","ar","he","hi","sw","ur",
];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run") || args.has("-n");

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

function flatten(obj, prefix = "", out = {}) {
  if (obj == null) return out;
  if (typeof obj !== "object" || Array.isArray(obj)) {
    out[prefix || ""] = obj;
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

function loadEnBaselineFlat() {
  const allow = {};
  for (const ns of NAMESPACES) {
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

function cleanOneFile(lng, ns, enAllowSet) {
  const file = path.join(LOCALES_ROOT, lng, `${ns}.json`);
  const json = readJsonSafe(file, {});
  const flat = flatten(json);

  // Build namespaced keys for comparison
  const flatNamespaced = {};
  for (const k of Object.keys(flat)) {
    flatNamespaced[`${ns}:${k}`] = flat[k];
  }

  const kept = {};
  const extras = [];
  for (const nk of Object.keys(flatNamespaced)) {
    const rawKey = nk.slice(ns.length + 1); // strip "ns:"
    // Keep if in EN or is a `_legacy` leaf
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

  const cleaned = unflatten(keptFlat);
  const before = JSON.stringify(json);
  const after = JSON.stringify(cleaned);

  if (before !== after && !DRY_RUN) {
    writeJson(file, cleaned);
  }

  return {
    file,
    changed: before !== after,
    extrasRemoved: extras.length,
    extrasSample: extras.slice(0, 5),
  };
}

function pad(s, n) {
  const str = String(s);
  return str + " ".repeat(Math.max(0, n - str.length));
}

(function run() {
  const enAllow = loadEnBaselineFlat();
  let totalRemoved = 0;
  let touchedFiles = 0;

  for (const lng of SUPPORTED) {
    if (lng === "en") continue;
    console.log(`\n==> Clean ${lng}${DRY_RUN ? " (dry-run)" : ""}`);
    for (const ns of NAMESPACES) {
      const res = cleanOneFile(lng, ns, enAllow);
      const tag = res.changed ? "[~]" : "[=]";
      const status = res.changed ? (DRY_RUN ? "would-update" : "updated") : "up-to-date";
      const fileLabel = `${ns}.json`;
      const extraInfo =
        res.extrasRemoved
          ? `  removed: ${res.extrasRemoved}${res.extrasSample.length ? ` (e.g. ${res.extrasSample.join(", ")})` : ""}`
          : "";

      console.log(`  ${tag} ${pad(fileLabel, 14)} ${status}${extraInfo}`);

      if (res.changed) {
        totalRemoved += res.extrasRemoved;
        touchedFiles += 1;
      }
    }
  }

  console.log(
    `\n${DRY_RUN ? "Would remove" : "Removed"} ${totalRemoved} extra key(s) across ${touchedFiles} file(s).`
  );
  if (DRY_RUN) {
    console.log("Run again without --dry-run to write changes.");
  }
})();
// --- REPLACE END ---
