// File: client/src/components/ConversationCard.jsx

import { formatDistanceToNowStrict, parseISO } from "date-fns";
import React from "react";
import { useTranslation } from "react-i18next";
// --- REPLACE START: import Link for navigation ---
import { Link } from "react-router-dom";
// --- REPLACE END ---

// --- REPLACE START: premium helper + badge (for conversations list) ---
/**
 * Determine if the conversation partner should be treated as Premium in the UI.
 * Supports multiple possible shapes from the API payload.
 */
function isPremiumPeer(convo) {
  if (!convo) return false;

  // Direct flags on conversation object
  if (convo.peerPremium === true) return true;
  if (convo.premium === true || convo.isPremium === true) return true;

  // Entitlements under various keys
  const tier =
    convo.peerEntitlements?.tier ||
    convo.entitlements?.tier ||
    convo.partnerEntitlements?.tier;

  return tier === "premium";
}

/**
 * Small pill badge for Premium users in the conversation list.
 */
function PremiumBadge() {
  return (
    <span className="ml-1 inline-flex items-center rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-900">
      Premium
    </span>
  );
}
// --- REPLACE END ---

/**
 * Displays a single conversation card with avatar, name, snippet, time, and unread badge.
 * Defensive defaults ensure tests won't crash if props are partially missing.
 */
export default function ConversationCard(
  // --- REPLACE START: add safe defaults to avoid undefined property access ---
  { convo = {}, onClick = undefined }
  // --- REPLACE END ---
) {
  const { t } = useTranslation();

  // --- REPLACE START: robust timestamp handling with graceful fallback ---
  const rawTimestamp =
    convo.lastMessageTimestamp ||
    convo.lastTimestamp ||
    convo.lastMessageTime ||
    convo.timestamp ||
    null;

  let timeAgo = "";
  if (rawTimestamp) {
    try {
      const parsed =
        typeof rawTimestamp === "string"
          ? parseISO(rawTimestamp)
          : new Date(rawTimestamp);
      const time = parsed instanceof Date ? parsed.getTime() : NaN;
      if (!Number.isNaN(time)) {
        timeAgo = formatDistanceToNowStrict(parsed, { addSuffix: true });
      }
    } catch {
      // keep timeAgo as empty string if parsing fails
      timeAgo = "";
    }
  }
  // --- REPLACE END ---

  // --- REPLACE START: derive stable partner identifiers for link + display ---
  const displayName =
    convo.peerName ||
    convo.partnerUsername ||
    convo.partnerEmail ||
    convo.username ||
    t("conversationCard.unknownUser", "Unknown user");

  const targetId =
    convo.userId ??
    convo.partnerId ??
    convo.peerId ??
    convo.id ??
    "";

  const premiumPeer = isPremiumPeer(convo);

  // Resolve last message snippet with safe fallbacks
  const messageSnippet =
    convo.lastMessage ?? convo.lastMessageSnippet ?? convo.snippet ?? "";
  // --- REPLACE END ---

  // --- REPLACE START: determine wrapper element for link vs. click handler ---
  const Wrapper = onClick
    ? ({ children }) => (
        <div
          className="flex items-center p-4 bg-white rounded-lg shadow hover:bg-gray-50 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter") onClick();
          }}
          data-testid="conversation-card-clickable"
        >
          {children}
        </div>
      )
    : ({ children }) => (
        <Link
          to={`/chat/${targetId}`}
          className="flex items-center p-4 bg-white rounded-lg shadow hover:bg-gray-50"
          data-testid="conversation-card-link"
        >
          {children}
        </Link>
      );
  // --- REPLACE END ---

  return (
    <Wrapper>
      {/* --- REPLACE START: avatar with meaningful alt text & fallback on error --- */}
      <img
        src={convo.peerAvatarUrl || "/default-avatar.png"}
        alt={
          displayName && displayName !== "Unknown user"
            ? `${displayName}'s avatar`
            : t("conversationCard.avatarAlt", "User avatar")
        }
        className="w-12 h-12 rounded-full object-cover mr-4"
        onError={(e) => {
          // ensure a stable fallback image even if the provided URL fails
          e.currentTarget.onerror = null;
          e.currentTarget.src = "/default-avatar.png";
        }}
      />
      {/* --- REPLACE END --- */}

      <div className="flex-1 overflow-hidden">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-gray-900 truncate flex items-center gap-1">
            {/* Keep original display logic; add safe default to avoid empty heading */}
            <span className="truncate">{displayName}</span>
            {premiumPeer && <PremiumBadge />}
          </h3>
          <span className="text-xs text-gray-500">
            {/* Show computed timeAgo only if available */}
            {timeAgo || t("conversationCard.noTime", "")}
          </span>
        </div>
        <p className="text-sm text-gray-600 truncate">
          {/* Preserve original priorities with safe fallback to empty string */}
          {messageSnippet}
        </p>
      </div>

      {Number(convo.unreadCount) > 0 && (
        <span
          className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full"
          aria-label={t(
            "conversationCard.unreadCount",
            "Unread messages"
          )}
        >
          {convo.unreadCount}
        </span>
      )}
    </Wrapper>
  );
}

// The replacement regions are marked between
// --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.


