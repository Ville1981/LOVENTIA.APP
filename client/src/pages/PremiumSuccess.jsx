// PATH: client/src/pages/PremiumSuccess.jsx
// File: client/src/pages/PremiumSuccess.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
// --- REPLACE START: use billing sync wrapper instead of direct api.post ---
import { syncBilling } from "../api/billing";
// --- REPLACE END ---

const PremiumSuccess = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // --- REPLACE START: stable attempt key to prevent dev StrictMode double-mount bursts ---
  const attemptKey = useMemo(() => {
    const sessionId = searchParams.get("session_id") || "";
    const statusParam = searchParams.get("status") || "";
    // Include both to avoid collisions; also safe if session_id is missing.
    return `billing_sync_success:${sessionId}:${statusParam}`;
  }, [searchParams]);
  // --- REPLACE END ---

  // --- REPLACE START: use i18next defaultValue correctly (options object) ---
  const [message, setMessage] = useState(
    t("premium.updating", { defaultValue: "Updating premium status..." })
  );
  // --- REPLACE END ---

  const [status, setStatus] = useState("loading"); // loading | ok | error
  const ranRef = useRef(false);

  useEffect(() => {
    // --- REPLACE START: document.title + keep UTF-8 safe text ---
    document.title = t("premium.successTitle", {
      defaultValue: "Premium subscription successful",
    });
    // --- REPLACE END ---
  }, [t]);

  useEffect(() => {
    // Guard: avoid double-run in StrictMode dev (works for re-renders, not remounts)
    if (ranRef.current) return;
    ranRef.current = true;

    // --- REPLACE START: sessionStorage helpers + "done" marker to avoid false-success ---
    const safeSessionGet = (key) => {
      try {
        if (typeof window === "undefined") return null;
        return window.sessionStorage ? sessionStorage.getItem(key) : null;
      } catch {
        return null;
      }
    };

    const safeSessionSet = (key, value) => {
      try {
        if (typeof window === "undefined") return;
        if (window.sessionStorage) sessionStorage.setItem(key, value);
      } catch {
        // ignore storage errors
      }
    };

    const safeSessionRemove = (key) => {
      try {
        if (typeof window === "undefined") return;
        if (window.sessionStorage) sessionStorage.removeItem(key);
      } catch {
        // ignore storage errors
      }
    };

    const isDoneMarker = (v) => typeof v === "string" && v.startsWith("done:");
    // --- REPLACE END ---

    const run = async () => {
      try {
        // Optional debug params (backend can ignore safely)
        const sessionId = searchParams.get("session_id") || undefined;
        const statusParam = searchParams.get("status") || undefined;

        // --- REPLACE START: skip duplicate sync calls ONLY after a confirmed success ---
        const marker = safeSessionGet(attemptKey);
        if (isDoneMarker(marker)) {
          // Already confirmed successful in this browser session. Do not call billing/sync again.
          setStatus("ok");
          setMessage(t("premium.successMessage", { defaultValue: "Premium is now active." }));
          return;
        }
        // Mark attempt as "pending" BEFORE calling to prevent racing remounts.
        safeSessionSet(attemptKey, `pending:${Date.now()}`);
        // --- REPLACE END ---

        // --- REPLACE START: call syncBilling() wrapper (handles cooldown + 429 + single-flight) ---
        await syncBilling({
          sessionId,
          status: statusParam,
          // Do not force; allow wrapper cooldown/dedupe to do its job.
          force: false,
        });
        // --- REPLACE END ---

        // --- REPLACE START: mark "done" ONLY after a confirmed successful response ---
        safeSessionSet(attemptKey, `done:${Date.now()}`);
        // --- REPLACE END ---

        setStatus("ok");
        // --- REPLACE START: correct i18next defaultValue usage ---
        setMessage(t("premium.successMessage", { defaultValue: "Premium is now active." }));
        // --- REPLACE END ---
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Premium sync failed", err);

        // --- REPLACE START: clear pending marker on failure so refresh can retry ---
        safeSessionRemove(attemptKey);
        // --- REPLACE END ---

        // --- REPLACE START: detect 429 and show a clear wait message ---
        const resp = err?.response;
        const code = resp?.data?.code || err?.code;
        const reset = resp?.data?.reset || err?.reset; // epoch ms
        if (resp?.status === 429 || code === "RATE_LIMITED") {
          const msLeft = typeof reset === "number" ? Math.max(0, reset - Date.now()) : 0;
          const secLeft = msLeft ? Math.ceil(msLeft / 1000) : null;

          setStatus("error");
          setMessage(
            secLeft
              ? `Too many requests. Please wait ${secLeft}s and refresh this page.`
              : "Too many requests. Please slow down and refresh this page."
          );
          return;
        }
        // --- REPLACE END ---

        setStatus("error");
        // --- REPLACE START: correct i18next defaultValue usage ---
        setMessage(
          t("premium.errorMessage", {
            defaultValue: "Could not update premium right now. Please try again.",
          })
        );
        // --- REPLACE END ---
      }
    };

    run();
  }, [attemptKey, searchParams, t]);

  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold mb-4">
        {t("premium.successTitle", { defaultValue: "Premium subscription successful" })}
      </h1>
      {/* --- REPLACE END --- */}

      <p className="mb-6">{message}</p>

      {status !== "loading" && (
        <div className="flex items-center justify-center gap-3">
          {/* --- REPLACE START: ensure correct route path + i18n defaultValue --- */}
          <Link
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold border"
            to="/settings/subscriptions"
          >
            {t("premium.goToSubscriptions", {
              defaultValue: "Go to subscription settings",
            })}
          </Link>

          <Link
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold border"
            to="/"
          >
            {t("common.continue", { defaultValue: "Continue" })}
          </Link>
          {/* --- REPLACE END --- */}
        </div>
      )}
    </div>
  );
};

export default PremiumSuccess;

