const { defineConfig, devices } = require("@playwright/test");

// The smoke suite exercises the deployable artifact: it runs against the Vite
// production preview (`dist/`), which is also the only mode where the service
// worker is registered.
module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:8182",
    serviceWorkers: "block",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://127.0.0.1:8182",
    // A reported run has to describe the current sources, so reuse is off by
    // default: the build always runs, and a preview server left listening on the
    // port fails the run instead of serving its older `dist/`. Local iteration
    // against a preview that is already up opts in with FLEETOPS_REUSE_PREVIEW=1,
    // which then skips the build and is not a verification run.
    reuseExistingServer: process.env.FLEETOPS_REUSE_PREVIEW === "1",
    timeout: 120000,
  },
});
