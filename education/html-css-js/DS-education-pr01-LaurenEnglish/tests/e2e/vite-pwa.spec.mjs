import { expect, test } from "@playwright/test";

import { createViteServiceWorkerBuild } from "../../scripts/build-service-worker.mjs";

test.use({ serviceWorkers: "allow" });

test("serves the complete Vite PWA contract offline", async ({
  page,
  context,
}) => {
  const build = await createViteServiceWorkerBuild();

  try {
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    const registrationScope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js",
        { scope: "/" },
      );
      await navigator.serviceWorker.ready;

      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            {
              once: true,
            },
          );
        });
      }

      return registration.scope;
    });

    expect(registrationScope).toBe(`${new URL(page.url()).origin}/`);
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);

    const cachedPaths = await page.evaluate(async (cacheName) => {
      const cache = await caches.open(cacheName);
      return (await cache.keys())
        .map(({ url }) => new URL(url).pathname)
        .sort();
    }, build.cacheName);
    expect(cachedPaths).toEqual([...build.precachePaths].sort());

    await context.setOffline(true);

    const publishedResponse = await page.goto("/regulamin.html", {
      waitUntil: "domcontentloaded",
    });
    expect(publishedResponse?.status()).toBe(200);
    await expect(page).toHaveTitle("Regulamin serwisu | Lauren English");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Regulamin serwisu",
    );

    const fallbackResponse = await page.goto("/vite-pwa-offline-probe", {
      waitUntil: "domcontentloaded",
    });
    expect(fallbackResponse?.status()).toBe(200);
    await expect(page).toHaveTitle("Offline | Lauren English");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Jeste\u015b offline",
    );
  } finally {
    await context.setOffline(false);
    await page
      .evaluate(async (cacheName) => {
        const registration = await navigator.serviceWorker.getRegistration("/");
        await registration?.unregister();
        await caches.delete(cacheName);
      }, build.cacheName)
      .catch(() => {});
  }
});
