// PATH: server/src/utils/normalizeUserOut.js

// --- REPLACE START: shim re-export for normalizeUserOut ---
// This shim exists because some parts of the codebase import from "src/utils/normalizeUserOut.js",
// while the real implementation can live in "server/utils/normalizeUserOut.js".
// Forward the default + named exports to the real file to avoid duplication.
//
import normalizeUserOut, { normalizeUsersOut } from "../../utils/normalizeUserOut.js";

export { normalizeUserOut as default, normalizeUserOut, normalizeUsersOut };
// --- REPLACE END ---
