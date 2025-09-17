// File: server/src/middleware/validateRequest.js

// --- REPLACE START: minimal validateBody middleware (ESM) ---
/**
 * validateBody(schema)
 * Lightweight request body validator middleware that calls schema.validate(body)
 * and returns 400 with normalized error messages if validation fails.
 *
 * NOTE: This is dependency-free on purpose. It expects "schema" to expose a
 *       validate(data) method that returns either:
 *       - { value } on success
 *       - { error: { details: [{ message: string }, ...] } } on failure
 *
 * Interop:
 *  - Named export:   import { validateBody } from "./validateRequest.js"
 *  - Default export: import validator from "./validateRequest.js" (validator.validateBody)
 */
export function validateBody(schema) {
  return function (req, res, next) {
    try {
      if (!schema || typeof schema.validate !== "function") {
        // Developer error: schema missing or invalid.
        // Do not block the request; continue so routes can handle it.
        return next();
      }

      const result = schema.validate(req.body);

      if (result && result.error) {
        const details = Array.isArray(result.error.details)
          ? result.error.details.map((d) =>
              d && d.message ? String(d.message) : "Validation error"
            )
          : ["Validation error"];

        return res.status(400).json({
          error: "Validation failed",
          details,
        });
      }

      // Optionally set sanitized/parsed value back to req.body (parity with Joi behavior)
      if (result && result.value !== undefined) {
        req.body = result.value;
      }

      return next();
    } catch (_err) {
      // Fail closed with 400 to avoid leaking internal errors in validation
      return res.status(400).json({ error: "Validation error" });
    }
  };
}

// Provide a default export containing the named API for convenience.
// Consumers can either `import { validateBody } ...` or `import validator ...`
const api = { validateBody };
export default api;
// --- REPLACE END ---
