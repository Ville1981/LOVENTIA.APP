// File: client/src/pages/Register.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

// --- REPLACE START: context + services + api imports ---
import { useAuth } from "../contexts/AuthContext";
import authService from "../services/authService";
import api from "../utils/axiosInstance";
// --- REPLACE END ---

const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/i;

function makeUsernameSuggestion(email = "") {
  // Convert "john.smith@example.com" → "john.smith"
  const local = String(email).split("@")[0] || "";
  // Sanitize to allowed charset
  let suggestion = local
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");

  // Enforce min length of 3 by padding with '0' if necessary
  if (suggestion.length > 0 && suggestion.length < 3) {
    suggestion = suggestion.padEnd(3, "0");
  }
  // Fallback if empty
  if (!suggestion) suggestion = "user-" + Math.random().toString(36).slice(2, 6);
  // Trim to max 30 chars
  return suggestion.slice(0, 30);
}

const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false); // do not overwrite if user edits
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // --- REPLACE START: loading, message and mode state ---
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  // "form" = normal register form, "checkEmail" = show check-email screen
  const [mode, setMode] = useState("form");
  // --- REPLACE END ---

  // --- REPLACE START: auto-suggest username from email until user edits username manually ---
  const suggestedUsername = useMemo(() => makeUsernameSuggestion(email), [email]);

  useEffect(() => {
    if (!usernameTouched) {
      setUsername(suggestedUsername);
    }
  }, [suggestedUsername, usernameTouched]);
  // --- REPLACE END ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    // --- REPLACE START: validation messages in English + username validation ---
    if (!USERNAME_REGEX.test(username)) {
      setMessage(
        "Username must be 3–30 characters and only contain letters, numbers, dot, underscore, or hyphen."
      );
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters long.");
      return;
    }
    // --- REPLACE END ---

    try {
      setLoading(true);

      // --- REPLACE START: register → login → send verification email → show check-email screen ---
      // 1) Register user via backend service
      await authService.register({ username, email, password });

      // 2) Login via AuthContext (single source of truth for tokens and /auth/me)
      await login(email, password);

      // 3) Best-effort: send verification email for the newly registered user.
      //    IMPORTANT: send email in the request body, same as our PowerShell test.
      try {
        await api.post("/auth/send-verification-email", { email });
      } catch (sendErr) {
        // Do not block the user if email sending fails; this is logged for debugging only.
        // eslint-disable-next-line no-console
        console.error(
          "Failed to send verification email after register:",
          sendErr
        );
      }

      // 4) Switch UI into "check your email" mode
      setMode("checkEmail");
      setMessage("");
      // --- REPLACE END ---
    } catch (err) {
      // --- REPLACE START: show specific backend errors where possible ---
      const status = err?.response?.status;
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message;

      if (status === 400 && /username/i.test(serverMsg || "")) {
        setMessage("Username is required.");
      } else if (status === 409 && /username/i.test(serverMsg || "")) {
        setMessage("This username is already taken.");
      } else if (status === 409 && /email/i.test(serverMsg || "")) {
        setMessage("This email is already registered.");
      } else {
        setMessage(serverMsg || "Registration failed.");
      }
      // --- REPLACE END ---
    } finally {
      setLoading(false);
    }
  };

  const goToDiscover = () => {
    navigate("/discover");
  };

  const goToHome = () => {
    navigate("/");
  };

  // If we are in "check email" mode, show the verification instructions screen.
  if (mode === "checkEmail") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-10 bg-slate-50">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-md border border-slate-100 p-6 md:p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-full border border-slate-200">
              <span className="text-xl" aria-hidden="true">
                ✉️
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
              {t("auth.register.checkEmailTitle", "Check your email")}
            </h1>

            <p className="text-sm md:text-base text-slate-600">
              {t(
                "auth.register.checkEmailBody",
                "We have sent a verification link to your email. Please open it to verify your address before you continue."
              )}
            </p>

            <p className="text-xs md:text-sm text-slate-500">
              {t(
                "auth.register.sentTo",
                "We tried to send the email to {{email}}.",
                { email }
              )}
            </p>

            <div className="mt-4 flex flex-col sm:flex-row gap-3 w-full justify-center">
              <button
                type="button"
                onClick={goToDiscover}
                className="inline-flex justify-center px-4 py-2 rounded-full text-sm font-medium border border-slate-300 bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                {t("auth.register.goToDiscover", "Go to Discover")}
              </button>
              <button
                type="button"
                onClick={goToHome}
                className="inline-flex justify-center px-4 py-2 rounded-full text-sm font-medium border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition"
              >
                {t("auth.register.goToHome", "Back to Home")}
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              {t(
                "auth.register.checkEmailHint",
                "If you do not see the email, check your spam folder or try again later from Settings → Email verification."
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default: registration form
  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto mt-10 space-y-4 bg-white p-6 rounded shadow"
      noValidate
    >
      <h2 className="text-xl font-bold">
        {t("auth.register.title", "Create account")}
      </h2>

      {/* --- REPLACE START: username field with touch tracking and English/i18n placeholder --- */}
      <input
        type="text"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          setUsernameTouched(true);
        }}
        onFocus={() => setUsernameTouched(true)}
        placeholder={t("auth.register.usernamePlaceholder", "Username")}
        className="w-full border p-2 rounded"
        required
        aria-label={t("auth.register.usernameAria", "Username")}
        autoComplete="username"
        pattern="[A-Za-z0-9._-]{3,30}"
        title="3–30 characters: letters, numbers, dot, underscore, or hyphen."
      />
      {/* --- REPLACE END --- */}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("auth.register.emailPlaceholder", "Email")}
        className="w-full border p-2 rounded"
        required
        aria-label={t("auth.register.emailAria", "Email")}
        autoComplete="email"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("auth.register.passwordPlaceholder", "Password")}
        className="w-full border p-2 rounded"
        required
        aria-label={t("auth.register.passwordAria", "Password")}
        autoComplete="new-password"
      />

      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder={t(
          "auth.register.confirmPasswordPlaceholder",
          "Confirm password"
        )}
        className="w-full border p-2 rounded"
        required
        aria-label={t("auth.register.confirmPasswordAria", "Confirm password")}
        autoComplete="new-password"
      />

      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        disabled={
          loading ||
          !username ||
          !email ||
          !password ||
          !confirmPassword ||
          !USERNAME_REGEX.test(username)
        }
      >
        {loading
          ? t("auth.register.creating", "Creating…")
          : t("auth.register.submit", "Create account")}
      </button>

      {message && <p className="text-sm text-red-600">{message}</p>}

      {/* --- REPLACE START: small helper text for username rules (can be moved to i18n later) --- */}
      <p className="text-xs text-gray-500">
        Username: 3–30 chars. Allowed: letters, numbers, dot, underscore, hyphen.
      </p>
      {/* --- REPLACE END --- */}
    </form>
  );
};

export default Register;

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END

