// File: client/src/api/notifications.js

// --- REPLACE START: notifications API (getNotifications, markRead, getUnreadCount) ---
import api from "../utils/axiosInstance";

/**
 * Fetch current user's notifications.
 * @param {Object} [opts]
 * @param {string} [opts.sinceId] - Return notifications created after this id (server may ignore if unsupported).
 * @param {boolean|number} [opts.unread] - If truthy, only unread notifications are returned.
 * @returns {Promise<Array>} Array of notifications.
 */
export async function getNotifications(opts = {}) {
  const params = {};
  if (opts && typeof opts === "object") {
    const { sinceId, unread } = opts;
    if (sinceId) params.sinceId = sinceId;
    if (unread) params.unread = 1; // server expects ?unread=1
  }
  const res = await api.get("/api/notifications", { params });
  // Server may respond with { notifications: [...] } or a raw array
  return res?.data?.notifications ?? res?.data ?? [];
}

/**
 * Mark a notification as read.
 * @param {string} id - Notification _id
 * @returns {Promise<Object>} Updated notification or { ok: true }
 */
export async function markRead(id) {
  if (!id) throw new Error("Notification id is required");
  const res = await api.patch(`/api/notifications/${id}/read`);
  return res?.data ?? { ok: true };
}

/**
 * Get unread count (simple implementation: fetch unread list length).
 * @returns {Promise<number>} Number of unread notifications.
 */
export async function getUnreadCount() {
  const list = await getNotifications({ unread: 1 });
  return Array.isArray(list) ? list.length : Number(list?.count ?? 0);
}
// --- REPLACE END ---
