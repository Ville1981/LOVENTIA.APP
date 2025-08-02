// client/src/hooks/useFormValidation.js

import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

/**
 * useFormValidation
 * A custom hook wrapping React Hook Form with Yup validation.
 *
 * @param {Object} options
 * @param {Object} options.schema - Yup validation schema
 * @param {Object} [options.defaultValues] - Initial form values
 * @param {string} [options.mode] - Validation mode ("onSubmit", "onBlur", "onChange", etc.)
 * @returns {ReturnType<typeof useForm>} - React Hook Form methods and state
 *
 * Usage:
 * const { register, handleSubmit, errors, formState } = useFormValidation({
 *   schema: loginSchema,
 *   defaultValues: { email: "", password: "" },
 *   mode: "onBlur"
 * });
 */
export function useFormValidation({ schema, defaultValues = {}, mode = 'onSubmit' }) {
  const formMethods = useForm({
    resolver: yupResolver(schema),
    defaultValues,
    mode,
  });

  return formMethods;
}
