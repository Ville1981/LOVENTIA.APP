// client/src/services/api/axiosInstance.js
// @ts-nocheck

// This file is kept for backward-compatibility so that existing imports
// like "import api from '@/services/api/axiosInstance'" continue to work.
// It re-exports the single canonical instance from src/utils/axiosInstance.js.
// The replacement region is marked below.

// --- REPLACE START: re-export unified axios instance (do not duplicate logic) ---
export { default, setAccessToken } from "../../utils/axiosInstance";
// --- REPLACE END ---
