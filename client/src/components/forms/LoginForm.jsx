import PropTypes from "prop-types";
import React from "react";

// --- REPLACE START: import shared axios instance so this form can work standalone too ---
// NOTE: adjust this path if your project uses e.g. "../services/api" or "./api/axiosInstance"
import api from "../../api/axios.js";
// --- REPLACE END ---

import { useFormValidation } from "../../hooks/useFormValidation";
import { loginSchema } from "../../utils/validationSchemas";

/**
 * LoginForm
 *
 * Primary behavior:
 * - If parent passes onSubmit(values), we just call that and let parent do login
 *   (for example AuthContext.login or authService.login).
 *
 * Fallback behavior:
 * - If onSubmit is NOT provided, this component will POST directly to
 *   /api/users/login (this is the endpoint that worked in your PowerShell test).
 *
 * This way the form cannot accidentally call the old /auth/login endpoint.
 */
export default function LoginForm({ onSubmit }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useFormValidation({
    schema: loginSchema,
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  // --- REPLACE START: prefer parent handler, else do local /api/users/login ---
  const handleValidSubmit = async (values) => {
    // 1) Parent provided handler → use that
    if (typeof onSubmit === "function") {
      return onSubmit(values);
    }

    // 2) Fallback → call backend directly with the working endpoint
    //    Backend responded to: POST http://localhost:5000/api/users/login ✅
    const res = await api.post("/api/users/login", values, {
      withCredentials: true,
    });
    return res.data;
  };
  // --- REPLACE END ---

  return (
    <form onSubmit={handleSubmit(handleValidSubmit)} noValidate>
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={errors.email ? "true" : "false"}
        />
        {errors.email && (
          <span role="alert" className="error">
            {errors.email.message}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          aria-invalid={errors.password ? "true" : "false"}
        />
        {errors.password && (
          <span role="alert" className="error">
            {errors.password.message}
          </span>
        )}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Logging in…" : "Login"}
      </button>
    </form>
  );
}

LoginForm.propTypes = {
  // not strictly required anymore, because we have the fallback above,
  // but keep it to avoid breaking existing callers
  onSubmit: PropTypes.func,
};
