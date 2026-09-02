import js from "@eslint/js";
import globals from "globals";

const sourceFiles = ["**/*.{js,mjs,cjs}"];
const nodeFiles = ["scripts/**/*.{js,mjs}", "playwright.config.mjs"];

export default [
  {
    ignores: [
      "node_modules/**",
      "assets/build/**",
      "service-worker.js",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
    ],
  },
  {
    files: sourceFiles,
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["js/**/*.js"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: nodeFiles,
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["tests/e2e/**/*.{js,mjs}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ["service-worker.template.js"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    files: ["postcss.config.cjs"],
    languageOptions: {
      globals: globals.node,
      sourceType: "commonjs",
    },
  },
];
