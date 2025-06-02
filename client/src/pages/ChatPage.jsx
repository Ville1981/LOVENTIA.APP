import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

const ChatPage = () => {
  const { t } = useTranslation();
  const { userId } = useParams(); // Vastapuolen käyttäjän ID
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/messages/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setMessages(res.data);
        scrollToBottom();
      } catch (err) {
        console.error("Virhe viestien haussa", err);
      }
    };

    fetchMessages();
  }, [userId, token]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    try {
      const res = await axios.post(
        `http://localhost:5000/api/messages/${userId}`,
        { text: newMessage },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setMessages((prev) => [...prev, res.data]);
      setNewMessage("");
      scrollToBottom();
    } catch (err) {
      console.error("Virhe viestin lähetyksessä", err);
    }
  };

  return (
    <div className="flex flex-col max-w-2xl mx-auto h-screen p-4">
      <h2 className="text-xl font-bold mb-2 text-center">💬 {t("chat.title")}</h2>

      <div className="flex-1 overflow-y-auto bg-gray-100 p-4 rounded shadow-sm">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`my-2 flex ${
              msg.sender === userId ? "justify-start" : "justify-end"
            }`}
          >
            <div
              className={`p-2 rounded-lg max-w-xs ${
                msg.sender === userId ? "bg-white text-left" : "bg-blue-500 text-white text-right"
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
};

export default ChatPage;
