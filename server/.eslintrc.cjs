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

  // --- REPLACE START: ignore build + legacy artefacts ---
  ignorePatterns: [
    "node_modules/**",
    "dist/**",
    "coverage/**",
    "uploads/**",
    "openapi/dist/**",
    "__openapi_phase_pack/**",     // ⬅️ OpenAPI-paketti
    "node_modules/axobject-query/**",

    // ⬇️ EI LINTATA näitä tässä vaiheessa
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

  // lisätään myös "n" jotta n/no-missing-require on tunnettu sääntö
  plugins: ["import", "n"],

  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-undef": "error",

    // TYYLIsäännöt vain warningiksi, jotta ne eivät estä linttiä
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

  // --- REPLACE START: overrides pysyy, mutta jätetään selkeästi näkyviin ---
  overrides: [
    // src-koodi: ESM + Node
    {
      files: ["src/**/*.js", "src/**/*.mjs"],
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module"
      },
      env: { node: true }
    },
    // Jest-testit: sallitaan jest-globaalit (beforeAll, describe, it, jne.)
    {
      files: ["**/*.test.js", "**/*.test.mjs", "**/*.spec.js", "**/*.spec.mjs"],
      env: { jest: true },
      rules: {
        "no-undef": "off"
      }
    },
    // Skriptit (scripts/**/*.js, .mjs)
    {
      files: ["scripts/**/*.js", "scripts/**/*.mjs"],
      env: { node: true }
    }
  ]
  // --- REPLACE END ---
};


