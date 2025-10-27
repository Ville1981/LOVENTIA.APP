// File: client/src/pages/WhoLikedMe.jsx
// --- REPLACE START: robust "Who liked me" page (gated, English texts, shared API wrapper + safe image URL) ---
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import FeatureGate from "../components/FeatureGate";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api/axiosInstance"; // ✅ shared Axios wrapper (includes auth headers/interceptors)
import { BACKEND_BASE_URL } from "../utils/config";
import { hasFeature, isPremium } from "../utils/entitlements";
import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";


/** Resolve a usable image URL for a user card (tolerant to various shapes) */
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

/** Simple CTA for users without entitlement */
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
        // Server route should be protected by middleware/entitlements
        const res = await api.get("/wholikedme"); // ✅ align to your server route
        const list = Array.isArray(res?.data?.users)
          ? res.data.users
          : Array.isArray(res?.data)
          ? res.data
          : [];
        if (mounted) setUsers(list);
      } catch (err) {
        console.error("Error fetching likes:", err?.response?.data || err);
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {users.map((u) => {
            const key = u?._id || u?.id;
            const img = resolvePhotoUrl(u);
            const title = u?.name || u?.username || "Anonymous";
            const email = u?.email || "";
            return (
              <div key={key} className="bg-white p-4 rounded shadow-md text-center">
                <img
                  src={img}
                  alt={title}
                  className="w-full h-48 object-cover rounded mb-3"
                  loading="lazy"
                />
                <h3 className="text-lg font-bold">{title}</h3>
                {email && <p className="text-sm text-gray-600">{email}</p>}
              </div>
            );
          })}
        </div>
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
{/* // --- REPLACE END --- */}
</div>
  );
};

export default WhoLikedMe;
// --- REPLACE END ---
