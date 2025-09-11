// --- REPLACE START ---
// Lightweight wrapper around React Hook Form with optional Yup resolver.
// Keeps API stable and avoids breaking callers that pass no schema.
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";

/**
 * useFormValidation
 * A custom hook wrapping React Hook Form with optional Yup validation.
 *
 * @param {Object} options
 * @param {Object} [options.schema]         - Yup schema; if omitted, no resolver is used
 * @param {Object} [options.defaultValues]  - Initial form values
 * @param {string} [options.mode]           - RHF validation mode ("onSubmit" | "onBlur" | "onChange" | "onTouched" | "all")
 * @param {string} [options.reValidateMode] - RHF re-validation mode ("onChange" | "onBlur" | "onSubmit")
 * @param {any}    [options.context]        - RHF/Yup context object
 * @param {string} [options.criteriaMode]   - RHF criteria mode ("firstError" | "all")
 * @param {boolean}[options.shouldFocusError] - Auto-focus first invalid field on submit
 * @returns {ReturnType<typeof useForm>} React Hook Form methods/state
 *
 * Usage:
 * const methods = useFormValidation({
 *   schema: loginSchema,
 *   defaultValues: { email: "", password: "" },
 *   mode: "onBlur"
 * });
 */
export function useFormValidation({
  schema,
  defaultValues = {},
  mode = "onSubmit",
  reValidateMode = "onSubmit",
  context,
  criteriaMode = "firstError",
  shouldFocusError = true,
} = {}) {
  const options = {
    defaultValues,
    mode,
    reValidateMode,
    criteriaMode,
    shouldFocusError,
  };

  // Only attach the resolver if a schema is provided (prevents runtime errors if Yup is not needed).
  if (schema) {
    options.resolver = yupResolver(schema, { context });
  }

  // Pass context for RHF consumers even without Yup
  if (context !== undefined) {
    options.context = context;
  }

  return useForm(options);
}
// --- REPLACE END ---
