// File: .eslintrc.cjs
module.exports = {
  root: true,

  // Define environments so browser and modern JS globals are known
  env: {
    browser: true,
    node: true,
    es2022: true,
  },

  parser: "@babel/eslint-parser",
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ["@babel/preset-env", "@babel/preset-react"],
    },
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },

  settings: {
    react: { version: "detect" },
    "import/resolver": {
      node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
    },
  },

  // --- REPLACE START: keep ignore and add react-hooks plugin + config ---
  ignorePatterns: ["node_modules/axobject-query/**"],
  // --- REPLACE END ---

  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    // --- REPLACE START: enable official React Hooks rules ---
    "plugin:react-hooks/recommended",
    // --- REPLACE END ---
    "plugin:import/errors",
    "plugin:import/warnings",
    "prettier",
  ],

  // --- REPLACE START: add react-hooks plugin ---
  plugins: ["react", "import", "react-hooks"],
  // --- REPLACE END ---

  rules: {
    // Turn off prop-types rule (we type-check elsewhere)
    "react/prop-types": "off",
    // Enable the new JSX transform (no need to import React in scope)
    "react/react-in-jsx-scope": "off",

    // --- REPLACE START: React Hooks rules (matches recommended defaults) ---
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    // --- REPLACE END ---

    // Enforce import ordering and auto-fixable
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", ["parent", "sibling"], "index"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
  },

  overrides: [
    {
      files: ["**/*.spec.js", "**/*.test.jsx", "src/setupTests.js"],
      env: { jest: true },
    },
  ],
};
