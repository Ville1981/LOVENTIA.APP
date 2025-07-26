import React, { useEffect, useState, useRef } from "react";
import api from "../utils/axiosInstance";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

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

  // duplicate‑guard: track rendered message IDs
  const messageIdsRef = useRef(new Set());

  // Utility to scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!userId) return;

    // 1) Fetch history via REST
    const fetchMessages = async () => {
      try {
        // --- REPLACE START: use full '/api/messages/:userId' path ---
        const res = await api.get(`/api/messages/${userId}`);
        // --- REPLACE END ---
        const msgs = res.data || [];

        // populate duplicate‑guard
        msgs.forEach((m) => {
          if (m._id) messageIdsRef.current.add(m._id);
        });

        setMessages(msgs);
        scrollToBottom();
      } catch (err) {
        console.error("Error fetching messages", err);
      }
    };

    // 2) Initialize socket connection & listeners
    const initSocket = () => {
      // --- REPLACE START: connect socket to backend ---
      connectSocket();
      // --- REPLACE END ---

      const raw = localStorage.getItem("accessToken");
      let myId;
      try {
        const payload = JSON.parse(atob(raw.split(".")[1]));
        myId = payload.id;
      } catch {
        myId = null;
      }
      const room = `chat_${myId}_${userId}`;

      joinRoom(room);

      const handleSocketMessage = (msg) => {
        if (!msg._id || messageIdsRef.current.has(msg._id)) return;
        messageIdsRef.current.add(msg._id);
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
      };

      onNewMessage(handleSocketMessage);

      return () => {
        offNewMessage(handleSocketMessage);
        leaveRoom(room);
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

    // Optimistically emit via socket
    const raw = localStorage.getItem("accessToken");
    let myId;
    try {
      const payload = JSON.parse(atob(raw.split(".")[1]));
      myId = payload.id;
    } catch {
      myId = null;
    }
    const room = `chat_${myId}_${userId}`;
    sendSocketMessage(room, text);

    // Persist via REST
    try {
      // --- REPLACE START: use full '/api/messages/:userId' path ---
      const res = await api.post(`/api/messages/${userId}`, { text });
      // --- REPLACE END ---
      const saved = res.data;
      if (saved._id && !messageIdsRef.current.has(saved._id)) {
        messageIdsRef.current.add(saved._id);
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
        {messages.map((msg, idx) => (
          <div
            key={msg._id || idx}
            className={`my-2 flex ${
              msg.sender === userId ? "justify-start" : "justify-end"
            }`}
          >
            <div
              className={`p-2 rounded-lg max-w-xs whitespace-pre-wrap ${
                msg.sender === userId
                  ? "bg-white text-left"
                  : "bg-blue-500 text-white text-right"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
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
// so you can verify exactly what changed
