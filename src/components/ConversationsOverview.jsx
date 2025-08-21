import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import styles from "./ConversationsOverview.module.css";
import axios from "../utils/axiosInstance";

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

export default function ConversationsOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    // --- REPLACE START: fetch overview conversations ---
    axios
      .get("/api/messages/overview")
      // --- REPLACE END ---
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
      <div
        className={styles.spinner}
        role="status"
        aria-live="polite"
        aria-label={t("chat:loading", "Loading conversations...")}
      />
    );
  }

  if (error) {
    return (
      // --- REPLACE START: error display with retry ---
      <div role="alert" className={styles.error}>
        <p>{t("chat:overview.error", "Couldn’t load conversations.")}</p>
        <button
          onClick={() => window.location.reload()}
          className={styles.retryButton}
          aria-label={t("chat:overview.retry", "Retry")}
        >
          {t("chat:overview.retry", "Retry")}
        </button>
      </div>
      // --- REPLACE END ---
    );
  }

  if (conversations.length === 0) {
    // --- REPLACE START: i18n placeholder values ---
    const bunnyUser = {
      userId: "1",
      name: t("chat:overview.placeholderName", "Bunny"),
      avatarUrl: "/assets/bunny1.jpg",
      snippet: t("chat:overview.placeholderSnippet",
        "Hi there! Let's start our chat."
      ),
      lastMessageTimestamp: new Date().toISOString(),
      unreadCount: 0,
    };
    // --- REPLACE END ---

    return (
      <div
        className={styles.placeholderCard}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/chat/${bunnyUser.userId}`)}
      >
        <img
          src={bunnyUser.avatarUrl}
          alt={bunnyUser.name}
          className={styles.placeholderAvatar}
          onError={(e) => {
            e.currentTarget.src = "/assets/bunny1.jpg";
          }}
        />
        <div className={styles.placeholderContent}>
          <h3 className={styles.placeholderName}>{bunnyUser.name}</h3>
          <span className={styles.time}>
            {formatDistanceToNow(new Date(bunnyUser.lastMessageTimestamp))}
          </span>
          <p className={styles.placeholderSnippet}>{bunnyUser.snippet}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {conversations.map((conv) => (
        <div
          key={conv.userId}
          className={`${styles.card} ${
            conv.unreadCount > 0 ? styles.cardHover : ""
          }`}
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/chat/${conv.userId}`)}
        >
          <img
            src={conv.avatarUrl}
            alt={conv.displayName || conv.name}
            className={styles.avatar}
            onError={(e) => {
              e.currentTarget.src = "/assets/bunny1.jpg";
            }}
          />
          <div className={styles.content}>
            <div className={styles.header}>
              <h3 className={styles.title}>{conv.displayName || conv.name}</h3>
              <span className={styles.time}>
                {formatDistanceToNow(
                  new Date(conv.lastMessageTimestamp || conv.lastMessageTime)
                )}
              </span>
            </div>
            <p className={styles.snippet}>{conv.snippet}</p>
          </div>
          {conv.unreadCount > 0 && (
            <span className={styles.unreadBadge}>{conv.unreadCount}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// TODO: Confirm with backend that /api/messages/overview returns fields:
// userId, displayName, avatarUrl, lastMessageTimestamp, snippet, unreadCount
