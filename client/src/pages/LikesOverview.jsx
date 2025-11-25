// File: client/src/pages/LikesOverview.jsx
// --- REPLACE START: Likes overview page (outgoing/incoming/matches with Premium badges) ---
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import api from "../services/api/axiosInstance";
import { BACKEND_BASE_URL } from "../utils/config";
import WhoLikedMeCard from "../components/WhoLikedMeCard";

/**
 * Resolve a usable image URL for a user card (tolerant to various shapes).
 * NOTE: This is intentionally kept very similar to the helper on WhoLikedMe.jsx.
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
 * Small helper: normalise likes API response into a flat user array.
 * Supports shapes:
 *  - { ok, count, users: [ {...}, {...} ] }
 *  - { ok, count, users: { "<id>": {...}, ... } }
 *  - [ {...}, {...} ]
 */
function normalizeLikesUsers(data) {
  if (!data) return [];

  if (Array.isArray(data.users)) {
    return data.users;
  }

  if (data.users && typeof data.users === "object") {
    return Object.values(data.users);
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

/**
 * LikesOverview page
 *  - Shows three sections on the same page:
 *    * Outgoing likes (people you liked)
 *    * Incoming likes (people who liked you)
 *    * Matches (mutual likes)
 *  - Uses WhoLikedMeCard so that Premium badge is consistent.
 */
const LikesOverview = () => {
  const { user } = useAuth() || {};

  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [matches, setMatches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");

        const [outRes, inRes, matchRes] = await Promise.all([
          api.get("/likes/outgoing"),
          api.get("/likes/incoming"),
          api.get("/likes/matches"),
        ]);

        if (!mounted) return;

        setOutgoing(normalizeLikesUsers(outRes.data));
        setIncoming(normalizeLikesUsers(inRes.data));
        setMatches(normalizeLikesUsers(matchRes.data));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error loading likes overview:", err?.response?.data || err);

        if (!mounted) return;

        if (err?.response?.status === 401) {
          setError("Please sign in to view your likes.");
        } else {
          setError("Failed to load likes. Please try again.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchAll();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="container mx-auto p-4">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold mb-2">Likes overview</h1>
        <p className="text-sm text-gray-600">
          Here you can see people you liked, people who liked you, and your matches.
        </p>
      </header>

      {error && (
        <p className="text-center text-red-500 mb-4" role="alert">
          {error}
        </p>
      )}

      {!error && loading && (
        <p className="text-center text-gray-600 mb-4">Loading likes…</p>
      )}

      {!error && !loading && (
        <div className="space-y-10">
          {/* Outgoing likes */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">People you liked</h2>
              <span className="text-xs text-gray-500">
                {outgoing.length} user{outgoing.length === 1 ? "" : "s"}
              </span>
            </div>

            {outgoing.length === 0 ? (
              <p className="text-sm text-gray-600">
                You have not liked anyone yet. Start browsing in Discover.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {outgoing.map((u) => {
                  const key = u?._id || u?.id;
                  const targetId = key;
                  const imageSrc = resolvePhotoUrl(u);
                  const title = u?.name || u?.username || "Anonymous";
                  const email = u?.email || "";
                  const premiumTarget = isPremiumLikeUser(u);

                  return (
                    <WhoLikedMeCard
                      key={key}
                      targetId={targetId}
                      imageSrc={imageSrc}
                      title={title}
                      email={email}
                      isPremium={premiumTarget}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Incoming likes */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">People who liked you</h2>
              <span className="text-xs text-gray-500">
                {incoming.length} user{incoming.length === 1 ? "" : "s"}
              </span>
            </div>

            {incoming.length === 0 ? (
              <p className="text-sm text-gray-600">
                No incoming likes yet. When someone likes you, they will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {incoming.map((u) => {
                  const key = u?._id || u?.id;
                  const targetId = key;
                  const imageSrc = resolvePhotoUrl(u);
                  const title = u?.name || u?.username || "Anonymous";
                  const email = u?.email || "";
                  const premiumTarget = isPremiumLikeUser(u);

                  return (
                    <WhoLikedMeCard
                      key={key}
                      targetId={targetId}
                      imageSrc={imageSrc}
                      title={title}
                      email={email}
                      isPremium={premiumTarget}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Matches */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Matches</h2>
              <span className="text-xs text-gray-500">
                {matches.length} match{matches.length === 1 ? "" : "es"}
              </span>
            </div>

            {matches.length === 0 ? (
              <p className="text-sm text-gray-600">
                No matches yet. When you both like each other, the match will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {matches.map((u) => {
                  const key = u?._id || u?.id;
                  const targetId = key;
                  const imageSrc = resolvePhotoUrl(u);
                  const title = u?.name || u?.username || "Anonymous";
                  const email = u?.email || "";
                  const premiumTarget = isPremiumLikeUser(u);

                  return (
                    <WhoLikedMeCard
                      key={key}
                      targetId={targetId}
                      imageSrc={imageSrc}
                      title={title}
                      email={email}
                      isPremium={premiumTarget}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Small footer helper */}
      <footer className="mt-10 text-center text-xs text-gray-500">
        <p>
          Tip: Premium users are marked with a small yellow “Premium” badge on their card.
        </p>
        <p className="mt-1">
          Want more features?{" "}
          <Link
            to="/settings/subscriptions"
            className="text-blue-600 hover:underline font-semibold"
          >
            Manage your subscription
          </Link>
          .
        </p>
      </footer>
    </div>
  );
};

export default LikesOverview;
// --- REPLACE END ---
