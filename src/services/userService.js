// --- REPLACE START: centralized user service using shared axios instance ---
import api from "./api/axiosInstance";

/**
 * Fetch a user profile.
 * - If userId is provided: GET /users/:userId
 * - Otherwise: GET /users/profile (own profile)
 * The shared axios instance attaches Authorization + handles 401 refresh.
 */
export async function getUserProfile(userId) {
  const url = userId ? `/users/${userId}` : `/users/profile`;
  const res = await api.get(url);
  // Backend may respond { user: {...} } or the raw user object
  return res?.data?.user ?? res?.data;
}

/**
 * Update own profile with FormData or JSON.
 * - Uses PUT /users/profile
 * - For FormData, axios sets the appropriate multipart boundary automatically.
 */
export async function updateOwnProfile(payload) {
  const res = await api.put(`/users/profile`, payload, {
    // Do NOT set Content-Type for FormData; axios will handle it.
    headers: payload instanceof FormData ? {} : { "Content-Type": "application/json" },
  });
  return res?.data?.user ?? res?.data;
}
// --- REPLACE END ---
