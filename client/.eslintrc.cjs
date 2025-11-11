// File: client/.eslintrc.cjs

/* 
  ESLint config for CLIENT (React/Vite).
  Goal: Fix "Parsing error: Unexpected token <" in .jsx by ensuring JSX parsing,
  and keep rules modest to avoid churn. This config is self-contained and marked
  so you can diff changes precisely.
*/

// --- REPLACE START ---
// eslint-disable-next-line no-undef
module.exports = {
  root: true,

  // Browser + modern JS
  env: {
    browser: true,
    es2022: true
  },

  // Base parser options (JSX feature flag here is harmless; real parser comes via overrides)
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true }
  },

  settings: {
    react: { version: "detect" }
  },

  // Keep base minimal; React specifics come via overrides
  extends: [
    "eslint:recommended",
    "prettier"
  ],

  plugins: [],

  rules: {
    // Helpful but not noisy
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-undef": "error"
  },

  /**
   * CRITICAL: Enable JSX parsing for .jsx/.js using @typescript-eslint/parser
   * (Option A). We DO NOT require a tsconfig for plain JS/JSX files.
   */
  overrides: [
    {
      files: ["**/*.jsx", "**/*.js"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: null // do NOT force tsconfig.json for plain JS/JSX
      },
      env: { browser: true, es2021: true },
      plugins: ["react"],
      extends: ["plugin:react/recommended", "prettier"],
      settings: { react: { version: "detect" } },
      rules: {
        "react/prop-types": "off"
      }
    },

    // If you also have TS/TSX files in client, keep this mild and non-breaking.
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: null
      },
      plugins: ["react", "@typescript-eslint"],
      extends: [
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier"
      ],
      settings: { react: { version: "detect" } },
      rules: {
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
      }
    }
  ],

  // Ignore build artefacts
  ignorePatterns: [
    "node_modules/**",
    "dist/**",
    "coverage/**"
  ]
};
// --- REPLACE END ---
