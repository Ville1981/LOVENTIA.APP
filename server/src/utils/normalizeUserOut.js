// --- REPLACE START: shim re-export for normalizeUserOut ---
// This shim exists because some routes import from "../utils/normalizeUserOut.js"
// relative to src/, but the real implementation lives in server/utils/normalizeUserOut.js.
//
// Purpose:
// - Avoid breaking imports in userRoutes.js and discoverRoutes.js
// - Forward everything (default + named exports) to the real file
//
// Notes:
// - Keep this in ESM syntax (because src/ is running under "type": "module").
// - All comments in English for consistency.

import normalizeUserOut, { normalizeUsersOut } from "../../utils/normalizeUserOut.js";

export { normalizeUserOut as default, normalizeUserOut, normalizeUsersOut };
// --- REPLACE END ---
