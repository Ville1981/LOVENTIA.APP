// --- REPLACE START: robust Upgrade that waits for auth bootstrap & keeps your flow ---
import React, { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Upgrade
 * - Uses AuthContext and waits for "bootstrapped" before deciding auth state.
 * - If logged out: shows login prompt.
 * - If logged in: shows upgrade content and navigates to /settings/subscriptions.
 * - Keeps your original button destination and plan bullets.
 * - All copy in English (consistent with the rest of the app).
 */
const Upgrade = () => {
  const navigate = useNavigate();

  // Support both shapes:
  // 1) { isLoggedIn, bootstrapped }
  // 2) { user, bootstrapped }
  const auth = useAuth?.() || {};
  const { isLoggedIn, user, bootstrapped } = auth;

  // Resolve final "authenticated" state only after bootstrap
  const authenticated = useMemo(() => {
    if (bootstrapped === false || bootstrapped === undefined) return false; // treat as "unknown"
    return typeof isLoggedIn === "boolean" ? isLoggedIn : !!user;
  }, [bootstrapped, isLoggedIn, user]);

  const handleUpgrade = () => {
    // Redirect to subscription/payment flow (kept from your original code)
    navigate("/settings/subscriptions");
  };

  // Avoid flashing the login prompt during the auth bootstrap phase
  if (!bootstrapped) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Checking your session…</h1>
        <p className="text-gray-600">Please wait a moment.</p>
      </div>
    );
  }

  // Not authenticated -> login prompt
  if (!authenticated) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Sign in required</h1>
        <p className="mb-4">
          To view Premium benefits and upgrade your account, please sign in.
        </p>
        <Link
          to="/login"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  // Authenticated -> show upgrade content
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Upgrade to Premium</h1>

      <ul className="list-disc list-inside space-y-2 text-lg">
        <li>🔍 See who liked you</li>
        <li>⭐ 3 Super Likes per week</li>
        <li>❓ Unlock all Q&amp;A visibility</li>
        <li>❤️ Unlimited likes</li>
        <li>🚫 Dealbreakers feature</li>
        <li>⏪ Unlimited rewinds</li>
        <li>📩 Unlock Intros messages</li>
        <li>🚫 No ads</li>
      </ul>

      <button
        onClick={handleUpgrade}
        className="mt-6 w-full py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition"
      >
        Continue to Subscription
      </button>

      <p className="text-xs text-gray-500">
        You’ll be redirected to your subscription settings. Payment is handled
        by your configured provider (e.g., Stripe).
      </p>
    </div>
  );
};

export default Upgrade;
// --- REPLACE END ---
