// PATH: client/src/api/index.js

// --- REPLACE START: API re-export to shared axios instance + notifications ---
import api from "../services/api/axiosInstance";
export default api;

// Re-export notifications API helpers (named export)
export * as notifications from "./notifications";
// --- REPLACE END ---
