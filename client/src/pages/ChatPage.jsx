// PATH: client/src/pages/ChatPage.jsx

/* eslint-env browser */
import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import {
  connectSocket,
  disconnectSocket,
  joinRoom,
  leaveRoom,
  onNewMessage,
  offNewMessage,
  sendMessage as sendSocketMessage,
} from "../services/socket";
import api from "../utils/axiosInstance.js";
// --- REPLACE START: ReportButton import for passive safety reporting ---
import ReportButton from "../components/discover/ReportButton";
// --- REPLACE END ---

// --- REPLACE START: message helpers (normalization + current user id) ---
function parseCurrentUserIdFromToken() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("accessToken");
  if (!raw || typeof raw !== "string") return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(atob(parts[1]));
    return (
      payload?.id ||
      payload?._id ||
      payload?.userId ||
      payload?.uid ||
      null
    );
  } catch {
    return null;
  }
}

function normalizeMessage(raw, myUserId, peerUserId) {
  if (!raw) return null;

  const rawId =
    (raw && raw._id) ||
    raw?.id ||
    raw?.messageId ||
    raw?.uuid ||
    null;
  const id = rawId ? String(rawId) : null;

  const senderValue = raw?.sender;
  const receiverValue = raw?.receiver;

  const senderId =
    typeof senderValue === "string" || typeof senderValue === "number"
      ? String(senderValue)
      : senderValue && senderValue._id
      ? String(senderValue._id)
      : null;

  const receiverId =
    typeof receiverValue === "string" || typeof receiverValue === "number"
      ? String(receiverValue)
      : receiverValue && receiverValue._id
      ? String(receiverValue._id)
      : null;

  const text =
    typeof raw.text === "string" && raw.text.trim().length > 0
      ? raw.text
      : typeof raw.content === "string"
      ? raw.content
      : "";

  const createdAt =
    raw.createdAt ||
    raw.timestamp ||
    raw.sentAt ||
    raw.time ||
    null;

  const myIdString = myUserId ? String(myUserId) : null;
  const peerIdString = peerUserId ? String(peerUserId) : null;

  const fromMe =
    !!myIdString && !!senderId && String(senderId) === myIdString;

  const incoming =
    !!peerIdString && !!senderId
      ? String(senderId) === peerIdString
      : !fromMe;

  return {
    id: id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    createdAt,
    fromMe,
    incoming,
    senderId: senderId || null,
    receiverId: receiverId || null,
    raw,
  };
}
// --- REPLACE END ---

/**
 * ChatPage
 * Displays and manages a real-time chat between the authenticated user and a peer.
 */
