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

  // --- REPLACE START: ignore axobject-query so ESLint never lints its broken files ---
  ignorePatterns: ["node_modules/axobject-query/**"],
  // --- REPLACE END ---

  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "prettier",
  ],

  plugins: ["react", "import"],

  rules: {
    // Turn off prop-types rule (we type-check elsewhere)
    "react/prop-types": "off",
    // Enable the new JSX transform (no need to import React in scope)
    "react/react-in-jsx-scope": "off",
    // Enforce import ordering and auto-fixable
    "import/order": [
      "error",
      {
        "groups": ["builtin", "external", "internal", ["parent", "sibling"], "index"],
        "newlines-between": "always",
        "alphabetize": { "order": "asc", "caseInsensitive": true }
      }
    ]
  },

  overrides: [
    {
      files: ["**/*.spec.js", "**/*.test.jsx", "src/setupTests.js"],
      env: { jest: true },
    },
  ],
};
