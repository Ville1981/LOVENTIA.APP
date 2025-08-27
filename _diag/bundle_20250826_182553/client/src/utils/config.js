// --- REPLACE START: env-driven config (no hardcoded localhost), strip trailing "/api", keep comments in English ---
/**
 * Configuration for URLs and static assets.
 *
 * Expected .env values (set in client/.env or .env.local):
 *   VITE_BACKEND_URL=http://localhost:5000
 *   VITE_CLIENT_URL=http://localhost:5174
 *   VITE_PLACEHOLDER_IMAGE=/placeholder-avatar-male.png          (optional)
 *
 * Notes:
 * - We DO NOT hardcode localhost fallbacks here.
 * - BACKEND_BASE_URL is normalized (no trailing slash, and any trailing "/api" is removed).
 * - API_BASE_URL is derived from BACKEND_BASE_URL.
 */

// 1) Raw values straight from Vite env (do not invent fallbacks here)
const RAW_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
const RAW_CLIENT_URL = import.meta.env.VITE_CLIENT_URL || "";

// 2) Normalize BACKEND base: remove a trailing "/api" (with/without slash) and any trailing slashes
const STRIPPED_API = RAW_BACKEND_URL.replace(/\/api\/?$/i, "");
export const BACKEND_BASE_URL = STRIPPED_API.replace(/\/+$/g, "");

// 3) Derive API_BASE_URL from the normalized backend base
export const API_BASE_URL = BACKEND_BASE_URL ? `${BACKEND_BASE_URL}/api` : "";

// 4) Client base URL (left as-is; caller may choose to normalize)
export const CLIENT_BASE_URL = RAW_CLIENT_URL;

// 5) Placeholder image path (served from /public by the client)
export const PLACEHOLDER_IMAGE =
  import.meta.env.VITE_PLACEHOLDER_IMAGE || "/placeholder-avatar-male.png";

/**
 * Optional helper: build absolute URL for server-side uploads.
 * Accepts "/uploads/xxx" or bare filename "xxx" and prefixes BACKEND_BASE_URL.
 * Returns empty string if BACKEND_BASE_URL is not configured.
 *
 * Extras:
 * - Normalizes Windows backslashes to forward slashes.
 * - Collapses accidental "/uploads/uploads/" double segments.
 */
export function absolutizeUploadPath(pathOrName) {
  if (!pathOrName || typeof pathOrName !== "string") return "";
  let s = pathOrName.trim();
  if (s === "") return "";
  if (/^https?:\/\//i.test(s)) return s; // already absolute

  // Normalize Windows separators and collapse duplicate '/uploads/'
  s = s.replace(/\\/g, "/").replace(/\/uploads\/uploads\//g, "/uploads/");

  // Ensure single leading '/uploads/'
  const rel = s.startsWith("/") ? s : `/uploads/${s}`;

  if (!BACKEND_BASE_URL) return "";
  // Avoid accidental double slashes while preserving protocol slashes
  return `${BACKEND_BASE_URL}${rel}`.replace(/([^:])\/\/+/g, "$1/");
}
// --- REPLACE END ---

