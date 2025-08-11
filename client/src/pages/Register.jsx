// File: client/src/pages/Register.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// --- REPLACE START: fix context import path (plural 'contexts') ---
import { useAuth } from "../contexts/AuthContext";
// --- REPLACE END ---

// --- REPLACE START: prefer service layer only for register (avoid double login calls) ---
import authService from "../services/authService";
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
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false); // do not overwrite if user edits
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // --- REPLACE START: add loading + message state in English ---
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  // --- REPLACE END ---

  const navigate = useNavigate();

  // --- REPLACE START: get login from context; we will NOT call authService.login to avoid duplication ---
  const { login } = useAuth();
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

      // --- REPLACE START: register via service, then login via context (single source of truth) ---
      await authService.register({ username, email, password });
      await login(email, password); // context takes care of token + /auth/me
      // --- REPLACE END ---

      setMessage("Account created and login successful!");
      navigate("/profile");
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
      } else {
        setMessage(serverMsg || "Registration failed.");
      }
      // --- REPLACE END ---
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto mt-10 space-y-4 bg-white p-6 rounded shadow"
      noValidate
    >
      <h2 className="text-xl font-bold">Create Account</h2>

      {/* --- REPLACE START: username field with touch tracking and English placeholder --- */}
      <input
        type="text"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          setUsernameTouched(true);
        }}
        onFocus={() => setUsernameTouched(true)}
        placeholder="Username"
        className="w-full border p-2 rounded"
        required
        aria-label="Username"
        autoComplete="username"
        pattern="[A-Za-z0-9._-]{3,30}"
        title="3–30 characters: letters, numbers, dot, underscore, or hyphen."
      />
      {/* --- REPLACE END --- */}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full border p-2 rounded"
        required
        aria-label="Email"
        autoComplete="email"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full border p-2 rounded"
        required
        aria-label="Password"
        autoComplete="new-password"
      />

      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm password"
        className="w-full border p-2 rounded"
        required
        aria-label="Confirm password"
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
        {loading ? "Creating..." : "Create account"}
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
