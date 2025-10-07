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

  useEffect(() => {
    if (!userId) return;

    // parse current user ID from token (safe)
    const raw = localStorage.getItem("accessToken");
    let myId = null;
    try {
      if (raw && raw.split(".").length === 3) {
        const payload = JSON.parse(atob(raw.split(".")[1]));
        myId = payload?.id || payload?._id || payload?.userId || null;
      }
    } catch {
      // ignore invalid token payload
    }

    // can-send-intro pre-check from API (guarded)
    (async () => {
      setIntroCheckLoading(true);
      try {
        const { data } = await api.get(`/messages/can-send-intro/${userId}`);
        setCanSendIntro(Boolean(data?.canSendIntro !== false));
      } catch (e) {
        console.warn("Intro check failed:", e);
        setCanSendIntro(true);
      } finally {
        setIntroCheckLoading(false);
      }
    })();

    // Fetch history via REST (guarded)
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/messages/${userId}`);
        const msgs = Array.isArray(res.data) ? res.data : [];
        msgs.forEach((m) => {
          const id = m && m._id ? String(m._id) : null;
          if (id) messageIdsRef.current.add(id);
        });
        setMessages(msgs);
        scrollToBottom();
      } catch (err) {
        console.error("Error fetching messages", err);
        setPageError("Failed to load this conversation.");
      }
    };

    // Initialize socket connection & listeners (guarded)
    const initSocket = () => {
      try {
        const conversationId = [myId, userId].filter(Boolean).sort().join("_") || String(userId);
        connectSocket({ query: { conversationId } });
        joinRoom(conversationId);

        const handleSocketMessage = (msg) => {
          try {
            const msgId = msg?._id ? String(msg._id) : null;
            if (!msgId || messageIdsRef.current.has(msgId)) return;
            messageIdsRef.current.add(msgId);
            setMessages((prev) => [...prev, msg]);
            scrollToBottom();
          } catch (e) {
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
            console.warn("Socket cleanup error:", e);
          }
        };
      } catch (e) {
        console.error("Socket init failed:", e);
        setPageError("Realtime connection failed. You can still send messages.");
        return () => {};
      }
    };

    fetchMessages();
    const cleanup = initSocket();
    return cleanup;
  }, [userId]);

  // robust send handler honoring intro lock & axios interceptor flag
  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;

    // --- REPLACE START: use derived canSend (not just canSendIntro) ---
    if (!canSend) return;
    // --- REPLACE END ---

    // parse current user ID (safe)
    const raw = localStorage.getItem("accessToken");
    let myId = null;
    try {
      if (raw && raw.split(".").length === 3) {
        const payload = JSON.parse(atob(raw.split(".")[1]));
        myId = payload?.id || payload?._id || payload?.userId || null;
      }
    } catch {
      // ignore parsing errors
    }

    const conversationId = [myId, userId].filter(Boolean).sort().join("_") || String(userId);

    try {
      try {
        sendSocketMessage(conversationId, text);
      } catch (e) {
        console.warn("Socket emit failed (will still try REST):", e);
      }

      const res = await api.post(`/messages/${userId}`, { text });
      const saved = res?.data;
      const savedId = saved?._id ? String(saved._id) : null;
      if (savedId && !messageIdsRef.current.has(savedId)) {
        messageIdsRef.current.add(savedId);
        setMessages((prev) => [...prev, saved]);
      }
      setNewMessage("");
      scrollToBottom();
    } catch (err) {
      if (err && err.isIntroLocked) {
        // If server reports intro lock but we already have a thread,
        // UI will still allow replies; keep canSendIntro=false for intro-only.
        setCanSendIntro(false);
        return;
      }
      console.error("Error sending message", err);
      setPageError("Failed to send. Please try again.");
    }
  };

  return (
    <div className="flex flex-col max-w-2xl mx-auto h-screen p-4">
      <h2 className="text-xl font-bold mb-2 text-center">
        💬 {t("chat:title")}
      </h2>

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

      <div className="flex-1 overflow-y-auto bg-gray-100 p-4 rounded shadow-sm">
        {Array.isArray(messages) && messages.length > 0 ? (
          messages.map((msg, idx) => {
            const sender =
              msg?.sender?.toString ? msg.sender.toString() : String(msg?.sender || "");
            const isIncoming = sender === String(userId);
            return (
              <div
                key={msg?._id || idx}
                className={`my-2 flex ${isIncoming ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`p-2 rounded-lg max-w-xs whitespace-pre-wrap ${
                    isIncoming ? "bg-white text-left" : "bg-blue-500 text-white text-right"
                  }`}
                >
                  {typeof msg?.text === "string" && msg.text.length > 0
                    ? msg.text
                    : typeof msg?.content === "string"
                    ? msg.content
                    : ""}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-gray-500">No messages yet.</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 border rounded p-2 disabled:opacity-60 disabled:cursor-not-allowed"
          placeholder={
            !introCheckLoading && !hasThread && !canSendIntro
              ? "Premium required to send the first message"
              : t("chat:placeholder")
          }
          // --- REPLACE START: disable only when there is no thread and intros are locked ---
          disabled={!canSend}
          // --- REPLACE END ---
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          // --- REPLACE START: disable only when there is no thread and intros are locked ---
          disabled={!canSend}
          // --- REPLACE END ---
        >
          {t("chat:send")}
        </button>
      </div>
    </div>
  );
}
