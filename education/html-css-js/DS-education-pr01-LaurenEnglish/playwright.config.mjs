import { defineConfig } from "@playwright/test";

import { createVitePreviewServer } from "./playwright.server.mjs";
import { PROJECT_DISCLOSURE } from "./scripts/site-config.mjs";

const BASE_URL = "http://127.0.0.1:4173";

// Suites other than the disclosure spec start with the disclosure acknowledged.
const DEFAULT_STORAGE_STATE = {
  cookies: [],
  origins: [
    {
      origin: BASE_URL,
      localStorage: [
        {
          name: PROJECT_DISCLOSURE.storageKey,
          value: PROJECT_DISCLOSURE.version,
        },
      ],
    },
  ],
};

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    storageState: DEFAULT_STORAGE_STATE,
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  webServer: createVitePreviewServer(BASE_URL),
  projects: [
    {
      name: "chromium-desktop",
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
