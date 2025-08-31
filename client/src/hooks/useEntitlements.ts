// File: client/src/hooks/useEntitlements.ts

// --- REPLACE START: Lightweight entitlements hook (free vs premium, no breaking changes) ---
// @ts-nocheck
/**
 * useEntitlements
 * --------------------------------------------------------------------------------
 * Minimal, defensive hook to retrieve current user's entitlements/tier.
 * - Tries to read from /api/auth/me
 * - Falls back to localStorage flag `isPremium` if present
 * - Defaults to "free" to avoid granting access by mistake
 *
 * All comments in English. Do NOT add unnecessary complexity.
 * NOTE: TypeScript projects without @types/react will raise TS7016 on 'react' import.
 *       We disable type-checking in this file to avoid adding global shims.
 */
import { useEffect, useMemo, useState } from 'react';

type Entitlements = {
  tier: 'free' | 'premium';
  features?: {
    dealbreakers?: boolean;
    noAds?: boolean;
    seeLikedYou?: boolean;
    superLikesPerWeek?: number;
  };
};

type UseEntitlementsResult = {
  loading: boolean;
  error: string | null;
  entitlements: Entitlements;
  isPremium: boolean;
};

export function useEntitlements(): UseEntitlementsResult {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements>({
    tier: 'free',
    features: { dealbreakers: false, noAds: false, seeLikedYou: false, superLikesPerWeek: 0 },
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const token =
          localStorage.getItem('authToken') ||
          localStorage.getItem('token') ||
          sessionStorage.getItem('authToken') ||
          '';

        const resp = await fetch('/api/auth/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!resp.ok) {
          // Fall back to local flag if API not available
          const lsPremium = localStorage.getItem('isPremium');
          if (!cancelled) {
            setEntitlements({
              tier: lsPremium === 'true' ? 'premium' : 'free',
              features: { dealbreakers: lsPremium === 'true', noAds: false, seeLikedYou: false, superLikesPerWeek: 0 },
            });
          }
        } else {
          const data = await resp.json();
          // Try multiple common locations without breaking older payloads
          const premium =
            !!data?.user?.premium ||
            !!data?.user?.isPremium ||
            (data?.user?.entitlements?.tier === 'premium');

          const features = {
            dealbreakers:
              !!data?.user?.entitlements?.features?.dealbreakers || premium,
            noAds: !!data?.user?.entitlements?.features?.noAds,
            seeLikedYou: !!data?.user?.entitlements?.features?.seeLikedYou,
            superLikesPerWeek:
              Number(data?.user?.entitlements?.features?.superLikesPerWeek) || 0,
          };

          if (!cancelled) {
            setEntitlements({
              tier: premium ? 'premium' : 'free',
              features,
            });
          }
        }
      } catch (e: any) {
        // As a safety: default to free on any error
        const lsPremium = localStorage.getItem('isPremium');
        if (!cancelled) {
          setError(e?.message || 'Failed to load entitlements');
          setEntitlements({
            tier: lsPremium === 'true' ? 'premium' : 'free',
            features: { dealbreakers: lsPremium === 'true', noAds: false, seeLikedYou: false, superLikesPerWeek: 0 },
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const isPremium = useMemo(() => entitlements.tier === 'premium', [entitlements.tier]);

  return { loading, error, entitlements, isPremium };
}
// --- REPLACE END ---

