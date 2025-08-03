/* eslint-env browser */
import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

// --- REPLACE START: import socket helpers for reconnect & dedupe ---
import {
  connectSocket,
  disconnectSocket,
  joinRoom,
  leaveRoom,
  onNewMessage,
  offNewMessage,
  sendMessage as sendSocketMessage,
} from "../services/socket";
import api from "../utils/axiosInstance";
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

  // scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!userId) return;

    // parse current user ID from token
    const raw = localStorage.getItem("accessToken");
    let myId = null;
    try {
      const payload = JSON.parse(atob(raw.split(".")[1]));
      myId = payload.id;
    } catch (err) {
      // ignore invalid token payload
    }

    // Fetch history via REST
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/api/messages/${userId}`);
        const msgs = Array.isArray(res.data) ? res.data : [];
        msgs.forEach((m) => {
          const id = m._id ? m._id.toString() : null;
          if (id) messageIdsRef.current.add(id);
        });
        setMessages(msgs);
        scrollToBottom();
      } catch (err) {
        console.error("Error fetching messages", err);
      }
    };

    // Initialize socket connection & listeners
    const initSocket = () => {
      // --- REPLACE START: connect socket with conversationId query ---
      const conversationId = [myId, userId].sort().join("_");
      connectSocket({ query: { conversationId } });
      // --- REPLACE END ---
      joinRoom(conversationId);

      const handleSocketMessage = (msg) => {
        const msgId = msg._id ? msg._id.toString() : null;
        if (!msgId || messageIdsRef.current.has(msgId)) return;
        messageIdsRef.current.add(msgId);
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
      };

      onNewMessage(handleSocketMessage);

      return () => {
        offNewMessage(handleSocketMessage);
        leaveRoom(conversationId);
        disconnectSocket();
      };
    };

    fetchMessages();
    const cleanup = initSocket();
    return cleanup;
  }, [userId]);

  // Sending a new message
  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;

    // parse current user ID
    const raw = localStorage.getItem("accessToken");
    let myId = null;
    try {
      const payload = JSON.parse(atob(raw.split(".")[1]));
      myId = payload.id;
    } catch (err) {
      // ignore parsing errors
    }

    const conversationId = [myId, userId].sort().join("_");

    // Optimistically emit via socket
    sendSocketMessage(conversationId, text);

    // Persist via REST
    try {
      const res = await api.post(`/api/messages/${userId}`, { text });
      const saved = res.data;
      const savedId = saved._id ? saved._id.toString() : null;
      if (savedId && !messageIdsRef.current.has(savedId)) {
        messageIdsRef.current.add(savedId);
        setMessages((prev) => [...prev, saved]);
      }
      setNewMessage("");
      scrollToBottom();
    } catch (err) {
      console.error("Error sending message", err);
    }
  };

  return (
    <div className="flex flex-col max-w-2xl mx-auto h-screen p-4">
      <h2 className="text-xl font-bold mb-2 text-center">
        💬 {t("chat.title")}
      </h2>

      <div className="flex-1 overflow-y-auto bg-gray-100 p-4 rounded shadow-sm">
        {messages.map((msg, idx) => {
          const isIncoming = msg.sender.toString() === userId;
          return (
            <div
              key={msg._id || idx}
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
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 border rounded p-2"
          placeholder={t("chat.placeholder")}
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700"
        >
          {t("chat.send")}
        </button>
      </div>
    </div>
  );
}

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.

