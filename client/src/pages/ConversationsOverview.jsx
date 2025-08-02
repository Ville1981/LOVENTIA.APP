// src/pages/ConversationsOverview.jsx

import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosInstance';
import { useTranslation } from 'react-i18next';

/**
 * Placeholder conversation when none exist
 */
const bunnyUser = {
  userId: 'bunny',
  name: 'Bunny',
  avatarUrl: '/assets/bunny1.jpg',
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

/**
 * ConversationsOverview page
 *
 * Fetches the list of conversations, handles loading, error, and empty states,
 * and falls back to a Bunny placeholder if the list is empty.
 */
export default function ConversationsOverview() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    axios
      .get('/api/messages/overview')
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

  // Loading state
  if (loading) {
    return (
      <section className="flex justify-center items-center h-full" aria-busy="true">
        <span className="spinner" />
        <p className="sr-only">{t('chat.overview.loading', 'Loading conversations…')}</p>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="text-center p-4 text-red-600" role="alert">
        {t('chat.overview.error', 'Unable to load conversations.')}
      </section>
    );
  }

  // If no conversations, show Bunny placeholder
  const list = conversations.length > 0 ? conversations : [bunnyUser];

  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4"
      aria-label={t('chat.overview.title', 'Conversations')}
    >
      {list.map((conv) => (
        <div
          key={conv.userId}
          className="flex items-center p-4 bg-white rounded-2xl shadow hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => (window.location.href = `/chat/${conv.userId}`)}
        >
          <img
            src={conv.avatarUrl}
            alt={`${conv.name} avatar`}
            className="w-12 h-12 rounded-full mr-4 object-cover"
            onError={(e) => {
              e.currentTarget.src = '/assets/bunny1.jpg';
            }}
          />
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold truncate">{conv.name}</h3>
              <span className="text-sm text-gray-400">
                {formatDistanceToNow(new Date(conv.lastMessageTime))}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{conv.snippet}</p>
          </div>
          {conv.unreadCount > 0 && (
            <div className="ml-4">
              <span className="inline-block text-xs font-medium bg-red-500 text-white rounded-full px-2 py-1">
                {conv.unreadCount}
              </span>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
