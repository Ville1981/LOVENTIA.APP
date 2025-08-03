// client/src/config.js

/**
 * Base URL for backend API.
 * 
 * - Uses VITE_BACKEND_URL if provided (e.g. "http://localhost:5000" or "https://api.myapp.com")
 * - Falls back to "http://localhost:5000" if not set
 * - Strips off any trailing "/api" (so we don’t accidentally call "/api/api/…")
 */
const rawUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
export const BACKEND_BASE_URL = rawUrl.replace(/\/api\/?$/, "");

/**
 * Path to the fallback placeholder image served from public/
 */
export const PLACEHOLDER_IMAGE =
  import.meta.env.VITE_PLACEHOLDER_IMAGE || "/placeholder-avatar-male.png";
