// --- REPLACE START: compatibility bridge for tests that import ../app ---
// Some legacy tests do `require('../app')`. Our real app entry lives in src/app.js.
// This tiny bridge keeps old tests working without touching test files.
module.exports = require("./src/app");
// --- REPLACE END ---
