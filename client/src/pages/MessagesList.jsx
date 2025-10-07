// PATH: client/src/pages/messages/ThreadView.jsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import axios from "../utils/axiosInstance";

// Placeholder conversation when none exist
const bunnyUser = {
  userId: "bunny",
  name: "Bunny",
  avatarUrl: "/assets/bunny1.jpg",
  lastMessageTime: Date.now(),
  snippet: "Hi there! Let's start our chat.",
  unreadCount: 0,
};

/**
 * Returns a short relative time string like "5m", "2h", "3d".
 * @param {Date} date
 */
function formatDistanceToNow(date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// --- REPLACE START: add safe helpers for avatar URL and time parsing ---
/**
 * Normalize a possibly-object avatar to a string URL.
 * Accepts strings or objects like { url, path, src }. Falls back to bunny.
 */
function normalizeImageSrc(input) {
  if (!input) return "/assets/bunny1.jpg";
  if (typeof input === "string") return input;
  if (typeof input === "object") {
    const candidate =
      input.url ||
      input.href ||
      input.src ||
      input.path ||
      input.filename ||
      "";
    return typeof candidate === "string" && candidate.length > 0
      ? candidate
      : "/assets/bunny1.jpg";
  }
  return "/assets/bunny1.jpg";
}

/**
 * Parse a time value that may be ms number, ISO string, or Date.
 * Returns a valid Date; if invalid, returns now to avoid NaN in UI.
 */
function parseToDateSafe(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date() : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return isNaN(ms) ? new Date() : new Date(ms);
  }
  return new Date();
}
// --- REPLACE END ---

export default function ConversationsOverview() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    axios
      .get("/api/messages/overview")
      .then((res) => {
        if (isMounted) {
          setConversations(res.data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <span className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-600">
        {t("overview.error", "Failed to load conversations")}
      </div>
    );
  }

  // If no real conversations, show placeholder
  const list = conversations.length > 0 ? conversations : [bunnyUser];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4">
      {list.map((conv) => {
        // --- REPLACE START: support both backend shapes + normalize avatar/time ---
        const id = conv.userId ?? conv.peerId;
        const name = conv.name ?? conv.peerName;
        const rawAvatar = conv.avatarUrl ?? conv.avatar;
        const avatar = normalizeImageSrc(rawAvatar);
        const rawTime = conv.lastMessageTime ?? conv.lastTimestamp;
        const timeDate = parseToDateSafe(rawTime);
        const snippet = conv.snippet ?? conv.lastMessage;
        const unread = conv.unreadCount ?? 0;
        // --- REPLACE END ---

        return (
          <div
            key={id}
            className="flex items-center p-4 bg-white rounded-2xl shadow hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => (window.location.href = `/chat/${id}`)}
            role="button"
            aria-label={`Open conversation with ${name || "user"}`}
          >
            <img
              src={avatar}
              alt={name || "User"}
              className="w-12 h-12 rounded-full mr-4 object-cover"
              onError={(e) => {
                e.currentTarget.src = "/assets/bunny1.jpg";
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center gap-3">
                <h3 className="text-lg font-semibold truncate">{name}</h3>
                <span className="shrink-0 text-sm text-gray-400">
                  {formatDistanceToNow(timeDate)}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate">
                {typeof snippet === "string" ? snippet : ""}
              </p>
            </div>
            {unread > 0 && (
              <div className="ml-4">
                <span className="inline-block text-xs font-medium bg-red-500 text-white rounded-full px-2 py-1">
                  {unread}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.
