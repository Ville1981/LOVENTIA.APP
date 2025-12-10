// File: client/src/pages/settings/SubscriptionSettings.jsx

// --- REPLACE START: add i18n support + Sync support (button + call after cancel) and keep billing.js API wrapper ---
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import {
  createCheckoutSession,
  openBillingPortal,
  cancelNow,
  // NEW: wrapper for POST /api/billing/sync
  syncBilling,
} from "../../api/billing";

const Row = ({ title, children }) => (
  <div className="border border-gray-300 rounded mb-6">
    <div className="px-3 py-2 font-semibold">{title}</div>
    <div className="px-3 py-3 border-t border-gray-200">{children}</div>
  </div>
);

const SubscriptionSettings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation("premium");

  const { user, refreshUser } = useAuth?.() || { user: null, refreshUser: null };

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState("");

  // Prefer isPremium; reconcile with entitlements.tier; fallback to legacy premium
  const isLoggedIn = !!user;
  const isPremium =
    user?.isPremium ??
    (user?.entitlements?.tier === "premium") ??
    user?.premium ??
    false;
  const userEmail = user?.email ?? "";

  // Optional: refresh user from context after returning from Stripe
  const safeRefreshUser = useCallback(async () => {
    try {
      if (typeof refreshUser === "function") {
        await refreshUser();
      }
    } catch {
      /* no-op */
    }
  }, [refreshUser]);

  // Helper for retryable syncs
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Try to sync with Stripe up to `attempts` times.
   * Returns the last response (or throws the last error).
   */
  const trySyncWithRetry = useCallback(
    async (attempts = 3, delayMs = 400) => {
      let lastErr;
      for (let i = 0; i < attempts; i++) {
        try {
          const res = await syncBilling();
          // If API responded, return immediately; caller decides how to interpret flags.
          return res;
        } catch (e) {
          lastErr = e;
          if (i < attempts - 1) {
            await sleep(delayMs);
          }
        }
      }
      throw lastErr;
    },
    []
  );

  // When we come back from Stripe/Portal, URL may include flags → refresh state
  // Handle both legacy flags and ?status=success|cancel, run sync + show banner
  useEffect(() => {
    const status = searchParams.get("status"); // new style: ?status=success|cancel
    const successFlag = searchParams.get("success"); // legacy: ?success=1|true
    const canceledFlag = searchParams.get("canceled"); // legacy: ?canceled=1|true
    const portalReturn = searchParams.get("portal_return"); // legacy portal flag
    const sessionId = searchParams.get("session_id"); // Stripe checkout session id (debug)

    const returned =
      status === "success" ||
      status === "cancel" ||
      successFlag === "1" ||
      successFlag === "true" ||
      canceledFlag === "1" ||
      canceledFlag === "true" ||
      portalReturn === "1" ||
      portalReturn === "true";

    if (!returned) return;

    let ignore = false;
    (async () => {
      setMsg("");
      setSuccess("");

      // Debug only – helps when checking logs during support (safe in dev builds)
      console.debug("[SubscriptionSettings] Returned from billing", {
        status,
        successFlag,
        canceledFlag,
        portalReturn,
        sessionId,
      });

      try {
        // Explicit cancel: do not call syncBilling, just refresh local user and show a clear message.
        if (status === "cancel") {
          await safeRefreshUser();
          if (!ignore) {
            setSuccess(
              t(
                "subscriptionStatusCancelled",
                "Checkout was cancelled. Your subscription status did not change."
              )
            );
          }
          return;
        }

        // Success or generic portal return:
        // First sync (source of truth), then refresh local user.
        const syncRes = await syncBilling();
        await safeRefreshUser();

        if (!ignore) {
          const becamePremium =
            syncRes?.isPremium === true ||
            syncRes?.user?.isPremium === true ||
            syncRes?.user?.entitlements?.tier === "premium";

          // If we explicitly know this was a success-return, show a more specific banner.
          if (
            status === "success" ||
            successFlag === "1" ||
            successFlag === "true"
          ) {
            setSuccess(
              becamePremium
                ? t(
                    "subscriptionStatusPaymentOk",
                    "Payment successful. Loventia Premium is now active on your account."
                  )
                : t(
                    "subscriptionStatusPaymentPending",
                    "Payment succeeded, but we could not confirm Premium state yet. It may update in a moment or you can press Sync now."
                  )
            );
          } else {
            // Fallback banner for generic portal returns
            setSuccess(
              t(
                "subscriptionStatusReturned",
                "Returned from billing and reconciled with provider."
              )
            );
          }
        }
      } catch {
        // Even if sync fails, attempt to refresh local user so the UI will not get stuck.
        await safeRefreshUser();
        if (!ignore) {
          setMsg(
            t(
              "subscriptionStatusSyncRetry",
              "We could not fully reconcile with billing yet. Please try Sync now."
            )
          );
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [searchParams, safeRefreshUser, t]);

  // Clear banners when premium flips after a refresh
  useEffect(() => {
    setMsg("");
    setSuccess("");
  }, [isPremium]);

  // Use existing Premium benefit keys so translations are shared with Upgrade page.
  const benefits = useMemo(
    () => [
      t("benefitSeeWhoLikedYou", "See who liked you"),
      t("benefitSuperLikes", "3 Super Likes per week"),
      `${t("benefitUnlimitedLikes", "Unlimited likes")} & ${t(
        "benefitUnlimitedRewinds",
        "Unlimited rewinds"
      )}`,
      t("benefitDealbreakers", "Dealbreakers feature"),
      t("benefitNoAds", "No ads"),
    ],
    [t]
  );

  const clearBanners = () => {
    setMsg("");
    setSuccess("");
  };

  const friendlyError = useCallback(
    (fallback) => {
      setSuccess("");
      setMsg(
        fallback ||
          t(
            "subscriptionErrorBackendMissing",
            "Billing backend is not configured yet (or you are not authenticated). Please try again after logging in."
          )
      );
    },
    [t]
  );

  const handleStartPremium = useCallback(
    async () => {
      if (!isLoggedIn) {
        navigate("/login");
        return;
      }
      if (busy) return; // guard against double clicks
      setBusy(true);
      clearBanners();
      try {
        // billing.js returns an object → destructure the URL
        const { url } = await createCheckoutSession({
          email: userEmail || undefined,
        });
        if (url) {
          window.location.assign(url);
        } else {
          friendlyError(
            t(
              "subscriptionErrorCheckoutUrlMissing",
              "Checkout session URL not returned by the server."
            )
          );
        }
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401) {
          friendlyError(
            t(
              "subscriptionErrorUnauthorized",
              "Unauthorized. Please log in and try again."
            )
          );
        } else if (status === 404 || status === 501) {
          friendlyError();
        } else {
          setMsg(
            e?.message ||
              t(
                "subscriptionErrorCheckoutGeneric",
                "Unable to start checkout right now."
              )
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [isLoggedIn, navigate, userEmail, friendlyError, busy, t]
  );

  const handleOpenPortal = useCallback(
    async () => {
      if (!isLoggedIn) {
        navigate("/login");
        return;
      }
      if (busy) return; // guard against double clicks
      setBusy(true);
      clearBanners();
      try {
        // billing.js returns { url, raw }
        const { url } = await openBillingPortal();
        if (url) {
          window.location.assign(url);
        } else {
          friendlyError(
            t(
              "subscriptionErrorPortalUrlMissing",
              "Billing portal URL not returned by the server."
            )
          );
        }
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401) {
          friendlyError(
            t(
              "subscriptionErrorUnauthorized",
              "Unauthorized. Please log in and try again."
            )
          );
        } else if (status === 404 || status === 501 || status === 502) {
          friendlyError(
            status === 502
              ? t(
                  "subscriptionErrorPortal502",
                  "Temporary connection issue to Stripe. Please try again."
                )
              : undefined
          );
        } else {
          setMsg(
            e?.message ||
              t(
                "subscriptionErrorPortalGeneric",
                "Unable to open billing portal right now."
              )
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [isLoggedIn, navigate, friendlyError, busy, t]
  );

  // Explicit Sync handler (calls POST /api/billing/sync and refreshes user)
  const handleSync = useCallback(
    async () => {
      if (!isLoggedIn) {
        navigate("/login");
        return;
      }
      if (busy) return; // guard against double clicks
      setBusy(true);
      clearBanners();
      try {
        const res = await syncBilling();
        const becamePremium = res?.isPremium === true;
        const subId = res?.subscriptionId || null;
        setSuccess(
          t("subscriptionStatusSynced", {
            defaultValue:
              "Synced with billing provider: isPremium={{isPremium}}{{subIdPart}}",
            isPremium: becamePremium ? "true" : "false",
            subIdPart: subId ? `, subscriptionId=${subId}` : "",
          })
        );
        await safeRefreshUser();
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401) {
          friendlyError(
            t(
              "subscriptionErrorUnauthorized",
              "Unauthorized. Please log in and try again."
            )
          );
        } else {
          setMsg(
            e?.response?.data?.error ||
              e?.message ||
              t(
                "subscriptionErrorSyncGeneric",
                "Sync failed. Please try again."
              )
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [isLoggedIn, navigate, friendlyError, safeRefreshUser, busy, t]
  );

  // Add 2× retry sync after cancel to handle webhook lag
  const handleCancelNow = useCallback(
    async () => {
      if (!isLoggedIn) {
        navigate("/login");
        return;
      }
      if (
        !window.confirm(
          t(
            "subscriptionConfirmCancelNow",
            "Cancel your active subscription immediately? This will end access right away."
          )
        )
      ) {
        return;
      }
      if (busy) return; // guard against double clicks
      setBusy(true);
      clearBanners();
      try {
        const res = await cancelNow();
        const results = res?.results || res?.canceled || [];
        if (Array.isArray(results) && results.length > 0) {
          setSuccess(
            t(
              "subscriptionStatusCanceledNow",
              "Subscription canceled immediately. Premium access will be removed."
            )
          );

          // Try to reconcile quickly without waiting for webhook delivery
          try {
            // First attempt
            let syncRes = await syncBilling();

            // If still premium (or uncertain), try two more times with short delays
            if (syncRes?.isPremium === true) {
              syncRes = await trySyncWithRetry(2, 450);
            }

            await safeRefreshUser();

            // If after retries user still premium, inform user but do not fail the action
            if (syncRes?.isPremium === true) {
              setMsg(
                t(
                  "subscriptionStatusCancelLag",
                  "Cancellation is processed, but premium state may take a moment to reflect. It will update shortly or you can press Sync now."
                )
              );
            }
          } catch {
            // Even if syncing fails, ensure UI refresh and show clear info
            await safeRefreshUser();
            setMsg(
              t(
                "subscriptionStatusCancelWaiting",
                "Cancellation done. Waiting for billing confirmation. You can press Sync now."
              )
            );
          }
        } else {
          setMsg(
            t(
              "subscriptionStatusNoActiveSub",
              "No active subscription was found to cancel."
            )
          );
          // Attempt sync anyway in case server already updated
          try {
            await trySyncWithRetry(2, 450);
          } catch {
            // ignore retry errors here
          }
          await safeRefreshUser();
        }
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401) {
          friendlyError(
            t(
              "subscriptionErrorUnauthorized",
              "Unauthorized. Please log in and try again."
            )
          );
        } else {
          setMsg(
            e?.response?.data?.error ||
              e?.message ||
              t(
                "subscriptionErrorCancelGeneric",
                "Cancel failed. Please try again."
              )
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [
      isLoggedIn,
      navigate,
      safeRefreshUser,
      friendlyError,
      busy,
      trySyncWithRetry,
      t,
    ]
  );

  const planLabel = isPremium
    ? t("subscriptionPlanPremium", "Premium")
    : t("subscriptionPlanFree", "Free");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">
        {t("subscriptionSettingsTitle", "Subscription Settings")}
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        {t(
          "subscriptionSettingsIntro",
          "Here you can start, manage or cancel your Premium membership. This page talks to your billing provider through our backend (e.g., Stripe)."
        )}
      </p>

      {success && (
        <div
          data-testid="status-alert"
          className="mb-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900"
        >
          {success}
        </div>
      )}
      {msg && (
        <div
          data-testid="status-alert"
          className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900"
        >
          {msg}
        </div>
      )}

      <Row title={t("subscriptionCurrentPlanTitle", "Current Plan")}>
        <p className="flex items-center gap-2">
          {t("subscriptionCurrentPlanText", {
            defaultValue: "You are currently on the {{plan}} plan.",
            plan: planLabel,
          })}
          {isPremium && (
            <span
              data-testid="premium-badge"
              className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-emerald-100 border border-emerald-300"
              title={t("subscriptionPremiumBadgeTitle", "Premium active")}
            >
              {planLabel}
            </span>
          )}
        </p>
      </Row>

      <Row title={t("subscriptionGoPremiumTitle", "Go Premium")}>
        <ul className="list-disc pl-5 mb-3 space-y-1">
          {benefits.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            data-testid="upgrade-button"
            onClick={handleStartPremium}
            disabled={busy || isPremium}
            className={`px-6 py-2 rounded bg-yellow-500 text-white font-semibold hover:bg-yellow-600 transition ${
              busy || isPremium ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title={
              isPremium
                ? t(
                    "subscriptionTooltipAlreadyPremium",
                    "Already on Premium"
                  )
                : undefined
            }
          >
            {busy
              ? t("subscriptionButtonWorking", "Working…")
              : isPremium
              ? t("subscriptionButtonAlreadyPremium", "Already Premium")
              : t("subscriptionButtonStartPremium", "Start Premium")}
          </button>

          <button
            type="button"
            data-testid="open-portal-button"
            onClick={handleOpenPortal}
            disabled={busy || !isPremium}
            className={`px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition ${
              busy || !isPremium ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title={
              !isPremium
                ? t(
                    "subscriptionTooltipNoActiveSub",
                    "No active subscription to manage"
                  )
                : undefined
            }
          >
            {busy
              ? t("subscriptionButtonOpening", "Opening…")
              : t("subscriptionButtonOpenPortal", "Open Billing Portal")}
          </button>

          <button
            type="button"
            onClick={handleCancelNow}
            disabled={busy || !isPremium}
            className={`px-6 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition ${
              busy || !isPremium ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title={
              !isPremium
                ? t(
                    "subscriptionTooltipNoActiveSubToCancel",
                    "No active subscription to cancel"
                  )
                : undefined
            }
          >
            {busy
              ? t("subscriptionButtonCanceling", "Canceling…")
              : t("subscriptionButtonCancelNow", "Cancel now")}
          </button>

          {/* Explicit Sync button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={busy}
            className={`px-6 py-2 rounded bg-gray-700 text-white font-semibold hover:bg-gray-800 transition ${
              busy ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title={t(
              "subscriptionTooltipSync",
              "Force a one-click reconciliation with Stripe"
            )}
          >
            {busy
              ? t("subscriptionButtonSyncing", "Syncing…")
              : t("subscriptionButtonSyncNow", "Sync now")}
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          {t(
            "subscriptionRedirectNote",
            "You’ll be redirected to secure checkout / portal for changes. We never store your card details on our servers."
          )}
        </p>
      </Row>

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mt-2 text-sm underline"
      >
        {t("subscriptionBack", "← Back")}
      </button>
    </div>
  );
};

export default SubscriptionSettings;
// --- REPLACE END ---



