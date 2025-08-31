// File: client/src/components/NotificationsBell.jsx

// --- REPLACE START: Notifications bell with unread badge, dropdown, and polling ---
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notifications as notificationsApi } from "../api";
import { useAuth } from "../contexts/AuthContext";
import notificationService from "../services/NotificationService";

/**
 * Lightweight bell that polls server notifications and shows a dropdown list.
 * - Badge shows unread count
 * - Dropdown lists latest 10–20 items
 * - Clicking an item marks it as read
 * - Poll every 45s (disabled if not authenticated)
 * - Optional toast when new notification arrives while open/closed
 */
const POLL_MS = 45_000;
const MAX_VISIBLE = 20;

function BellIcon({ filled = false, className = "w-6 h-6" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.5 17H19a1 1 0 0 0 .89-1.45c-.6-1.2-1.39-2.01-1.87-3.77-.26-.93-.09-2.27-.55-3.36C16.7 6.17 15.23 5 12 5S7.3 6.17 6.53 8.42c-.46 1.09-.29 2.43-.55 3.36-.48 1.76-1.27 2.57-1.87 3.77A1 1 0 0 0 5 17h4.5m5 0a3.5 3.5 0 0 1-7 0m7 0H9.5"
      />
    </svg>
  );
}

function NotificationRow({ n, onClick }) {
  const isUnread = !n.read;
  const label =
    n.type === "superlike"
      ? "You received a Superlike 💜"
      : n.message || n.type || "Notification";

  const ts = n.createdAt ? new Date(n.createdAt) : null;
  const rel = ts ? timeAgo(ts) : "";

  return (
    <button
      type="button"
      onClick={() => onClick(n)}
      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-50 focus:bg-gray-50 ${
        isUnread ? "bg-indigo-50/60" : ""
      }`}
    >
      <div className="text-sm text-gray-900">
        {label}
        {isUnread && <span className="ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white">new</span>}
      </div>
      {rel && <div className="text-xs text-gray-500 mt-0.5">{rel}</div>}
    </button>
  );
}

function timeAgo(date) {
  const diff = Math.max(0, Date.now() - date.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const NotificationsBell = () => {
  const { user, bootstrapped } = useAuth();
  const isAuthed = !!(user && (user.id || user._id));
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  // Track last known unread ids to show toast on new arrivals
  const lastSeenIdsRef = useRef(new Set());
  const pollTimer = useRef(null);
  const dropdownRef = useRef(null);

  const sortedItems = useMemo(() => {
    const list = Array.isArray(items) ? items.slice() : [];
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list.slice(0, MAX_VISIBLE);
  }, [items]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const list = await notificationsApi.getNotifications({ unread: 1 });
      const count = Array.isArray(list) ? list.length : Number(list?.count || 0);
      setUnread(count || 0);
      return count || 0;
    } catch {
      // silently ignore
      return unread;
    }
  }, [unread]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await notificationsApi.getNotifications({});
      setItems(Array.isArray(list) ? list : []);
      const count = (list || []).filter((n) => !n.read).length;
      setUnread(count);

      // Toast for new arrivals
      const currentIds = new Set((list || []).map((n) => String(n._id || n.id)));
      let hasNew = false;
      for (const id of currentIds) {
        if (!lastSeenIdsRef.current.has(id)) {
          hasNew = true;
          break;
        }
      }
      if (hasNew && lastSeenIdsRef.current.size > 0) {
        try {
          notificationService.showToast({ message: "New notification received" });
        } catch {
          /* noop */
        }
      }
      lastSeenIdsRef.current = currentIds;
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial bootstrap & polling
  useEffect(() => {
    if (!bootstrapped) return;
    clearInterval(pollTimer.current);

    if (!isAuthed) {
      setItems([]);
      setUnread(0);
      lastSeenIdsRef.current = new Set();
      return;
    }

    // Fast badge refresh first
    fetchUnreadCount();
    // Then fetch full list
    fetchList();

    // Polling
    pollTimer.current = setInterval(() => {
      if (!document.hidden) {
        fetchUnreadCount();
        // Refresh list less aggressively unless the dropdown is open
        if (open) fetchList();
      }
    }, POLL_MS);

    return () => clearInterval(pollTimer.current);
  }, [isAuthed, bootstrapped, open, fetchUnreadCount, fetchList]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const onToggle = useCallback(async () => {
    if (!isAuthed) return;
    setOpen((v) => !v);
    if (!open) {
      await fetchList();
    }
  }, [isAuthed, open, fetchList]);

  const onItemClick = useCallback(
    async (n) => {
      const id = String(n._id || n.id || "");
      if (!id) return;

      // Optimistic update
      setItems((prev) =>
        prev.map((x) => (String(x._id || x.id) === id ? { ...x, read: true } : x))
      );
      setUnread((c) => Math.max(0, c - (n.read ? 0 : 1)));

      try {
        await notificationsApi.markRead(id);
      } catch {
        // revert on failure
        setItems((prev) =>
          prev.map((x) => (String(x._id || x.id) === id ? { ...x, read: n.read } : x))
        );
        setUnread((c) => c + (n.read ? 0 : 1));
      }
    },
    []
  );

  const badge = unread > 99 ? "99+" : unread;

  if (!isAuthed) {
    // Render placeholder (no polling)
    return (
      <div className="relative">
        <button
          type="button"
          className="relative inline-flex items-center justify-center p-2 rounded-full text-gray-500 hover:text-gray-700"
          aria-label="Notifications"
          title="Notifications"
          disabled
        >
          <BellIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={onToggle}
        className="relative inline-flex items-center justify-center p-2 rounded-full text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-haspopup="true"
        aria-expanded={open ? "true" : "false"}
        aria-label="Notifications"
        title="Notifications"
      >
        <BellIcon filled={unread > 0} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[10px] font-medium rounded-full bg-red-600 text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications menu"
          className="absolute right-0 mt-2 w-80 max-w-[92vw] origin-top-right bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50"
        >
          <div className="px-3 py-2 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">Notifications</span>
              <span className="text-xs text-gray-500">
                {loading ? "Refreshing…" : unread > 0 ? `${unread} unread` : "All caught up"}
              </span>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-1">
            {sortedItems.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                No notifications
              </div>
            ) : (
              sortedItems.map((n) => (
                <NotificationRow key={String(n._id || n.id)} n={n} onClick={onItemClick} />
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t bg-gray-50 text-right">
            <button
              type="button"
              className="text-xs text-gray-600 hover:text-gray-900"
              onClick={() => fetchList()}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
// --- REPLACE END ---
