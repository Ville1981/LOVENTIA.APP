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
 *   - imageSrc: custom image path (default '/ads/top-banner.png')
 *   - headline: string headline
 *   - body: string subtext
 *   - cta: JSX or string (optional)
 */
export default function AdBanner({
  className = "",
  onImpression,
  imageSrc = "/ads/top-banner.png",
  headline = "Sponsored",
  body = "Upgrade to Premium to remove all ads.",
  cta = null,
}) {
  const { user, bootstrapped } =
    typeof useAuth === "function" ? useAuth() : { user: null, bootstrapped: false };

  const [fallbackUser, setFallbackUser] = useState(null);
  const [probing, setProbing] = useState(false);
  const impressedRef = useRef(false);

  // Determine premium using context first; fallback to probed user if present
  const premium = useMemo(() => {
    if (user) return isPremiumUtil(user);
    if (fallbackUser) return isPremiumUtil(fallbackUser);
    // Default to non-premium until we know (ensures banner shows while probing)
    return false;
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
    <section
      className={`w-full max-w-3xl mx-auto mt-6 rounded-lg border bg-white shadow-sm ${className}`}
      role="complementary"
      aria-label="Advertisement"
    >
      <header className="px-4 pt-3">
        <h3 className="text-sm font-semibold text-gray-700">{headline}</h3>
      </header>

      <div className="px-2 py-3">
        {/* Fixed-height visual for uniform scale; use object-contain so the full creative remains visible. */}
        <div className="mx-auto w-full h-24 overflow-hidden rounded">
          <img
            src={imageSrc}
            alt="Advertisement"
            className="w-full h-full object-contain"
            loading="lazy"
          />
        </div>
      </div>

      {body ? <p className="px-4 pb-4 text-sm text-gray-600">{body}</p> : null}

      {cta ? (
        <div className="px-4 pb-4">
          {typeof cta === "string" ? (
            <a
              href="/subscribe"
              className="inline-flex items-center px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-gray-50"
            >
              {cta}
            </a>
          ) : (
            cta
          )}
        </div>
      ) : null}
    </section>
  );
}
// --- REPLACE END ---

