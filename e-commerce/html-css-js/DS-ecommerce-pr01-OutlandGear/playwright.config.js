const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    viewport: {
      width: 1440,
      height: 960,
    },
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: "npm run build && node scripts/preview-dist.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  },
});
