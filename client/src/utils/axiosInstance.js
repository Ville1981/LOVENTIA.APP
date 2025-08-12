// --- REPLACE START: shim that forwards to the real axios instance ---
// Keep legacy imports working: import axios from "../utils/axiosInstance";
export { default } from "../services/api/axiosInstance";
export * from "../services/api/axiosInstance";
// --- REPLACE END ---
