// PATH: client/src/config.js

// Export base URL for backend API and placeholder image path.

// --- REPLACE START: define BACKEND_BASE_URL dynamic from env and strip trailing "/api" ---
/**
 * Resolve backend base URL robustly:
 *  - Prefer VITE_API_BASE_URL, then VITE_BACKEND_URL
 *  - Fallback to current origin (map Vite ports 5173/5174 -> 5000)
 *  - Strip a trailing "/api" so other modules can safely append "/api"
 *  - Ensure no accidental double slashes
 *
 * NOTE: This file does not control Stripe Portal locale. Keep UI texts in English
 *       (e.g., "Open Billing Portal") at the component level as desired.
 */
function resolveBackendBaseUrl() {
  let envUrl = "";
  try {
    envUrl =
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL)) ||
      "";
  } catch {
    // not running under Vite env loader
  }

  // Fallback guess based on current origin for local dev
  let originGuess = "";
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    originGuess = window.location.origin.replace(/:5173|:5174/, ":5000");
  }

  const raw = String(envUrl || originGuess || "").trim();

  // If still empty, keep as empty string (consumer may decide to use relative "/api")
  if (!raw) return "";

  // Remove trailing slashes and a single trailing "/api"
  const noTrailing = raw.replace(/\/+$/, "");
  const withoutApi = noTrailing.replace(/\/api\/?$/i, "");

  // Normalize duplicate slashes but keep protocol delimiter "://"
  return withoutApi.replace(/([^:])\/\/+/g, "$1/");
}

// NOTE: Keep the name BACKEND_BASE_URL (used across the app)
export const BACKEND_BASE_URL = resolveBackendBaseUrl();
// --- REPLACE END ---

/**
 * Build full API base (convenience export). If BACKEND_BASE_URL is empty,
 * consumers should fall back to relative "/api" which works via Vite proxy or same-origin.
 */
export const API_BASE_URL = BACKEND_BASE_URL ? `${BACKEND_BASE_URL}/api` : "/api";

/**
 * Path to the fallback placeholder image served from public/.
 * Ensures it points under the app's public root (no protocol or host),
 * always starting with a single leading slash.
 */
function resolvePlaceholderPath() {
  let p =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_PLACEHOLDER_IMAGE) ||
    "/placeholder-avatar-male.png"; // default file under public/

  // Force local public path (strip protocol/host if someone configured a full URL)
  try {
    // Remove origin if provided (e.g., "http://localhost:5173/placeholder.png")
    p = String(p).replace(/^[a-z]+:\/\/[^/]+/i, "");
  } catch {
    // ignore
  }

  // Ensure exactly one leading slash
  p = `/${p}`.replace(/\/{2,}/g, "/");
  return p;
}

export const PLACEHOLDER_IMAGE = resolvePlaceholderPath();
