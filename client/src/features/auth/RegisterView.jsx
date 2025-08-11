// File: client/src/features/auth/RegisterView.jsx
import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RegisterForm from "../../components/forms/RegisterForm";
// --- REPLACE START: fix context import path to plural 'contexts' ---
import { useAuth } from "../../contexts/AuthContext";
// --- REPLACE END ---

// Optional helper for UX: suggest username from email if your RegisterForm surfaces email live.
// This component keeps logic minimal and delegates validation to the form + backend.
function suggestFromEmail(email = "") {
  const local = String(email).split("@")[0] || "";
  let s = local
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  if (s.length > 0 && s.length < 3) s = s.padEnd(3, "0");
  if (!s) s = "user-" + Math.random().toString(36).slice(2, 6);
  return s.slice(0, 30);
}

export default function RegisterView() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // If you want to prefill username based on typed email, pass defaultValues to RegisterForm.
  // Keeping minimal here to avoid duplicating state across layers.
  const defaults = useMemo(
    () => ({ username: "", name: "", email: "", password: "" }),
    []
  );

  const onSubmit = useCallback(
    async (values) => {
      setMessage("");
      setLoading(true);
      try {
        // 1) Create account (your page-level handler should call a service; kept inline minimal here)
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username: values.username?.trim() || suggestFromEmail(values.email),
            email: values.email,
            password: values.password,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          const msg = j?.message || j?.error || "Registration failed.";
          throw new Error(msg);
        }

        // 2) Login using the **context** (sets token + fetches /auth/me)
        await login(values.email, values.password);

        setMessage("Account created and login successful!");
        navigate("/profile");
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Registration failed.";
        setMessage(msg);
      } finally {
        setLoading(false);
      }
    },
    [login, navigate]
  );

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Create Account</h2>

      <RegisterForm onSubmit={onSubmit} defaultValues={defaults} />

      {message && (
        <p
          className={`mt-4 text-center ${
            message.toLowerCase().includes("successful")
              ? "text-green-600"
              : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={() => navigate("/login")}
        className="mt-4 w-full bg-gray-100 text-gray-900 py-2 rounded hover:bg-gray-200 disabled:opacity-50"
      >
        {loading ? "Please wait…" : "Already have an account? Log in"}
      </button>
    </div>
  );
}
