// PATH: src/config/corsOptions.js
// --- REPLACE START: shim to centralize CORS via corsConfig.js (avoid duplication) ---
import cors from "cors";
import corsConfig, { corsOptions } from "./corsConfig.js";

export { corsOptions };
export default corsConfig;
// --- REPLACE END ---
