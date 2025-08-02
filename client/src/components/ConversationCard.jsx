// File: src/components/ConversationCard.jsx
import React from 'react';
import { Link } from 'react-router-dom'; // --- REPLACE START: import Link for navigation ---
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
// --- REPLACE END ---

/**
 * Displays a single conversation card with avatar, name, snippet, time, and unread badge.
 */
export default function ConversationCard({ convo, onClick }) {
  const { t } = useTranslation();
  const timestamp = convo.lastMessageTimestamp || convo.lastTimestamp;
  const timeAgo = formatDistanceToNowStrict(parseISO(timestamp), { addSuffix: true });

  // --- REPLACE START: determine wrapper element for link vs. click handler ---
  const Wrapper = onClick
    ? ({ children }) => (
        <div
          className="flex items-center p-4 bg-white rounded-lg shadow hover:bg-gray-50 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onClick();
          }}
        >
          {children}
        </div>
      )
    : ({ children }) => (
        <Link
          to={`/chat/${convo.userId}`}
          className="flex items-center p-4 bg-white rounded-lg shadow hover:bg-gray-50"
        >
          {children}
        </Link>
      );
  // --- REPLACE END ---

  return (
    <Wrapper>
      {/* --- REPLACE START: avatar with meaningful alt text & fallback on error --- */}
      <img
        src={convo.peerAvatarUrl || '/default-avatar.png'}
        alt={
          convo.peerName
            ? `${convo.peerName}'s avatar`
            : t('conversationCard.avatarAlt', 'User avatar')
        }
        className="w-12 h-12 rounded-full object-cover mr-4"
        onError={(e) => {
          e.currentTarget.src = '/default-avatar.png';
        }}
      />
      {/* --- REPLACE END --- */}

      <div className="flex-1 overflow-hidden">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-gray-900 truncate">{convo.peerName}</h3>
          <span className="text-xs text-gray-500">{timeAgo}</span>
        </div>
        <p className="text-sm text-gray-600 truncate">
          {convo.lastMessage || convo.lastMessageSnippet}
        </p>
      </div>

      {convo.unreadCount > 0 && (
        <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
          {convo.unreadCount}
        </span>
      )}
    </Wrapper>
  );
}

// The replacement regions are marked between
// --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.
