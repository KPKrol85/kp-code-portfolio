module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true,
    worker: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  globals: {
    self: "readonly",
    caches: "readonly",
    clients: "readonly",
    fetch: "readonly",
    Request: "readonly",
    Response: "readonly",
    Headers: "readonly",
    IntersectionObserver: "readonly",
    Image: "readonly"
  },
  ignorePatterns: ["js/script.min.js"],
  rules: {
    "no-undef": "error",
    "no-unused-vars": "off"
  },
  overrides: [
    {
      files: ["js/**/*.js"],
      rules: {
        "no-console": "error"
      }
    },
    {
      files: ["scripts/**/*.mjs"],
      rules: {
        "no-console": "off"
      }
    }
  ]
};
