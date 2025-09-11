// File: client/src/components/AdBanner.jsx

// --- REPLACE START: render ads only for non-premium users; robust to auth bootstrap state ---
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/axiosInstance";
import { useAuth } from "../contexts/AuthContext";
import { isPremium as isPremiumUtil } from "../utils/entitlements";

/**
 * AdBanner
 * - Renders an advertisement only when the current user is NOT premium.
 * - Uses AuthContext when available; falls back to a lightweight /api/users/me probe.
 * - Never logs sensitive data. All texts are in English.
 *
 * Optional props:
 *   - className: string for outer container styles
 *   - onImpression: () => void  (fires once when the banner is actually shown)
 *   - imageSrc: custom image path (default '/ads/sample-banner.jpg')
 *   - headline: string headline
 *   - body: string subtext
 *   - cta: JSX or string (optional)
 */
export default function AdBanner({
  className = "",
  onImpression,
  imageSrc = "/ads/sample-banner.jpg",
  headline = "Sponsored",
  body = "Upgrade to Premium to remove all ads.",
  cta = null,
}) {
  const { user, bootstrapped } = typeof useAuth === "function" ? useAuth() : { user: null, bootstrapped: false };
  const [fallbackUser, setFallbackUser] = useState(null);
  const [probing, setProbing] = useState(false);
  const impressedRef = useRef(false);

  // Determine premium using context first; fallback to probed user if present
  const premium = useMemo(() => {
    if (user) return isPremiumUtil(user);
    if (fallbackUser) return isPremiumUtil(fallbackUser);
    return false; // default to non-premium until we know (will be probed below)
  }, [user, fallbackUser]);

  // Probe /api/users/me only if:
  //  - Auth context is not bootstrapped yet, OR
  //  - user is null (e.g., legacy pages outside provider)
  useEffect(() => {
    let abort = false;

    async function probeMe() {
      if (probing || user || bootstrapped) return;
      setProbing(true);
      try {
        const res = await api.get("/api/users/profile").catch(async () => {
          // Try a couple of legacy aliases if needed
          try {
            return await api.get("/api/users/me");
          } catch {
            return await api.get("/api/me");
          }
        });
        if (!abort) setFallbackUser(res?.data || null);
      } catch {
        if (!abort) setFallbackUser(null);
      } finally {
        if (!abort) setProbing(false);
      }
    }

    probeMe();
    return () => {
      abort = true;
    };
  }, [user, bootstrapped, probing]);

  // Fire impression only once when banner is actually visible
  useEffect(() => {
    if (!premium && typeof onImpression === "function" && !impressedRef.current) {
      impressedRef.current = true;
      try {
        onImpression();
      } catch {
        /* no-op */
      }
    }
  }, [premium, onImpression]);

  // Premium users see no ads
  if (premium) return null;

  // Render ad
  return (
    <div
      className={`bg-amber-50 border border-amber-200 p-4 rounded-lg shadow-sm text-center mt-6 ${className}`}
      role="complementary"
      aria-label="Advertisement"
    >
      <h3 className="text-base font-semibold text-amber-800 mb-2">{headline}</h3>

      <div className="flex items-center justify-center">
        {/* Use a neutral, local asset by default; project can swap to any ad provider safely */}
        <img
          src={imageSrc}
          alt="Advertisement"
          className="mx-auto h-28 md:h-32 object-contain select-none pointer-events-none"
          loading="lazy"
        />
      </div>

      {body ? <p className="mt-3 text-sm text-amber-700">{body}</p> : null}

      {cta ? (
        <div className="mt-3">
          {typeof cta === "string" ? (
            <a
              href="/subscribe"
              className="inline-flex items-center px-3 py-1.5 rounded-md border border-amber-300 text-sm font-medium hover:bg-amber-100"
            >
              {cta}
            </a>
          ) : (
            cta
          )}
        </div>
      ) : null}
    </div>
  );
}
// --- REPLACE END ---

