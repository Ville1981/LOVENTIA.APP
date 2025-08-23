// --- REPLACE START: align ResetPassword page with backend API (token only, field name "password") ---
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../utils/axiosInstance";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Backend email link is .../reset-password?token=<RAW_TOKEN>
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid password reset link.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!token) {
      return setError("Invalid or missing reset token.");
    }
    if (password !== confirm) {
      return setError("Passwords do not match.");
    }

    try {
      // Backend expects: { token, password }
      const res = await api.post("/auth/reset-password", {
        token,
        password,
      });

      setMessage(res.data.message || "Password has been reset successfully.");
      // Small delay so user sees the success
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      console.error("Reset password error:", err);
      setError(
        err?.response?.data?.error ||
          "Something went wrong. Please try again later."
      );
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-4">Reset Your Password</h2>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {!error && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block font-medium mb-1">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 px-3 py-2 rounded"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block font-medium mb-1">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full border border-gray-300 px-3 py-2 rounded"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700"
          >
            Reset Password
          </button>
        </form>
      )}

      {message && (
        <p className="mt-4 text-green-600">{message} Redirecting to login...</p>
      )}
    </div>
  );
}
// --- REPLACE END ---
