// File: server/src/swagger-config.js

// --- REPLACE START ---
/**
 * Swagger configuration with safe test-mode behavior (pure ESM).
 * - In NODE_ENV='test' we export lightweight no-op middlewares to avoid
 *   loading yamljs / swagger-ui-express (some Jest environments are fragile).
 * - In other environments we lazily load dependencies via dynamic import().
 * - Export shape stays compatible with:
 *     app.use('/api-docs', swagger.serve, swagger.setup)
 *
 * Keep changes minimal; all comments in English.
 */

const IS_TEST = process.env.NODE_ENV === "test";

// We will fill these and export a single default object at the bottom.
let serve;
let setup;

if (IS_TEST) {
  // In tests, avoid pulling in yamljs or swagger-ui-express entirely.
  const noop = (_req, _res, next) => next();
  const setupNoop = () => (_req, res) => res.status(204).end();

  serve = noop;
  setup = setupNoop();
} else {
  // Use top-level await + dynamic imports so we only load these outside tests.
  const pathMod = await import("path");
  const { fileURLToPath } = await import("url");
  const swaggerUi = (await import("swagger-ui-express")).default;

  // Emulate __dirname in ESM
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = pathMod.default.dirname(__filename);

  let swaggerDocument;
  try {
    const YAML = (await import("yamljs")).default;
    swaggerDocument = YAML.load(pathMod.default.join(__dirname, "../openapi.yaml"));
  } catch (e) {
    // Fallback to a tiny stub document if YAML or file is unavailable
    // eslint-disable-next-line no-console
    console.warn(
      "⚠️ Swagger YAML load failed, using stub document:",
      e && e.message ? e.message : e
    );
    swaggerDocument = {
      openapi: "3.0.0",
      info: { title: "Loventia API (stub)", version: "0.0.0" },
      paths: {},
    };
  }

  // Provide the same shape that Express mounting expects
  serve = swaggerUi.serve;
  setup = swaggerUi.setup(swaggerDocument);
}

// A single top-level default export to satisfy ESM rules.
const swaggerConfig = { serve, setup };
export default swaggerConfig;
// --- REPLACE END ---
