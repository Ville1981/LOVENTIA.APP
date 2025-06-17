// client/src/config.js

export const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Path to the fallback placeholder image served from public/
export const PLACEHOLDER_IMAGE =
  import.meta.env.VITE_PLACEHOLDER_IMAGE || "/placeholder-avatar-male.png";
