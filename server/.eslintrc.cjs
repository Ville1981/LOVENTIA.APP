// PATH: server/.eslintrc.cjs

/* 
  ESLint config for the SERVER workspace (Node/Express, ESM).
  - Keeps structure clear and avoids unnecessary shortening.
  - Focuses on Node + ESM (no React rules on the server).
  - Import resolver supports .js/.mjs/.cjs and "src" as an import root.
  - Jest test files get their own environment via overrides.
*/

// eslint-disable-next-line no-undef
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

  // --- REPLACE START: ignore build + legacy artifacts ---
  ignorePatterns: [
    "node_modules/**",
    "dist/**",
    "coverage/**",
    "uploads/**",

    // OpenAPI bundle and helper artifacts
    "openapi/**",
    "__openapi_phase_pack/**",

    // Known dependency tree that we never lint here
    "node_modules/axobject-query/**",

    // Do not lint these areas for now (can be enabled later)
    "client-dist/**",
    "scripts/**",
    "tests/**"
  ],
  // --- REPLACE END ---

  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "prettier"
  ],

  // Also include "n" so Node-related rules from eslint-plugin-n are available if enabled elsewhere
  plugins: ["import", "n"],

  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-undef": "error",

    // Style rules as warnings so they do not block linting
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "internal", ["parent", "sibling"], "index", "object", "type"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true }
      }
    ],
    "import/no-unresolved": "warn",
    "import/extensions": ["off"]
  },

  // --- REPLACE START: overrides kept explicit and readable ---
  overrides: [
    // src code: ESM + Node
    {
      files: ["src/**/*.js", "src/**/*.mjs"],
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module"
      },
      env: { node: true }
    },

    // Jest tests: allow jest globals (beforeAll, describe, it, etc.)
    {
      files: ["**/*.test.js", "**/*.test.mjs", "**/*.spec.js", "**/*.spec.mjs"],
      env: { jest: true },
      rules: {
        "no-undef": "off"
      }
    },

    // Scripts (scripts/**/*.js, .mjs) run in Node
    {
      files: ["scripts/**/*.js", "scripts/**/*.mjs"],
      env: { node: true }
    },

    // CommonJS modules (.cjs), for example legacy models/shims
    {
      files: ["**/*.cjs"],
      env: {
        node: true,
        commonjs: true
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "script"
      }
    }
  ]
  // --- REPLACE END ---
};

