// PATH: client/src/utils/axiosInstance.js

// --- REPLACE START: shim that forwards to the existing axios instance location ---
// This file is a thin compatibility layer.
// It ensures older imports like `import api from "../utils/axiosInstance"`
// keep working. In your project the actual axios instance lives at
// `client/src/services/api/axiosInstance.js` (and already includes the
// intro-lock 403 flag, refresh lock, and credentials policy).

export { default } from "../services/api/axiosInstance";
export * from "../services/api/axiosInstance";

// If you later move the instance to `client/src/api/axios.js`, just update
// these two export lines to point there.
// --- REPLACE END ---
