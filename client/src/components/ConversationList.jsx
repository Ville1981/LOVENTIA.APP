import React from 'react';
import { useQuery } from 'react-query';
import axios from '../utils/axiosInstance';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import { useTranslation } from 'react-i18next';

/**
 * A single conversation card showing avatar, name, time, snippet, and unread count.
 */
function ConversationCard({ convo }) {
  const { t } = useTranslation();
  const time = new Date(convo.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Link
      to={`/chat/${convo.userId}`}
      className="flex items-center p-4 hover:bg-gray-100 rounded-lg transition"
    >
      <img
        src={convo.peerAvatarUrl || '/default-avatar.png'}
        alt={
          // --- REPLACE START: meaningful alt text ---
          convo.peerName
            ? `${convo.peerName}'s avatar`
            : t('conversationCard.avatarAlt', 'User avatar')
          // --- REPLACE END ---
        }
        className="w-12 h-12 rounded-full mr-4"
      />

      <div className="flex-1 overflow-hidden">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-gray-900 truncate">
            {convo.peerName}
          </h3>
          <span className="text-xs text-gray-500">{time}</span>
        </div>
        <p className="text-sm text-gray-600 truncate">
          {convo.lastMessage}
        </p>
      </div>

      {convo.unreadCount > 0 && (
        <span className="ml-2 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
          {convo.unreadCount}
        </span>
      )}
    </Link>
  );
}

export default function ConversationList() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery(
    'conversationsOverview',
    () => axios.get('/api/messages/overview').then(res => res.data)
  );

  if (isLoading) {
    return <Spinner />;
  }

  if (error) {
    // --- REPLACE START: localized error message ---
    return <ErrorState message={t('chat.overview.error', 'Couldn’t load conversations.')} />;
    // --- REPLACE END ---
  }

  if (!data || data.length === 0) {
    // --- REPLACE START: localized empty state message ---
    return <EmptyState message={t('chat.overview.empty', 'No conversations yet—start chatting!')} icon="chat" />;
    // --- REPLACE END ---
  }

  return (
    <div className="space-y-2">
      {data.map(convo => (
        <ConversationCard key={convo.userId} convo={convo} />
      ))}
    </div>
  );
}

// The replacement regions are marked between // --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.
