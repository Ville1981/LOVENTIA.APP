// File: client/src/components/SomePage.jsx

// --- REPLACE START: End-to-end demo page for Notifications API + toasts ---
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getNotifications, markRead, getUnreadCount } from "../api/notifications";
import notificationService from "../services/NotificationService";
import { useAuth } from "../contexts/AuthContext";

/**
 * SomePage.jsx
 * A simple page to verify notifications end-to-end:
 * - Fetch & list latest notifications
 * - Show unread count
 * - Click a row to mark as read (optimistic)
 * - "Mark all read" bulk action
 * - Polling every 60s (disabled when not authenticated)
 * - Toast + optional browser notification for new incoming items
 */

const POLL_MS = 60_000;
const MAX_VISIBLE = 20;

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

function NotificationRow({ item, onClick }) {
  const isUnread = !item.read;
  const label =
    item.type === "superlike"
      ? "You received a Superlike 💜"
      : item.message || item.type || "Notification";
  const ts = item.createdAt ? new Date(item.createdAt) : null;
  const rel = ts ? timeAgo(ts) : "";

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
        isUnread
          ? "bg-indigo-50/60 border-indigo-100 hover:bg-indigo-100/60"
          : "bg-white border-gray-200 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{label}</div>
          {rel && <div className="text-xs text-gray-500 mt-0.5">{rel}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isUnread ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white">unread</span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">read</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function SomePage() {
  const { user, bootstrapped } = useAuth?.() || { user: null, bootstrapped: true };
  const isAuthed = !!(user && (user.id || user._id));

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Track last seen notification IDs to detect new arrivals
  const lastSeenIdsRef = useRef(new Set());
  const pollTimerRef = useRef(null);

  const sortedItems = useMemo(() => {
    const list = Array.isArray(items) ? items.slice() : [];
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list.slice(0, MAX_VISIBLE);
  }, [items]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      const n = typeof count === "number" ? count : Number(count?.count || 0);
      setUnread(Number.isFinite(n) ? n : 0);
    } catch {
      // keep previous value silently
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getNotifications({});
      const arr = Array.isArray(list) ? list : [];
      setItems(arr);

      // Update unread based on payload (fallback to existing)
      const count = arr.filter((x) => !x.read).length;
      setUnread(count);

      // Detect new arrivals -> toast + optional browser notification
      const currentIds = new Set(arr.map((n) => String(n._id || n.id)));
      let hasNew = false;
      let hasNewSuperlike = false;
      for (const itm of arr) {
        const id = String(itm._id || itm.id || "");
        if (id && !lastSeenIdsRef.current.has(id)) {
          hasNew = true;
          if (itm.type === "superlike") hasNewSuperlike = true;
        }
      }

      if (hasNew && lastSeenIdsRef.current.size > 0) {
        try {
          if (hasNewSuperlike) {
            notificationService.showToast({ message: "You received a Superlike!" });
            notificationService.showBrowserNotification?.({
              title: "New Superlike 💜",
              options: { body: "Someone sent you a Superlike." },
            });
          } else {
            notificationService.showToast({ message: "New notification received" });
          }
        } catch {
          // ignore toast errors
        }
      }
      lastSeenIdsRef.current = currentIds;
    } catch (e) {
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleItemClick = useCallback(
    async (n) => {
      const id = String(n._id || n.id || "");
      if (!id) return;
      if (n.read) return; // nothing to do

      // Optimistic
      setItems((prev) =>
        prev.map((x) => (String(x._id || x.id) === id ? { ...x, read: true } : x))
      );
      setUnread((c) => Math.max(0, c - 1));

      try {
        await markRead(id);
      } catch {
        // revert on failure
        setItems((prev) =>
          prev.map((x) => (String(x._id || x.id) === id ? { ...x, read: false } : x))
        );
        setUnread((c) => c + 1);
      }
    },
    []
  );

  const handleMarkAll = useCallback(async () => {
    if (busy) return;
    const unreadItems = items.filter((x) => !x.read);
    if (!unreadItems.length) return;

    // Optimistic: mark all locally
    setBusy(true);
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    const prevUnread = unread;
    setUnread(0);

    try {
      // Best-effort: mark each on server (sequential keeps load small)
      for (const it of unreadItems) {
        const id = String(it._id || it.id || "");
        if (id) {
          // eslint-disable-next-line no-await-in-loop
          await markRead(id);
        }
      }
    } catch {
      // On any failure, refresh from server to reconcile state
      await loadList();
      setUnread(prevUnread);
    } finally {
      setBusy(false);
    }
  }, [busy, items, unread, loadList]);

  // Initial load + polling
  useEffect(() => {
    if (!bootstrapped) return;
    clearInterval(pollTimerRef.current);

    if (!isAuthed) {
      setItems([]);
      setUnread(0);
      lastSeenIdsRef.current = new Set();
      return;
    }

    // Immediate fetch
    refreshUnreadCount();
    loadList();

    // Polling (skip when tab hidden)
    pollTimerRef.current = setInterval(() => {
      if (!document.hidden) {
        refreshUnreadCount();
        loadList();
      }
    }, POLL_MS);

    return () => clearInterval(pollTimerRef.current);
  }, [isAuthed, bootstrapped, refreshUnreadCount, loadList]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
            {unread} unread
          </span>
          <button
            type="button"
            onClick={loadList}
            className="px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-gray-50"
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleMarkAll}
            className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            disabled={busy || unread === 0}
            title={unread === 0 ? "No unread notifications" : "Mark all as read"}
          >
            Mark all read
          </button>
        </div>
      </div>

      {!isAuthed ? (
        <div className="p-4 rounded-md border border-amber-200 bg-amber-50 text-sm text-amber-800">
          You must be logged in to view notifications.
        </div>
      ) : error ? (
        <div className="p-4 rounded-md border border-red-200 bg-red-50 text-sm text-red-800">
          {error}
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="p-6 rounded-md border border-dashed text-center text-gray-500">
          No notifications yet.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((n) => (
            <NotificationRow key={String(n._id || n.id)} item={n} onClick={handleItemClick} />
          ))}
        </div>
      )}
    </div>
  );
}
// --- REPLACE END ---
