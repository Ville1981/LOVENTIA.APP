// PATH: scripts/i18n-audit.mjs

// --- REPLACE START: legacy shim for backwards compatibility ---
//
// This file existed as an older i18n audit implementation.
// To prevent drift, it now forwards to the canonical auditor:
//
//   scripts/i18nAudit.mjs
//
// Keep this file small and stable.
// ------------------------------------------------------------

import url from "node:url";

// Importing the canonical script runs it (it uses process.argv as usual).
await import(url.pathToFileURL(new URL("./i18nAudit.mjs", import.meta.url).pathname).href);

// --- REPLACE END ---
