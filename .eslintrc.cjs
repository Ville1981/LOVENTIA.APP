/* 
  ESLint config for the ROOT of the monorepo.

  Goals:
  - Provide a sane default for root-level files (scripts, config, tools).
  - Do NOT interfere with client/.eslintrc.cjs or server/.eslintrc.cjs.
    (Files inside client/ and server/ will use their own root configs.)
  - Keep ignores for common artefacts (node_modules, dist, coverage, bundles).
*/

// --- REPLACE START ---
/* Root-level ESLint configuration (CJS) */
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
        extensions: [".js", ".cjs", ".mjs", ".json"]
      }
    }
  },

  ignorePatterns: [
    // Generic
    "node_modules/**",
    "dist/**",
    "coverage/**",
    ".turbo/**",

    // Build artefacts that can appear at root or subfolders
    "client-dist/**",
    "server-dist/**",
    "openapi/dist/**",
    "__openapi_phase_pack/**",

    // Logs and temporary files
    "*.log",
    "tmp/**",
    "temp/**"
  ],

  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "prettier"
  ],

  plugins: ["import", "n"],

  rules: {
    // Keep unused variables as warnings; allow "_" prefix to indicate intentional ignore
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }
    ],

    "no-undef": "error",

    // Import style (warning level only, so it does not block lint runs)
    "import/order": [
      "warn",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          ["parent", "sibling"],
          "index",
          "object",
          "type"
        ],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true
        }
      }
    ],

    "import/no-unresolved": "warn",
    "import/extensions": ["off"]
  },

  overrides: [
    // Root-level JS / CJS / MJS config and scripts
    {
      files: ["*.js", "*.cjs", "*.mjs", "scripts/**/*.{js,cjs,mjs}"],
      env: {
        node: true
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module"
      }
    },

    // Jest tests that might live at the root (if any in future)
    {
      files: ["**/*.test.js", "**/*.test.mjs", "**/*.spec.js", "**/*.spec.mjs"],
      env: {
        jest: true
      },
      rules: {
        // Jest globals like "describe" and "it" are allowed
        "no-undef": "off"
      }
    }
  ]
};
// --- REPLACE END ---
