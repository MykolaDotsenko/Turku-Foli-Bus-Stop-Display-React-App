import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["src/**/*.{js,jsx}", "e2e/**/*.js", "scripts/**/*.mjs", "playwright.config.mjs"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        AbortController: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        URLSearchParams: "readonly",
        Intl: "readonly",
        process: "readonly",
        console: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-unreachable": "error",
      "no-constant-condition": "error",
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
