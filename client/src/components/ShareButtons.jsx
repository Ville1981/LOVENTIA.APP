// --- REPLACE START: minimal share buttons (copy+native share) ---
import React, { useCallback, useState } from "react";

const ShareButtons = ({ url, title = "Loventia", text = "Join me on Loventia!" }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  }, [url]);

  const onWebShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url, title, text });
      } else {
        await onCopy();
      }
    } catch {
      /* user cancelled */
    }
  }, [url, title, text, onCopy]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onWebShare}
        className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
        data-testid="share-native"
        aria-label="Share"
        title="Share"
      >
        Share
      </button>
      <button
        type="button"
        onClick={onCopy}
        className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
        data-testid="share-copy"
        aria-label="Copy link"
        title="Copy link"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
};

// File: client/src/components/ShareButtons.jsx

// --- REPLACE START: lightweight share buttons with referral URL ---
import React, { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext'; // adapt path if needed

/**
 * Props:
 * - baseUrl: The public site URL (e.g. https://app.example.com)
 * - className: optional
 */
export default function ShareButtons({ baseUrl, className = '' }) {
  const { user } = useAuth?.() || { user: null };
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => {
    // If your backend returns /api/referral/my-code, you can fetch it here instead.
    // For now, fall back to a short hash of the user id on the client if available.
    const id = user?._id || user?.id || '';
    if (!id) return '';
    // small client-side derivation (non-secure, but fine for displaying a link)
    let h = 0;
    for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
    const short = (h >>> 0).toString(36);
    return short;
  }, [user]);

  const shareUrl = useMemo(() => {
    try {
      const u = new URL(baseUrl || window.location.origin);
      if (code) u.searchParams.set('ref', code);
      return u.toString();
    } catch {
      return window.location.origin;
    }
  }, [baseUrl, code]);

  const handleNativeShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Loventia',
          text: 'Join me on Loventia 💕',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  }, [shareUrl]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [shareUrl]);

  return (
    <div className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          readOnly
          value={shareUrl}
          className="w-full rounded border px-3 py-2 text-sm"
          aria-label="Referral link"
          data-testid="referral-link-input"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300"
            data-testid="copy-referral-button"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={handleNativeShare}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            data-testid="native-share-button"
            title="Share"
          >
            Share
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Share your link — friends who sign up via this URL are attributed to you.
      </p>
    </div>
  );
}
// --- REPLACE END ---


export default ShareButtons;
// --- REPLACE END ---
