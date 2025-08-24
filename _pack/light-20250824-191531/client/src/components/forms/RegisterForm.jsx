// File: client/src/components/forms/RegisterForm.jsx

import PropTypes from "prop-types";
import React from "react";

import { useFormValidation } from "../../hooks/useFormValidation";
import { registerSchema } from "../../utils/validationSchemas";

/**
 * RegisterForm
 * @param {function} onSubmit - Called with form data when form is valid
 */
export default function RegisterForm({ onSubmit }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useFormValidation({
    // --- REPLACE START: include username in defaults (schema may ignore; HTML will still validate) ---
    defaultValues: { username: "", name: "", email: "", password: "" },
    // --- REPLACE END ---
    schema: registerSchema,
    mode: "onBlur",
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* --- REPLACE START: username field with strict pattern + autocomplete --- */}
      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          pattern="[A-Za-z0-9._-]{3,30}"
          title="3–30 characters: letters, numbers, dot, underscore, or hyphen."
          {...register("username", { required: true })}
          aria-invalid={errors.username ? "true" : "false"}
        />
        {errors.username && (
          <span role="alert" className="error">
            {errors.username.message || "Username is required."}
          </span>
        )}
      </div>
      {/* --- REPLACE END --- */}

      <div className="form-group">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          {...register("name")}
          aria-invalid={errors.name ? "true" : "false"}
        />
        {errors.name && (
          <span role="alert" className="error">
            {errors.name.message}
          </span>
        )}
      </div>

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
          autoComplete="new-password"
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
        {isSubmitting ? "Registering…" : "Register"}
      </button>
    </form>
  );
}

RegisterForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
};
