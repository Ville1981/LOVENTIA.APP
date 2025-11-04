// PATH: server/src/swagger-config.js

// --- REPLACE START ---
/**
 * Swagger configuration with safe test-mode behavior (pure ESM).
 *
 * What this does:
 *  - In NODE_ENV === "test": exports no-op middlewares so Jest/Vitest
 *    do NOT try to spin up Swagger UI or parse YAML.
 *  - In normal envs: loads swagger-ui-express + YAML file and exposes
 *    the usual { serve, setup } pair for:
 *        app.use("/api/docs", swagger.serve, swagger.setup);
 *
 * IMPORTANT (this session):
 *  - We now load the spec from:  server/openapi/openapi.yaml
 *    so that the file you just created is the single source of truth.
 */

const IS_TEST = process.env.NODE_ENV === "test";

// We'll populate these below
let serve;
let setup;

if (IS_TEST) {
  // In tests: keep it super-lightweight.
  const noop = (_req, _res, next) => next();
  const setupNoop = () => (_req, res) => res.status(204).end();

  serve = noop;
  setup = setupNoop();
} else {
  // Outside tests we can afford to import the heavy bits.
  const pathMod = await import("path");
  const { fileURLToPath } = await import("url");
  const swaggerUi = (await import("swagger-ui-express")).default;

  // ESM __dirname emulation
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = pathMod.default.dirname(__filename);

  // NOTE: this is the new, explicit path:
  //   server/openapi/openapi.yaml
  // relative to this file (server/src/swagger-config.js) we go one level up
  // into ../openapi/openapi.yaml
  const openapiPath = pathMod.default.join(__dirname, "../openapi/openapi.yaml");

  let swaggerDocument;
  try {
    const YAML = (await import("yamljs")).default;
    swaggerDocument = YAML.load(openapiPath);
  } catch (e) {
    // Fallback to a tiny stub document if YAML or file is unavailable
    // eslint-disable-next-line no-console
    console.warn(
      "⚠️ Swagger YAML load failed, using stub document from swagger-config.js:",
      e && e.message ? e.message : e
    );
    swaggerDocument = {
      openapi: "3.0.0",
      info: {
        title: "Loventia API (stub)",
        version: "0.0.0",
        description:
          "Stubbed because server/openapi/openapi.yaml was not found or could not be parsed.",
      },
      paths: {},
    };
  }

  // Provide the shape Express expects
  serve = swaggerUi.serve;
  setup = swaggerUi.setup(swaggerDocument);
}

// Export for app.js
const swaggerConfig = { serve, setup };
export default swaggerConfig;
// --- REPLACE END ---



