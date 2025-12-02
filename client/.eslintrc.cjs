/* 
  ESLint config for CLIENT (React/Vite).
  Goals:
  - JSX files are parsed correctly (no "Unexpected token <").
  - React 18 / Vite: no need for `import React from 'react'` in every file.
  - React Hooks and import rules are known so disable-comments do not break lint.
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

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true }
  },

  settings: {
    react: { version: "detect" }
  },

  extends: [
    "eslint:recommended",
    "prettier"
  ],

  plugins: [],

  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-undef": "error"
  },

  overrides: [
    // JS / JSX
    {
      files: ["**/*.jsx", "**/*.js"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: null
      },
      env: { browser: true, es2021: true },
      plugins: ["react", "react-hooks", "import"],
      extends: [
        "plugin:react/recommended",
        "plugin:import/recommended",
        "prettier"
      ],
      settings: { react: { version: "detect" } },
      rules: {
        "react/prop-types": "off",
        // React 18 + Vite: React does not need to be in scope for JSX
        "react/react-in-jsx-scope": "off",
        // React Hooks rules (manual instead of plugin:react-hooks/recommended to avoid circular config)
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn"
      }
    },

    // TS / TSX
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: null
      },
      plugins: ["react", "react-hooks", "import", "@typescript-eslint"],
      extends: [
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "prettier"
      ],
      settings: { react: { version: "detect" } },
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
        ],
        // React Hooks rules for TS/TSX as well
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn"
      }
    },

    // Node-style scripts in client (for example, monitoring utilities)
    {
      files: ["src/monitoring/**/*.js"],
      env: { node: true }
    }
  ],

  // Ignore build artifacts
  ignorePatterns: [
    "node_modules/**",
    "dist/**",
    "coverage/**"
  ]
};
// --- REPLACE END ---


