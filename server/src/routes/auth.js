// PATH: server/src/routes/auth.js
// CLEAN A-VERSION — simple, deterministic, Windows-safe auth shim
// @ts-nocheck

import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------
// Candidate absolute paths where the REAL auth router may live
// -------------------------------------------------------------
const candidates = [
  // canonical project structure
  path.join(__dirname, "../../routes/auth.js"),

  // fallback if directory depth differs
  path.join(__dirname, "../routes/auth.js"),

  // full explicit fallback from repo root
  path.join(process.cwd(), "server/routes/auth.js"),
];

let resolved = null;

for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    resolved = candidate;
    console.log(`[auth-shim] Using real auth router from: ${candidate}`);
    break;
  }
}

if (!resolved) {
  console.error("[auth-shim] ERROR: Could not locate server/routes/auth.js");
  console.error("Checked paths:", candidates);
  throw new Error("Auth shim resolution failed");
}

// -------------------------------------------------------------
// Convert Windows path -> valid file:// URL for ESM dynamic import
// -------------------------------------------------------------
const url = pathToFileURL(resolved).href;

// Dynamically import the real router
const real = await import(url);
const router = real.default || real.router;

if (!router) {
  console.error("[auth-shim] ERROR: real auth module exported no router");
  throw new Error("Auth shim: No router export in target module");
}

// Final export: ONLY the resolved router
export default router;

