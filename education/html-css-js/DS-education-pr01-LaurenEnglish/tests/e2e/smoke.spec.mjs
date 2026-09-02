import { expect, test } from "@playwright/test";

import {
  DIST_ROOT,
  discoverViteRuntimePaths,
} from "../../scripts/build-service-worker.mjs";
import { FONT_PATHS } from "../../scripts/pwa-config.mjs";
import { SITE } from "../../scripts/site-config.mjs";
import {
  PRIMARY_PAGES,
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
} from "./helpers/runtime.mjs";

test.describe("generated production pages", () => {
  let runtimePaths;

  test.beforeAll(async () => {
    runtimePaths = (await discoverViteRuntimePaths(DIST_ROOT)).filter((path) =>
      /\.(?:css|js)$/.test(path),
    );
  });

  test("homepage and shared shell expose the approved Lauren English identity", async ({
    page,
  }) => {
    const diagnostics = collectRuntimeDiagnostics(page);
    await page.goto("/index.html", { waitUntil: "networkidle" });

    await expect(page.locator(".header__logo-text")).toHaveText(SITE.name);
    await expect(page.locator(".footer__brand-text")).toHaveText(SITE.name);
    await expect(page.locator(".eyebrow")).toHaveText(
      "INDYWIDUALNE LEKCJE ANGIELSKIEGO",
    );
    await expect(page.locator(".hero__title")).toHaveText(
      "Lauren – English. Jasny plan nauki języka angielskiego.",
    );
    await expect(page.locator("body")).not.toContainText(/Clean English/u);
    expectCleanDiagnostics(diagnostics);
  });

  for (const publicPage of PRIMARY_PAGES) {
    test(`${publicPage.name} loads generated assets without runtime errors`, async ({
      baseURL,
      page,
    }) => {
      const diagnostics = collectRuntimeDiagnostics(page);
      const expectedOrigin = new URL(baseURL).origin;
      const assetStatuses = new Map();
      const assetContentTypes = new Map();

      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.origin === expectedOrigin) {
          assetStatuses.set(url.pathname, response.status());
          assetContentTypes.set(
            url.pathname,
            response.headers()["content-type"] ?? "",
          );
        }
      });

      const response = await page.goto(publicPage.path, {
        waitUntil: "networkidle",
      });
      expect(response?.ok()).toBe(true);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.locator(`img[src="${SITE.brandLogo.path}"]`),
      ).toHaveCount(2);
      await expect(page.locator(".header__logo-mark")).toHaveCount(0);

      await page.evaluate(() => document.fonts.ready.then(() => true));
      const fontResources = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((entry) => new URL(entry.name))
          .filter(({ pathname }) => /\.(?:woff2?|ttf|otf)$/i.test(pathname))
          .map(({ origin, pathname }) => ({ origin, pathname })),
      );

      for (const path of runtimePaths) {
        expect(assetStatuses.get(path), path).toBe(200);
        expect(assetContentTypes.get(path), path).toMatch(
          path.endsWith(".css") ? /text\/css/ : /javascript/,
        );
      }
      expect(assetStatuses.has(SITE.runtime.stylesheet)).toBe(false);
      expect(assetStatuses.has(SITE.runtime.javascript)).toBe(false);
      expect(assetStatuses.has("/assets/build/style.min.css")).toBe(false);
      expect(assetStatuses.has("/assets/build/main.min.js")).toBe(false);
      expect(assetStatuses.get(SITE.brandLogo.path)).toBe(200);
      expect(assetContentTypes.get(SITE.brandLogo.path)).toContain(
        "image/svg+xml",
      );
      expect(fontResources.map(({ pathname }) => pathname).sort()).toEqual(
        [...FONT_PATHS].sort(),
      );
      expect(new Set(fontResources.map(({ pathname }) => pathname)).size).toBe(
        FONT_PATHS.length,
      );
      for (const { origin, pathname } of fontResources) {
        expect(origin).toBe(expectedOrigin);
        expect(assetStatuses.get(pathname)).toBe(200);
        expect(assetContentTypes.get(pathname)).toContain("font/woff2");
      }
      const runtimeResources = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((entry) => new URL(entry.name))
          .filter(
            ({ pathname }) =>
              pathname.startsWith("/build/") && /\.(?:css|js)$/.test(pathname),
          )
          .map(({ origin, pathname }) => ({ origin, pathname })),
      );
      expect(runtimeResources.map(({ pathname }) => pathname).sort()).toEqual(
        [...runtimePaths].sort(),
      );
      expect(
        runtimeResources.every(({ origin }) => origin === expectedOrigin),
      ).toBe(true);
      expectCleanDiagnostics(diagnostics);
    });
  }
});
