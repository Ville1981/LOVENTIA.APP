// File: perf/processors.js

// --- REPLACE START: helpers used by Artillery YAML ---
function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  randomNumber
};
// --- REPLACE END ---
