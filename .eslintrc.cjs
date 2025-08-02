// .eslintrc.cjs
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
    jest: true,
    // --- REPLACE START: enable Cypress globals
    'cypress/globals': true,
    // --- REPLACE END
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'prettier',
    'plugin:cypress/recommended',
  ],
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 12,
    sourceType: 'module',
    // --- REPLACE START: use React 17+ automatic JSX runtime
    babelOptions: {
      presets: [
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    },
    // --- REPLACE END
  },
  settings: {
    react: { version: 'detect' },
    'import/resolver': { node: { extensions: ['.js', '.jsx', '.json'] } },
  },
  plugins: [
    'react',
    'import',
    'prettier',
    'cypress',
  ],
  rules: {
    // no need to import React in scope for JSX
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-console': 'warn',
    'import/order': [
      'error',
      {
        groups: [
          ['builtin', 'external'],
          'internal',
          ['parent', 'sibling', 'index']
        ],
        alphabetize: { order: 'asc', caseInsensitive: true },
      }
    ],
    'prettier/prettier': 'error',
  },
};
