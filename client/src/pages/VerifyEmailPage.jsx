// File: client/src/pages/VerifyEmailPage.jsx
// --- REPLACE START: full file – Email verification page wired to axios/api + AuthContext ---
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

import api from "../utils/axiosInstance";
import { useAuth } from "../contexts/AuthContext";

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth() || {};

  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    // --- REPLACE START: robust token/id extraction + send as query AND body ---
    // Try to read from React Router search params first…
    let token = searchParams.get("token");
    let id = searchParams.get("id");

    // …and fall back to window.location.search just in case
    if (!token || !id) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        token = token || urlParams.get("token");
        id = id || urlParams.get("id");
      } catch {
        // ignore URL parsing errors; handled below
      }
    }

    if (!token || !id) {
      setStatus("error");
      setMessage("Verification link is invalid. Missing token or id.");
      return;
    }

    const verify = async () => {
      setStatus("loading");
      setMessage("");

      try {
        // Send token + id both as query parameters and in the request body
        const url = `/auth/verify-email?token=${encodeURIComponent(
          token
        )}&id=${encodeURIComponent(id)}`;

        const res = await api.post(url, {
          token,
          id,
        });

        const data = res?.data || {};

        // If backend returns a normalized user, try to update AuthContext
        if (data.user && typeof setUser === "function") {
          try {
            setUser(data.user);
          } catch {
            // ignore setUser failures – do not break verification flow
          }
        }

        const successMessage =
          data?.message ||
          "Email verified successfully. You can continue using Loventia.";

        setStatus("success");
        setMessage(successMessage);
      } catch (err) {
        const apiErrorMessage =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Email verification failed. The link may be invalid or expired.";

        setStatus("error");
        setMessage(apiErrorMessage);
      }
    };

    verify();
    // --- REPLACE END ---
  }, [searchParams, setUser]);

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoDiscover = () => {
    navigate("/discover");
  };

  const isLoading = status === "loading";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10 bg-slate-50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-md border border-slate-100 p-6 md:p-8">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Status "icon" */}
          <div className="w-12 h-12 flex items-center justify-center rounded-full border border-slate-200">
            {isLoading && (
              <span className="animate-spin text-sm" aria-hidden="true">
                ⏳
              </span>
            )}
            {isSuccess && (
              <span className="text-xl" aria-hidden="true">
                ✅
              </span>
            )}
            {isError && (
              <span className="text-xl" aria-hidden="true">
                ⚠️
              </span>
            )}
            {status === "idle" && (
              <span className="text-xl" aria-hidden="true">
                ✉️
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            {isLoading && "Verifying your email…"}
            {isSuccess && "Email verified"}
            {isError && "Email verification problem"}
            {status === "idle" && "Verify your email"}
          </h1>

          {/* Message */}
          <p className="text-sm md:text-base text-slate-600">
            {isLoading &&
              "Please wait while we verify your email address with Loventia."}
            {!isLoading && message}
          </p>

          {/* Actions */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3 w-full justify-center">
            <button
              type="button"
              onClick={handleGoDiscover}
              disabled={isLoading}
              className="inline-flex justify-center px-4 py-2 rounded-full text-sm font-medium border border-slate-300 bg-slate-900 text-white disabled:opacity-60 hover:bg-slate-800 transition"
            >
              Go to Discover
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              disabled={isLoading}
              className="inline-flex justify-center px-4 py-2 rounded-full text-sm font-medium border border-slate-200 bg-white text-slate-800 disabled:opacity-60 hover:bg-slate-50 transition"
            >
              Back to Home
            </button>
          </div>

          {/* Small technical hint */}
          <p className="mt-4 text-xs text-slate-400">
            If this link was already used before, you may see a message saying
            that your email is already verified. That is normal.
          </p>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
// --- REPLACE END ---


