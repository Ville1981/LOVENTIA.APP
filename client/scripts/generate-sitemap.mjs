// PATH: client/scripts/generate-sitemap.mjs

// --- REPLACE START: single, robust sitemap generator (runs from client/) ---
// Purpose:
//  - Generate client/public/sitemap.xml for the SPA.
//  - Works when run from client/ (default via npm prebuild) and also from repo root.
// Usage:
//  - node client/scripts/generate-sitemap.mjs (from repo root)
//  - node ./scripts/generate-sitemap.mjs       (from client/)
// Env (first match wins):
//  - SITEMAP_BASE_URL, SITE_URL, VITE_SITE_URL, CLIENT_URL
//  Fallback: http://localhost:5173

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Resolve paths robustly regardless of where the script is launched from */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The client directory is one level up from this script file
//   e.g. <repo>/client/scripts/generate-sitemap.mjs  → clientDir = <repo>/client
const clientDir = resolve(__dirname, "..");

// If someone runs from repo root, process.cwd() = <repo>
// If from client/, process.cwd() = <repo>/client
// We'll prefer clientDir (derived from file location) to avoid ambiguity.
const publicDir = resolve(clientDir, "public");
const outFile = resolve(publicDir, "sitemap.xml");

/** Determine canonical base URL */
const BASE_URL =
  process.env.SITEMAP_BASE_URL ||
  process.env.SITE_URL ||
  process.env.VITE_SITE_URL ||
  process.env.CLIENT_URL ||
  "http://localhost:5173";

/** Public, indexable routes only (extend safely as needed) */
const ROUTES = [
  "/", // Home / Landing
  "/discover", // Discover feed
  "/subscriptions", // Billing / Plans
  "/privacy", // Privacy Policy
  "/cookies", // Cookie Policy
  "/terms", // Terms of Service
  "/login",
  "/register",

  // Sitemap 2.0: additional key app routes
  "/messages",
  "/likes",
  "/settings/profile",
  "/settings/subscriptions",
];

/** Utility: build a fully-qualified URL from BASE_URL + path */
function toAbsUrl(pathname) {
  const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
  return new URL(pathname.replace(/^\//, ""), base).toString();
}

/** XML escape */
function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const isoNow = new Date().toISOString();

/** Build one <url> entry */
function buildUrlEntry(path) {
  const loc = toAbsUrl(path);
  const priority = path === "/" ? "1.0" : "0.7";
  return `  <url>
    <loc>${esc(loc)}</loc>
    <lastmod>${esc(isoNow)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/** Assemble the full XML */
const body = ROUTES.map(buildUrlEntry).join("\n");
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- generated: ${isoNow} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

/** Ensure destination exists and write */
mkdirSync(publicDir, { recursive: true });
writeFileSync(outFile, xml, "utf8");

console.log(`[sitemap] Base: ${BASE_URL}`);
console.log(
  `[sitemap] Wrote ${join("client", "public", "sitemap.xml")} with ${
    ROUTES.length
  } routes`
);
// --- REPLACE END ---


