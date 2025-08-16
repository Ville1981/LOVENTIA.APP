// --- REPLACE START: shim that preserves old import path "./i18n/config" ---
// This file simply imports the actual i18n setup from i18nConfig.js
// so that legacy `import "./i18n/config"` continues to work as a
// side-effect initializer (and also re-exports the instance if needed).

import i18n from "./i18nConfig";
export default i18n;
// --- REPLACE END ---
