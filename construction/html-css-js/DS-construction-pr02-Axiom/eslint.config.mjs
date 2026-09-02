import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/", "sw.js", "**/*.min.js", "reports/", ".lighthouseci/"]),

  js.configs.recommended,

  {
    rules: {
      // Guarded storage/DOM access intentionally swallows the error; the empty
      // catch and its unused binding are the pattern, not a defect.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", { caughtErrors: "none" }],
    },
  },

  {
    // Browser ES Modules loaded via <script type="module"> (js/main.js entry).
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Optional analytics tags, called only behind a typeof guard.
        gtag: "readonly",
        fbq: "readonly",
      },
    },
  },

  {
    // Classic blocking script loaded via <script src="js/theme-init.js"></script>.
    files: ["js/theme-init.js"],
    languageOptions: {
      sourceType: "script",
    },
  },

  {
    // Service worker source template consumed by tools/sw/build-sw.mjs.
    files: ["sw.template.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.serviceworker,
        // Build-time placeholder replaced with the precache asset list.
        __PRECACHE_ASSETS__: "readonly",
      },
    },
  },

  {
    // Node build/QA tooling and the Vitest runner configuration (ES Modules,
    // no CommonJS globals).
    files: ["tools/**/*.mjs", "vitest.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.nodeBuiltin,
    },
  },

  {
    // Focused Vitest suites. The Vitest APIs are imported explicitly, so only
    // the jsdom globals the fixtures actually touch are declared here.
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        document: "readonly",
        localStorage: "readonly",
        Event: "readonly",
        KeyboardEvent: "readonly",
        HTMLElement: "readonly",
      },
    },
  },
]);
