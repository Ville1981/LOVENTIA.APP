import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

// --- REPLACE START: use plural 'contexts' folder ---
import { useAuth } from "../contexts/AuthContext";
// --- REPLACE END ---

// NOTE: Removed direct axios call to avoid double POST /auth/login.
// The AuthContext.login handles the API call, token attach and /auth/me fetch.
// (Keeping import of api would be unnecessary and could cause lint errors.)

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      // --- REPLACE START: call context login only (prevents duplicate network calls) ---
      await login(email, password);
      // --- REPLACE END ---
      setMessage("Login successful!");
      navigate("/profile");
    } catch (err) {
      setMessage(
        err?.response?.data?.error ||
          "Login failed. Please check your credentials."
      );
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
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          Log In
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
            message.toLowerCase().includes("successful")
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
