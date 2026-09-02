import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import { createServer } from "vite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;
const OUTPUT_DIRECTORY = resolve(ROOT, "assets/pwa/screenshots");

const SCREENSHOTS = Object.freeze([
  {
    path: resolve(OUTPUT_DIRECTORY, "home-desktop-1280x720.png"),
    viewport: { width: 1280, height: 720 },
  },
  {
    path: resolve(OUTPUT_DIRECTORY, "home-mobile-720x1280.png"),
    viewport: { width: 720, height: 1280 },
  },
]);

const run = async () => {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  // The manifest screenshots capture the canonical project root, not dist/,
  // so this uses the same Vite development server as npm run dev.
  const server = await createServer({
    root: ROOT,
    logLevel: "warn",
    server: { host: HOST, port: PORT, strictPort: true },
  });
  await server.listen();

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    for (const screenshot of SCREENSHOTS) {
      const context = await browser.newContext({
        colorScheme: "light",
        deviceScaleFactor: 1,
        serviceWorkers: "block",
        viewport: screenshot.viewport,
      });
      const page = await context.newPage();
      const response = await page.goto(`${BASE_URL}/index.html`, {
        waitUntil: "networkidle",
      });
      if (!response?.ok()) {
        throw new Error(
          `Homepage returned ${response?.status() ?? "no response"}`,
        );
      }
      await page.evaluate(() => document.fonts.ready.then(() => true));
      await page.locator("main").waitFor({ state: "visible" });
      await page.screenshot({
        animations: "disabled",
        path: screenshot.path,
        type: "png",
      });
      await context.close();
    }
  } finally {
    await browser?.close();
    await server.close();
  }

  console.log(
    `Captured ${SCREENSHOTS.length} production PWA screenshots in ${OUTPUT_DIRECTORY}.`,
  );
};

run().catch((error) => {
  console.error(`PWA screenshot capture failed: ${error.message}`);
  process.exitCode = 1;
});
