// PATH: client/scripts/i18nAudit.mjs

// --- REPLACE START: shim that delegates to repo-root canonical i18n audit ---
//
// Purpose:
// - Keep client/package.json script stable: "node scripts/i18nAudit.mjs"
// - Keep ONE canonical implementation in repo root: scripts/i18nAudit.mjs
// - Work in CI (working-directory: client) and locally (Windows/macOS/Linux)
//
// This file is intentionally a thin wrapper. Do not add audit logic here.
// Canonical implementation: ../../scripts/i18nAudit.mjs
//
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// From: client/scripts/i18nAudit.mjs  ->  repoRoot/scripts/i18nAudit.mjs
const CANONICAL = path.resolve(__dirname, "..", "..", "scripts", "i18nAudit.mjs");

if (!fs.existsSync(CANONICAL)) {
  console.error(`[i18nAudit shim] ERROR: canonical script not found: ${CANONICAL}`);
  console.error("[i18nAudit shim] Expected repo-root path: scripts/i18nAudit.mjs");
  process.exit(2);
}

console.log(`[i18nAudit shim] Delegating to: ${CANONICAL}`);

const res = spawnSync(process.execPath, [CANONICAL, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(typeof res.status === "number" ? res.status : 1);
// --- REPLACE END ---
