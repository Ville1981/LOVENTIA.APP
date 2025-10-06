// File: server/src/models/Message.js

// --- REPLACE START: robust CJS<->ESM bridge for Message model (ESM-safe, resilient paths) ---
"use strict";

/**
 * ESM shim that reliably loads the legacy CommonJS Message model.
 *
 * Goals:
 *  - Allow `import * as MessageNS from "../models/Message.js"` (ESM) to receive the actual Mongoose model.
 *  - Resolve different legacy export styles:
 *      module.exports = Model
 *      module.exports = { Message: Model }
 *      exports.Message = Model
 *  - Be resilient to varying runtime working directories and bundlers.
 *
 * Behavior:
 *  - Tries multiple candidate paths for CJS model (Message.cjs / Message.js).
 *  - Uses Node's createRequire(import.meta.url) to require CJS from ESM context.
 *  - Exposes both a default export and a named export { Message } for convenience.
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Normalize a possibly nested module export to the actual model. */
function resolveModel(mod) {
  if (!mod) return null;
  // Prefer explicit named export first, then default, then the object itself.
  return mod.Message || mod.default || mod.message || mod;
}

/**
 * Build a list of candidate absolute paths for the CJS model, covering:
 *  - ../../models/Message.cjs relative to this file (expected in repo structure)
 *  - ../../models/Message.js  (fallback)
 *  - <cwd>/models/Message.cjs (when process.cwd() is the server folder)
 *  - <cwd>/models/Message.js
 */
function candidatePaths() {
  const fromHere = [
    path.resolve(__dirname, "../../models/Message.cjs"),
    path.resolve(__dirname, "../../models/Message.js"),
  ];
  const fromCwd = [
    path.resolve(process.cwd(), "models/Message.cjs"),
    path.resolve(process.cwd(), "models/Message.js"),
  ];
  return [...fromHere, ...fromCwd];
}

/** Attempt to require the model from the first resolvable candidate path. */
function loadCjsModel() {
  const tried = [];
  for (const p of candidatePaths()) {
    try {
      // eslint-disable-next-line import/no-commonjs, global-require
      const mod = require(p);
      const model = resolveModel(mod);
      if (model) {
        return { model, path: p, tried };
      }
      tried.push(`${p} (loaded, but no model export)`);
    } catch (err) {
      tried.push(`${p} (${err && err.code ? err.code : "require failed"})`);
      // continue to next candidate
    }
  }
  const message =
    "[Message model shim] Could not resolve Message model from any candidate path.\n" +
    "Tried:\n - " +
    tried.join("\n - ");
  const e = new Error(message);
  // Attach extra context for server boot logs
  e.code = "MESSAGE_MODEL_RESOLVE_FAILED";
  throw e;
}

const { model: _MessageModel } = loadCjsModel();

// Export as ESM default and named export for flexibility
const Message = _MessageModel;
export { Message };
export default Message;
// --- REPLACE END ---









