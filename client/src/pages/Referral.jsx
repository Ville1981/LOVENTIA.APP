// File: client/src/pages/Referral.jsx

// --- REPLACE START: simple referral page (builds link with ?ref=code + UTM) ---
import React, { useMemo } from "react";
// If you have an Auth context/hook, import it; otherwise set userId manually.
import { useAuth } from "../contexts/AuthContext";
import ShareButtons from "../components/ShareButtons";

/**
 * Referral page:
 * - Builds a simple referral URL: https://app.example.com/?ref=<code>&utm_source=referral&utm_medium=share
 * - "code" defaults to a short base36 from user._id (fallback to 'guest')
 * - No backend dependency (you can later resolve ?ref server-side to reward points)
 *
 * Testing:
 *   data-testid: referral-link, copy/use via ShareButtons testids
 */
function toBase36Short(id) {
  try {
    // If id is a Mongo ObjectId-like hex, take last 6 bytes → base36
    const hex = String(id || "").replace(/[^0-9a-f]/gi, "").slice(-12);
    if (!hex) return null;
    const num = BigInt("0x" + hex);
    return num.toString(36);
  } catch {
    return null;
  }
}

const Referral = () => {
  const { user } = useAuth?.() || { user: null };
  const userId = user?._id || user?.id || null;
  const code = useMemo(() => toBase36Short(userId) || "guest", [userId]);

  const referralUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://loventia.example.com";
    const u = new URL(origin);
    u.searchParams.set("ref", code);
    // Basic UTM tagging
    u.searchParams.set("utm_source", "referral");
    u.searchParams.set("utm_medium", "share");
    u.searchParams.set("utm_campaign", "ref-program");
    return u.toString();
  }, [code]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Invite friends</h1>
      <p className="text-gray-600 mb-6">
        Share your link below. When friends join via your link, you may unlock bonuses (coming soon).
      </p>

      <div className="border rounded p-4 mb-4">
        <div className="text-sm text-gray-500 mb-1">Your referral link</div>
        <div
          className="select-all break-all font-mono text-sm bg-gray-50 p-2 rounded"
          data-testid="referral-link"
        >
          {referralUrl}
        </div>
        <div className="mt-3">
          <ShareButtons url={referralUrl} title="Join Loventia" text="Find your match on Loventia!" />
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Tip: you can change the referral code scheme later without breaking existing links if you keep
        server-side resolution backward compatible.
      </div>
    </div>
  );
};

// File: client/src/pages/Referral.jsx

// --- REPLACE START: tiny referral page embedding the buttons ---
import React from 'react';
import ShareButtons from '../components/ShareButtons';

export default function Referral() {
  const baseUrl =
    import.meta?.env?.VITE_PUBLIC_APP_URL ||
    window.location.origin;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Invite friends</h1>
      <p className="mb-4 text-sm text-gray-600">
        Share your personal referral link. Friends who join using your link will be attributed to your account.
      </p>

      <ShareButtons baseUrl={baseUrl} />

      <div className="mt-6 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Pro tip: You can also paste the link into your social profiles. We use standard UTM-less referral tags to keep
        links short and readable.
      </div>
    </div>
  );
}
// --- REPLACE END ---


export default Referral;
// --- REPLACE END ---
