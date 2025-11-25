// PATH: client/src/pages/Login.jsx

import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

// --- REPLACE START: use plural 'contexts' folder + rely on AuthContext.login ---
import { useAuth } from "../contexts/AuthContext";
// --- REPLACE END ---

// NOTE:
// - We do NOT call axios directly here.
// - AuthContext.login(...) handles tokens + /me fetch and knows the correct backend endpoint.
// - This component only shows the form and redirects after a successful login.

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Prefer redirect target passed by ProtectedRoute, fallback to /profile
  const from = location.state?.from?.pathname || "/profile";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    // Normalize inputs a bit before sending
    const trimmedEmail = (email || "").trim();
    const trimmedPassword = password || "";

    try {
      if (import.meta?.env?.DEV) {
        // eslint-disable-next-line no-console
        console.info("[Login] Attempting login for:", trimmedEmail);
      }

      // Call only the context login – it handles tokens and user fetching.
      await login(trimmedEmail, trimmedPassword);

      setMessage("Login successful!");
      // Replace history so that back button does not return to /login
      navigate(from, { replace: true });
    } catch (err) {
      const apiMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message;
      setMessage(apiMsg || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Log In</h2>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border p-2 rounded"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full border p-2 rounded"
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Log In"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link
          to="/forgot-password"
          className="text-sm text-blue-600 hover:underline"
        >
          Forgot your password?
        </Link>
      </div>

      {/* --- REPLACE START: add visible link to Register page --- */}
      <div className="mt-2 text-center">
        <span className="text-sm text-gray-700 mr-1">
          Don&apos;t have an account yet?
        </span>
        <Link
          to="/register"
          className="text-sm text-blue-600 font-medium hover:underline"
        >
          Create account
        </Link>
      </div>
      {/* --- REPLACE END: add visible link to Register page --- */}

      {message && (
        <p
          className={`mt-4 text-center ${
            message.toLowerCase().includes("success")
              ? "text-green-600"
              : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default Login;

// The replacement regions are marked between // --- REPLACE START and // --- REPLACE END

