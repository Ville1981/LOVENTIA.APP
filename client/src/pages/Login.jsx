import React from "react";
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

// --- REPLACE START: use plural 'contexts' folder + rely on AuthContext.login ---
import { useAuth } from "../contexts/AuthContext";
// --- REPLACE END ---

// NOTE:
// - We do NOT call axios directly here.
// - AuthContext.login(...) already knows the correct backend endpoint
//   (we just changed it to `/api/users/login` in AuthContext).
// - That keeps this component clean and future-proof.

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Prefer redirect target passed by ProtectedRoute, fallback to /profile (or /)
  const from = location.state?.from?.pathname || "/profile";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      // --- REPLACE START: call context login only (it already hits /api/users/login) ---
      await login(email, password);
      // --- REPLACE END ---

      setMessage("Login successful!");
      // Replace history so back button doesn't return to /login
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

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END
