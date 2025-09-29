// PATH: server/src/controllers/services/auth.service.js
// Universal shim for ../../../controllers/services/auth.service.js
// - Re-exports all named exports
// - Synthesizes a default export as the namespace, so both
//   `import * as X` and `import X` work.

import * as authService from "../../../controllers/services/auth.service.js";
export default authService;
export * from "../../../controllers/services/auth.service.js";
