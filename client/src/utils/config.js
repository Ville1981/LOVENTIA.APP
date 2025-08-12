// client/src/utils/config.js

/**
 * Configuration for API URLs. Ensures we always use the exact env var values (case-sensitive)
 * Make sure your `.env.local` contains:
 * VITE_BACKEND_URL=http://<backend-host>:<port>
 * VITE_CLIENT_URL=http://<client-host>:<port>
 */

export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
export const CLIENT_BASE_URL = import.meta.env.VITE_CLIENT_URL;
