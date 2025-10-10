// File: client/src/features/auth/RegisterView.jsx

// --- REPLACE START: switch from raw fetch to axiosInstance + setAccessToken ---
import React, { useState } from "react";
import axios, { attachAccessToken } from "../../utils/axiosInstance";
// --- REPLACE END ---

// --- REPLACE START: pass referralCode from localStorage when registering ---
/* inside your Register component file */
function getReferralCode() {
  try { return localStorage.getItem("loventia:referral") || undefined; } catch { return undefined; }
}

// ... siellä missä lähetät POST /api/auth/register (tai oma reitti):
// await api.post('/auth/register', { email, password, ... })
const payload = {
  email,
  password,
  /* your other fields */,
  referralCode: getReferralCode(), // <— add this line
};
// --- REPLACE END ---


export default function RegisterView() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrMsg("");
    try {
      // Backend expects /api/auth/register (server routes already provided)
      const res = await axios.post("/api/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      const token = res?.data?.accessToken;
      if (token) {
        attachAccessToken(token); // saves to memory + localStorage and sets default header
      }
      // You might redirect or update user context here:
      // setUser(res.data.user)
      // navigate("/dashboard")
    } catch (err) {
      console.error("Register failed:", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Registration failed";
      setErrMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-md mx-auto p-6 bg-white rounded shadow space-y-4"
    >
      <h1 className="text-xl font-semibold">Create account</h1>

      {errMsg && (
        <div className="text-red-600 text-sm" role="alert">
          {errMsg}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          name="name"
          value={form.name}
          onChange={onChange}
          required
          className="w-full border rounded px-3 py-2"
          placeholder="Your name"
          autoComplete="name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          value={form.email}
          onChange={onChange}
          required
          type="email"
          className="w-full border rounded px-3 py-2"
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          value={form.password}
          onChange={onChange}
          required
          type="password"
          className="w-full border rounded px-3 py-2"
          placeholder="••••••••"
          autoComplete="new-password"
          minLength={6}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
