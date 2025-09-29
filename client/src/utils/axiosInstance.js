// PATH: client/src/utils/axiosInstance.js

// --- REPLACE START: shim that forwards to the real axios instance ---
// This file is a thin compatibility layer.
// It ensures older imports like `import api from "../utils/axiosInstance"`
// keep working after the axios logic was moved to `services/api/axiosInstance`.
// All functionality lives in that file.
export { default } from "../services/api/axiosInstance";
export * from "../services/api/axiosInstance";
// --- REPLACE END ---
