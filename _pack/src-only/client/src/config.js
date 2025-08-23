// Export base URL for backend API and placeholder image path.

// --- REPLACE START: define BACKEND_BASE_URL dynamic from env and strip trailing "/api" ---
// --- REPLACE START: remove hardcoded localhost fallback ---
const rawUrl = import.meta.env.VITE_BACKEND_URL || "";
// --- REPLACE END ---
export const BACKEND_BASE_URL = rawUrl.replace(/\/api\/?$/, "");
// --- REPLACE END ---

/**
 * Path to the fallback placeholder image served from public/
 */
export const PLACEHOLDER_IMAGE =
  import.meta.env.VITE_PLACEHOLDER_IMAGE || "/placeholder-avatar-male.png";
