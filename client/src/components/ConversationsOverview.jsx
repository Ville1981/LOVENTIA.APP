import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosInstance';
import { useTranslation } from 'react-i18next';

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
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    // --- REPLACE START: use full '/api/messages/overview' path ---
    axios.get('/api/messages/overview')
    // --- REPLACE END ---
      .then(res => {
        if (isMounted) {
          setConversations(res.data || []);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
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
        {t('overview.error', 'Failed to load conversations')}
      </div>
    );
  }

  // If no real conversations, fall back to placeholder user (e.g., Bunny)
  if (conversations.length === 0) {
    const bunnyUser = {
      userId: '1',
      name: 'Bunny',
      avatarUrl: '/assets/bunny1.jpg',
      snippet: "Hi there! Let's start our chat.",
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
    };
    return (
      <div className="flex justify-center items-center h-full p-4">
        <div
          className="flex items-center p-4 bg-white rounded-2xl shadow hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => window.location.href = `/chat/${bunnyUser.userId}`}
        >
          <img
            src={bunnyUser.avatarUrl}
            alt={bunnyUser.name}
            className="w-12 h-12 rounded-full mr-4"
            onError={e => e.currentTarget.src = '/assets/bunny1.jpg'}
          />
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">{bunnyUser.name}</h3>
              <span className="text-sm text-gray-400">
                {formatDistanceToNow(new Date(bunnyUser.lastMessageTime))}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{bunnyUser.snippet}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4">
      {conversations.map(conv => (
        <div
          key={conv.userId}
          className="flex items-center p-4 bg-white rounded-2xl shadow hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => window.location.href = `/chat/${conv.userId}`}
        >
          <img
            src={conv.avatarUrl}
            alt={conv.name}
            className="w-12 h-12 rounded-full mr-4"
            onError={e => e.currentTarget.src = '/assets/bunny1.jpg'}
          />
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">{conv.name}</h3>
              <span className="text-sm text-gray-400">
                {formatDistanceToNow(new Date(conv.lastMessageTime))}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{conv.snippet}</p>
          </div>
          {conv.unreadCount > 0 && (
            <span className="inline-block text-xs font-medium bg-red-500 text-white rounded-full px-2 py-1">
              {conv.unreadCount}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
