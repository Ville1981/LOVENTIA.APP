// File: server/.eslintrc.js

/* 
  ESLint config for the SERVER workspace (Node/Express, ESM).
  - Keeps structure clear and avoids unnecessary shortening.
  - Focuses on Node + ESM (no React rules on the server).
  - Import resolver supports .js/.mjs/.cjs and "src" as an import root.
  - Jest test files get their own environment via overrides.
*/

module.exports = {
  root: true,

  env: {
    node: true,
    es2022: true
  },

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },

  settings: {
    "import/resolver": {
      node: {
        extensions: [".js", ".mjs", ".cjs", ".json"]
      }
    }
  },

  // --- REPLACE START: add OpenAPI phase pack to ignores (+ keep existing) ---
  ignorePatterns: [
    "node_modules/**",
    "dist/**",
    "coverage/**",
    "uploads/**",
    "openapi/dist/**",
    "__openapi_phase_pack/**",     // ⬅️ ignore generated pack (prevents “const/import reserved” here)
    "node_modules/axobject-query/**"
  ],
  // --- REPLACE END ---

  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "prettier"
  ],

  plugins: ["import"],

  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-undef": "error",
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", ["parent", "sibling"], "index", "object", "type"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true }
      }
    ],
    "import/no-unresolved": "error",
    "import/extensions": ["off"]
  },

  // --- REPLACE START: ensure server/src is always parsed as modern ESM (fixes “import/const reserved”) ---
  overrides: [
    {
      files: ["src/**/*.js", "src/**/*.mjs"],
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module"
      },
      env: { node: true }
    },
    {
      files: ["**/*.test.js", "**/*.test.mjs", "**/*.spec.js", "**/*.spec.mjs"],
      env: { jest: true },
      rules: {
        "no-undef": "off"
      }
    },
    {
      files: ["scripts/**/*.js", "scripts/**/*.mjs"],
      env: { node: true }
    }
  ]
  // --- REPLACE END ---
};











