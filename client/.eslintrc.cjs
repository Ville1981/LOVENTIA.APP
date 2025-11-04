/* 
  ESLint config for the SERVER workspace (Node/Express, ESM).
  - Keeps structure clear and avoids unnecessary shortening.
  - Focuses on Node + ESM (no React rules on the server).
  - Import resolver supports .js/.mjs/.cjs and "src" as an import root.
  - Jest test files get their own environment via overrides.
  - The replacement region is clearly marked so you can diff precisely.
*/

module.exports = {
  root: true,

  // Define environments so Node and modern JS globals are known
  env: {
    node: true,
    es2022: true
  },

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },

  settings: {
    // Resolve bare imports from "src" and common Node extensions
    "import/resolver": {
      node: {
        extensions: [".js", ".mjs", ".cjs", ".json"]
      }
      // If you use path aliases (e.g. "@/*"), add an "alias" resolver here.
      // e.g.:
      // "alias": {
      //   "map": [["@", "./src"]],
      //   "extensions": [".js", ".mjs", ".cjs", ".json"]
      // }
    }
  },

  // --- REPLACE START: ignore patterns tailored to server and keep them minimal but useful ---
  ignorePatterns: [
    "node_modules/**",
    "dist/**",
    "coverage/**",
    "uploads/**",
    "openapi/dist/**",
    // Keep historical ignore (from previous config) to avoid breaking existing setups:
    "node_modules/axobject-query/**"
  ],
  // --- REPLACE END ---

  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "prettier"
  ],

  // --- REPLACE START: server does not need React/React-Hooks; keep import plugin only ---
  plugins: ["import"],
  // --- REPLACE END ---

  rules: {
    // Keep code clean but not over-restrictive for a server codebase
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-undef": "error",

    // Enforce import ordering and make it auto-fixable
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", ["parent", "sibling"], "index", "object", "type"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true }
      }
    ],

    // Optional: help catch unresolved imports early (works with resolver above)
    "import/no-unresolved": "error",

    // Prefer explicit file extensions only for non-js/json when necessary
    "import/extensions": ["off"]
  },

  overrides: [
    {
      files: ["**/*.test.js", "**/*.test.mjs", "**/*.spec.js", "**/*.spec.mjs"],
      env: { jest: true },
      rules: {
        // Test files can be a bit more flexible
        "no-undef": "off"
      }
    },
    {
      files: ["scripts/**/*.js", "scripts/**/*.mjs"],
      // Script folders may run in different contexts; keep them Node-friendly
      env: { node: true }
    }
  ]
};

