// PATH: client/src/components/ResetPassword.jsx

// --- REPLACE START: align ResetPassword component with backend API (must send token + password, optional id) ---
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../utils/axiosInstance";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Backend expects POST /api/auth/reset-password
  // Body:
  // {
  //   token: "...",        // required
  //   password: "...",     // required
  //   id: "..."            // optional
  // }
  //
  // URL we open from email / manually:
  // http://localhost:5174/reset-password?token=...&id=...
  // → read BOTH from search params
  const token = searchParams.get("token");
  const id = searchParams.get("id");

  // Local UI state
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // If user lands here without token → show immediate error (nicer than 400)
  useEffect(() => {
    if (!token || token.trim() === "") {
      setError("Invalid password reset link.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    // Frontend-level validation
    if (!token || token.trim() === "") {
      return setError("Invalid or missing reset token.");
    }
    if (!password) {
      return setError("Password is required.");
    }
    if (password !== confirm) {
      return setError("Passwords do not match.");
    }

    // Build payload EXACTLY like backend wants
    const payload = {
      token: token.trim(),
      password,
    };

    // Send id only if present in URL
    if (id && id.trim() !== "") {
      payload.id = id.trim();
    }

    try {
      const res = await api.post("/auth/reset-password", payload);

      setMessage(
        res?.data?.message || "Password has been reset successfully."
      );

      // After short delay, go to login
      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err) {
      console.error("Reset password error:", err);
      const backendError =
        err?.response?.data?.error ||
        err?.message ||
        "Something went wrong. Please try again later.";
      setError(backendError);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-4">Reset Your Password</h2>

      {/* DEV helper – keep commented so it does not show in prod
      <pre className="text-xs bg-gray-50 p-2 mb-4 rounded">
        token: {token || "(none)"}{"\n"}
        id: {id || "(none)"}
      </pre>
      */}

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
              autoComplete="new-password"
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
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full border border-gray-300 px-3 py-2 rounded"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition-colors"
          >
            Reset Password
          </button>
        </form>
      )}

      {message && (
        <p className="mt-4 text-green-600">
          {message} Redirecting to login...
        </p>
      )}
    </div>
  );
}
// --- REPLACE END ---


