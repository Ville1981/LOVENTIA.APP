// File: client/src/pages/WhoLikedMe.jsx
// --- REPLACE START: robust "Who liked me" page (gated, English texts, shared API wrapper + safe image URL + clickable cards -> chat) ---
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import FeatureGate from "../components/FeatureGate";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api/axiosInstance"; // shared Axios wrapper (includes auth headers/interceptors)
import { BACKEND_BASE_URL } from "../utils/config";
import { hasFeature, isPremium } from "../utils/entitlements";
import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";
import WhoLikedMeCard from "../components/WhoLikedMeCard";

/**
 * Resolve a usable image URL for a user card (tolerant to various shapes).
 */
function resolvePhotoUrl(user) {
  const raw =
    user?.profilePicture ||
    user?.avatar ||
    (Array.isArray(user?.photos) ? user.photos[0] : "") ||
    "";

  if (!raw) return "/default.jpg";
  if (typeof raw !== "string") return "/default.jpg";
  if (/^https?:\/\//i.test(raw)) return raw;

  // Ensure single slash between base and path
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${BACKEND_BASE_URL}${path}`;
}

/**
 * Determine if a user in the likes API payload should be treated as Premium.
 * Supports multiple shapes:
 *  - user.premium === true
 *  - user.isPremium === true
 *  - user.entitlements.tier === "premium"
 */
function isPremiumLikeUser(user) {
  if (!user) return false;

  if (user.premium === true || user.isPremium === true) {
    return true;
  }

  const tier = user.entitlements?.tier;
  return tier === "premium";
}

/**
 * Simple CTA for users without entitlement.
 */
function UpgradeCTA() {
  return (
    <div className="text-center border rounded-md p-6 bg-amber-50 border-amber-200">
      <h3 className="text-lg font-semibold mb-2">Premium required</h3>
      <p className="text-sm text-gray-700 mb-4">
        This feature is available for Premium members. Upgrade to see who liked you.
      </p>
      <Link
        to="/settings/subscriptions"
        className="inline-flex items-center gap-2 rounded bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 font-semibold"
      >
        Manage Subscription
      </Link>
    </div>
  );
}

const WhoLikedMe = () => {
  const { user } = useAuth() || {};
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  // Only fetch when the user is entitled (prevents 403 spam in console)
  const entitled = hasFeature(user, "whoLikedMe") || isPremium(user);

  useEffect(() => {
    let mounted = true;

    const fetchWhoLikedMe = async () => {
      if (!entitled) return;

      try {
        // Use existing likes API: incoming likes to the current user
        const res = await api.get("/likes/incoming");

        // Be tolerant to different shapes:
        // - { ok, count, users: [ {...}, {...} ] }
        // - { ok, count, users: { "<id>": {...}, ... } }
        // - or even array at root for older versions.
        let list = [];

        if (Array.isArray(res?.data?.users)) {
          list = res.data.users;
        } else if (res?.data?.users && typeof res.data.users === "object") {
          list = Object.values(res.data.users);
        } else if (Array.isArray(res?.data)) {
          list = res.data;
        } else {
          list = [];
        }

        if (mounted) {
          setUsers(list);
          setError("");
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error fetching incoming likes:", err?.response?.data || err);

        if (!mounted) return;

        if (err?.response?.status === 401) {
          setError("Please sign in to view who liked you.");
        } else if (err?.response?.status === 403) {
          // Should not happen because of pre-gate, but handle gracefully
          setError("This feature is available for Premium users only.");
        } else {
          setError("Failed to load likes.");
        }
      }
    };

    fetchWhoLikedMe();

    return () => {
      mounted = false;
    };
  }, [entitled]);

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4 text-center">👀 Who liked you</h2>

      {/* Gate the entire content; fallback shows Upgrade CTA */}
      <FeatureGate feature="whoLikedMe" fallback={<UpgradeCTA />}>
        {error && (
          <p className="text-center text-red-500 mb-4" role="alert">
            {error}
          </p>
        )}

        {!error && users.length === 0 && (
          <p className="text-center text-gray-600">No likes yet.</p>
        )}

        {users.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {users.map((u) => {
              const key = u?._id || u?.id;
              const targetId = key;
              const img = resolvePhotoUrl(u);
              const title = u?.name || u?.username || "Anonymous";
              const email = u?.email || "";
              const premiumTarget = isPremiumLikeUser(u);

              return (
                <WhoLikedMeCard
                  key={key}
                  targetId={targetId}
                  imageSrc={img}
                  title={title}
                  email={email}
                  isPremium={premiumTarget}
                />
              );
            })}
          </div>
        )}
      </FeatureGate>

      {/* // --- REPLACE START: standard content ad slot (inline) --- */}
      <AdGate type="inline" debug={false}>
        <div className="max-w-3xl mx-auto mt-6">
          <AdBanner
            imageSrc="/ads/ad-right1.png"
            headline="Sponsored"
            body="Upgrade to Premium to remove all ads."
          />
        </div>
      </AdGate>
      {/* // --- REPLACE END: standard content ad slot (inline) --- */}
    </div>
  );
};

export default WhoLikedMe;
// --- REPLACE END ---



