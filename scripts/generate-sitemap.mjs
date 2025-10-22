// File: scripts/generate-sitemap.mjs
// --- REPLACE START: thin shim that delegates to client script ---
// Purpose: allow running `node scripts/generate-sitemap.mjs` from repo root.
// It simply imports and executes the real generator in client/.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const target = resolve("client/scripts/generate-sitemap.mjs");
await import(pathToFileURL(target).href);
// --- REPLACE END ---
