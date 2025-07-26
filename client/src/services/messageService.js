import React from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';

/**
 * A single conversation card showing avatar, name, time, snippet, and unread count.
 * Supports optional click handler for navigation or other actions.
 */
export default function ConversationCard({ data, onClick }) {
  const { t } = useTranslation();
  const timeAgo = formatDistanceToNowStrict(
    parseISO(data.lastMessageTimestamp),
    { addSuffix: true }
  );

  return (
    // --- REPLACE START: enable click support and accessibility ---
    <div
      className={`flex items-center p-3 bg-white rounded-lg shadow hover:bg-gray-50${
        onClick ? ' cursor-pointer' : ''
      }`}
      {...(onClick
        ? {
            onClick,
            role: 'button',
            tabIndex: 0,
            onKeyDown: (e) => { if (e.key === 'Enter') onClick(); }
          }
        : {})}
    >
    // --- REPLACE END ---

      // --- REPLACE START: add meaningful alt text and fallback image on error ---
      <img
        src={data.avatarUrl}
        alt={
          data.displayName
            ? `${data.displayName}'s avatar`
            : t('conversationCard.avatarAlt', 'User avatar')
        }
        className="w-12 h-12 rounded-full object-cover"
        onError={(e) => { e.currentTarget.src = '/assets/bunny1.jpg'; }}
      />
      // --- REPLACE END ---

      <div className="flex-1 ml-3 overflow-hidden">
        <div className="flex justify-between">
          <h4 className="font-medium truncate">{data.displayName}</h4>
          <span className="text-sm text-gray-500">{timeAgo}</span>
        </div>
        <p className="text-sm text-gray-600 truncate">
          {data.lastMessageSnippet}
        </p>
      </div>

      {data.unreadCount > 0 && (
        <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
          {data.unreadCount}
        </span>
      )}
    </div>
  );
}

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.
