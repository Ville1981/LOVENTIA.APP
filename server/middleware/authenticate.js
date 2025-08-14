// --- REPLACE START: robust CJS/ESM interop shim for authenticate middleware ---
// This shim ensures we can import the authenticate middleware regardless of
// whether ../src/middleware/authenticate.js exports via CommonJS or ESM.
import * as Mod from '../src/middleware/authenticate.js';

// If the source exports a default, use it; otherwise fall back to a named export
// called `authenticate`; and as a last resort, use the module object itself
// (covers the case where CJS exports a function).
const authenticate = Mod.default || Mod.authenticate || Mod;

export default authenticate;
export { authenticate };
// --- REPLACE END ---
