// File: client/src/features/auth/LoginView.jsx
import React, { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";

// --- REPLACE START: fix context import path to plural 'contexts' ---
import LoginForm from "../../components/forms/LoginForm";
import { useAuth } from "../../contexts/AuthContext";
// --- REPLACE END ---

export default function LoginView() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [message, setMessage] = useState("");

  const onSubmit = useCallback(
    async (values) => {
      setMessage("");
      try {
        await login(values.email, values.password);
        setMessage("Login successful!");
        navigate("/profile");
      } catch (err) {
        setMessage(
          err?.response?.data?.error ||
            "Login failed. Please check your credentials."
        );
      }
    },
    [login, navigate]
  );

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Log In</h2>

      <LoginForm onSubmit={onSubmit} />

      <div className="mt-4 text-center">
        <Link
          to="/forgot-password"
          className="text-sm text-blue-600 hover:underline"
        >
          Forgot your password?
        </Link>
      </div>

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

      {import.meta && import.meta.env && import.meta.env.DEV ? (
        <div className="mt-6 text-xs text-gray-500">
          {/* Small dev hint block for debugging */}
          <p>
            DEV: LoginView uses AuthContext.login → attaches token → fetches
            /auth/me. Make sure server refresh expects empty body ({}).
          </p>
        </div>
      ) : null}
    </div>
  );
}