export default function ChatPage() {
  const { t } = useTranslation();
  const { userId } = useParams(); // peer's user ID
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);
  const messageIdsRef = useRef(new Set()); // duplicate-guard

  // Intro lock pre-check + error state
  const [canSendIntro, setCanSendIntro] = useState(true);
  const [introCheckLoading, setIntroCheckLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  // --- REPLACE START: helper derived flags (fix: allow replies in existing threads) ---
  const hasThread = Array.isArray(messages) && messages.length > 0;
  // If there is already a thread, user can always reply regardless of intro lock
  const canSend = hasThread || canSendIntro;
  // --- REPLACE END ---

  // scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatTime = (value) => {
    if (!value) return "";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) {
        return "";
      }
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  useEffect(() => {
    if (!userId) return;

    // --- REPLACE START: init intro lock, history fetch + socket with normalized messages ---
    const myId = parseCurrentUserIdFromToken();

    // can-send-intro pre-check from API (guarded)
    (async () => {
      setIntroCheckLoading(true);
      try {
        const { data } = await api.get(`/messages/can-send-intro/${userId}`);
        setCanSendIntro(Boolean(data?.canSendIntro !== false));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Intro check failed:", e);
        setCanSendIntro(true);
      } finally {
        setIntroCheckLoading(false);
      }
    })();

    // Fetch history via REST (guarded) and normalize
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/messages/${userId}`);
        const raw = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.messages)
          ? res.data.messages
          : [];
        const normalized = raw
          .map((m) => normalizeMessage(m, myId, userId))
          .filter(Boolean);

        const newIdSet = new Set(messageIdsRef.current);
        normalized.forEach((m) => {
          if (m.id) {
            newIdSet.add(String(m.id));
          }
        });
        messageIdsRef.current = newIdSet;
        setMessages(normalized);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching messages", err);
        setPageError("Failed to load this conversation.");
      }
    };

    // Initialize socket connection & listeners (guarded)
    const initSocket = () => {
      try {
        const conversationId =
          [myId, userId].filter(Boolean).sort().join("_") || String(userId);

        connectSocket({ query: { conversationId } });
        joinRoom(conversationId);

        const handleSocketMessage = (msg) => {
          try {
            const normalized = normalizeMessage(msg, myId, userId);
            if (!normalized || !normalized.id) {
              return;
            }
            const msgId = String(normalized.id);
            if (messageIdsRef.current.has(msgId)) return;

            messageIdsRef.current.add(msgId);
            setMessages((prev) => [...prev, normalized]);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Socket message handling error:", e);
          }
        };

        onNewMessage(handleSocketMessage);

        return () => {
          try {
            offNewMessage(handleSocketMessage);
            leaveRoom(conversationId);
            disconnectSocket();
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Socket cleanup error:", e);
          }
        };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Socket init failed:", e);
        setPageError("Realtime connection failed. You can still send messages.");
        return () => {};
      }
    };

    fetchMessages();
    const cleanup = initSocket();
    return cleanup;
    // --- REPLACE END ---
  }, [userId]);

  // Always keep view scrolled to bottom when message count changes
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // robust send handler honoring intro lock & axios interceptor flag
  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;

    // --- REPLACE START: use derived canSend (not just canSendIntro) ---
    if (!canSend) return;
    // --- REPLACE END ---

    const myId = parseCurrentUserIdFromToken();
    const conversationId =
      [myId, userId].filter(Boolean).sort().join("_") || String(userId);

    try {
      try {
        sendSocketMessage(conversationId, text);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Socket emit failed (will still try REST):", e);
      }

      const res = await api.post(`/messages/${userId}`, { text });
      const saved = res?.data;
      const normalized = normalizeMessage(saved, myId, userId);
      const normalizedId = normalized?.id ? String(normalized.id) : null;

      if (normalized && normalizedId && !messageIdsRef.current.has(normalizedId)) {
        messageIdsRef.current.add(normalizedId);
        setMessages((prev) => [...prev, normalized]);
      }

      setNewMessage("");
    } catch (err) {
      if (err && err.isIntroLocked) {
        // If server reports intro lock but we already have a thread,
        // UI will still allow replies; keep canSendIntro=false for intro-only.
        setCanSendIntro(false);
        return;
      }
      // eslint-disable-next-line no-console
      console.error("Error sending message", err);
      setPageError("Failed to send. Please try again.");
    }
  };

  return (
    // --- REPLACE START: conversation header with title + passive Report button ---
    <div
      className="flex flex-col max-w-2xl mx-auto h-screen p-4"
      role="main"
      aria-label={t("chat:mainAriaLabel", "Chat conversation")}
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">
          💬 {t("chat:title")}
        </h2>
        <ReportButton
          targetUserId={userId}
          messageId={undefined}
        />
      </div>
    {/* --- REPLACE END --- */}
      {pageError && (
        <div className="mb-3 rounded-2xl border p-3 text-sm bg-red-50 border-red-200 text-red-800">
          {pageError}
        </div>
      )}

      {/* --- REPLACE START: show Premium banner ONLY when there is NO existing thread and intros are locked --- */}
      {!introCheckLoading && !hasThread && !canSendIntro && (
        <div className="mb-3 rounded-2xl border p-3 text-sm bg-yellow-50 border-yellow-200">
          <div className="font-medium">Intro messages are a Premium feature</div>
          <div className="opacity-80">
            You need Premium to send the first message to this user.
          </div>
          <div className="mt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl shadow border bg-white hover:bg-neutral-50"
              onClick={() => {
                window.location.href = "/upgrade";
              }}
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      )}
      {/* --- REPLACE END --- */}

      {/* --- REPLACE START: messages log section with ARIA roles for screen readers --- */}
      <div
        className="flex-1 overflow-y-auto bg-gray-100 p-4 rounded shadow-sm"
        role="log"
        aria-label={t("chat:messagesAriaLabel", "Conversation messages")}
        aria-live="polite"
        aria-relevant="additions text"
      >
        {Array.isArray(messages) && messages.length > 0 ? (
          messages.map((msg, idx) => {
            const isIncoming = msg?.incoming === true;
            const bubbleText =
              typeof msg?.text === "string" && msg.text.length > 0
                ? msg.text
                : typeof msg?.raw?.text === "string" && msg.raw.text.length > 0
                ? msg.raw.text
                : typeof msg?.raw?.content === "string"
                ? msg.raw.content
                : "";

            const timestamp =
              msg?.createdAt ||
              (msg?.raw && msg.raw.createdAt) ||
              null;
            const timeLabel = formatTime(timestamp);

            return (
              <div
                key={msg?.id || msg?._id || idx}
                className={`my-2 flex ${
                  isIncoming ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`p-2 rounded-lg max-w-xs whitespace-pre-wrap ${
                    isIncoming
                      ? "bg-white text-left"
                      : "bg-blue-500 text-white text-right"
                  }`}
                >
                  {bubbleText}
                  {timeLabel && (
                    <div className="mt-1 text-[11px] opacity-70 text-right">
                      {timeLabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-gray-500">
            {t("chat:noMessagesYet", "No messages yet.")}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* --- REPLACE END --- */}

      {/* --- REPLACE START: message input + send button with simple a11y helpers --- */}
      <div className="mt-4 flex gap-2">
        <label htmlFor="chatMessageInput" className="sr-only">
          {t("chat:inputLabel", "Type a message")}
        </label>
        <input
          id="chatMessageInput"
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 border rounded p-2 disabled:opacity-60 disabled:cursor-not-allowed"
          placeholder={
            !introCheckLoading && !hasThread && !canSendIntro
              ? "Premium required to send the first message"
              : t("chat:placeholder")
          }
          // disable only when there is no thread and intros are locked
          disabled={!canSend}
          aria-label={t("chat:inputAriaLabel", "Message input")}
        />
        <button
          type="button"
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!canSend}
        >
          {t("chat:send")}
        </button>
      </div>
      {/* --- REPLACE END --- */}
    </div>
  );
}

// The replacement regions are marked between
// --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.


