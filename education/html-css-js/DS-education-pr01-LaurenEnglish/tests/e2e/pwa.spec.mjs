import { expect, test } from "@playwright/test";

import {
  DIST_ROOT,
  createViteServiceWorkerBuild,
  discoverViteRuntimePaths,
} from "../../scripts/build-service-worker.mjs";
import {
  CONTENT_IMAGE_ASSETS,
  MODERN_IMAGE_FORMATS,
  getImageCandidates,
  getImagePaths,
} from "../../scripts/image-config.mjs";
import {
  BRAND_LOGO_PATH,
  CACHE_PREFIX,
  CRITICAL_ASSET_BUDGET,
  FONT_PATHS,
  HERO_IMAGE_PATH,
  HERO_IMAGE_PATHS,
  MANIFEST_ICON_PATHS,
  MANIFEST_PATH,
  MANIFEST_SCREENSHOT_PATHS,
  OFFLINE_PATH,
  SHORTCUT_ICON_PATHS,
} from "../../scripts/pwa-config.mjs";
import {
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
  getVisibleThemeToggle,
} from "./helpers/runtime.mjs";

test.use({ serviceWorkers: "allow" });

let currentBuild;
let viteRuntimePaths;

test.beforeAll(async () => {
  currentBuild = await createViteServiceWorkerBuild();
  viteRuntimePaths = (await discoverViteRuntimePaths(DIST_ROOT)).filter(
    (path) => /\.(?:css|js)$/.test(path),
  );
});

const OLD_PROJECT_CACHE = `${CACHE_PREFIX}0.9.0-obsolete`;
const UNRELATED_CACHE = "unrelated-application-sentinel";
const UNSUCCESSFUL_POST_STATUSES = Object.freeze([404, 405, 501]);

const registerAndControl = async (page) => {
  const registrationState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register(
      "/service-worker.js",
      { scope: "/" },
    );
    const readyRegistration = await navigator.serviceWorker.ready;
    return {
      activeState: readyRegistration.active?.state ?? null,
      scope: registration.scope,
      scriptUrl: readyRegistration.active?.scriptURL ?? null,
    };
  });

  const origin = new URL(page.url()).origin;
  expect(registrationState).toEqual({
    activeState: expect.stringMatching(/^(?:activating|activated)$/),
    scope: `${origin}/`,
    scriptUrl: `${origin}/service-worker.js`,
  });

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration("/");
        return registration?.active?.state ?? null;
      }),
    )
    .toBe("activated");

  await page.goto("/index.html", { waitUntil: "networkidle" });
  if (
    !(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
  ) {
    await page.reload({ waitUntil: "networkidle" });
  }

  await expect
    .poll(() =>
      page.evaluate(() => ({
        controlled: Boolean(navigator.serviceWorker.controller),
        state: navigator.serviceWorker.controller?.state ?? null,
      })),
    )
    .toEqual({ controlled: true, state: "activated" });
};

const cleanPwaState = async (page, context) => {
  await context.setOffline(false).catch(() => {});
  if (page.isClosed()) return;
  await page
    .evaluate(async () => {
      await Promise.all(
        (await navigator.serviceWorker.getRegistrations()).map((registration) =>
          registration.unregister(),
        ),
      );
      await Promise.all(
        (await caches.keys()).map((cacheName) => caches.delete(cacheName)),
      );
    })
    .catch(() => {});
};

const getCurrentCachePaths = (page) =>
  page.evaluate(async (cacheName) => {
    const cache = await caches.open(cacheName);
    return (await cache.keys())
      .map((request) => new URL(request.url).pathname)
      .sort();
  }, currentBuild.cacheName);

const getImageResults = (page, assets) =>
  page.evaluate(async (imageAssets) => {
    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () =>
          resolve({
            height: image.naturalHeight,
            path: src,
            width: image.naturalWidth,
          }),
        );
        image.addEventListener("error", reject);
        image.src = src;
      });

    return Promise.all(
      imageAssets.map(async ({ src }) => {
        const response = await fetch(src);
        return {
          ...(await loadImage(src)),
          contentType: response.headers.get("Content-Type"),
          status: response.status,
        };
      }),
    );
  }, assets);

test.afterEach(async ({ page, context }) => {
  await cleanPwaState(page, context);
});

test("delivers configured AVIF and WebP content images through picture markup", async ({
  page,
}) => {
  const imageCases = [
    {
      asset: CONTENT_IMAGE_ASSETS.find(({ key }) => key === "homepage-hero"),
      pagePath: "/index.html",
      selector: ".hero__image",
    },
    {
      asset: CONTENT_IMAGE_ASSETS.find(({ key }) => key === "about-portrait"),
      pagePath: "/index.html",
      selector: ".about__portrait img",
    },
    {
      asset: CONTENT_IMAGE_ASSETS.find(({ key }) => key === "contact-hero"),
      pagePath: "/kontakt.html",
      selector: ".hero__image--contact",
    },
  ];

  for (const { asset, pagePath, selector } of imageCases) {
    await page.goto(pagePath, { waitUntil: "networkidle" });
    const image = page.locator(selector);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await image.evaluate((element) => element.decode());
    const result = await image.evaluate((element) => {
      const getSrcsetPaths = (srcset) =>
        srcset
          .split(",")
          .map((candidate) => candidate.trim().split(/\s+/u)[0])
          .filter(Boolean)
          .map((candidate) => new URL(candidate, document.baseURI).pathname);

      return {
        currentSrc: new URL(element.currentSrc, document.baseURI).pathname,
        height: element.naturalHeight,
        sources: Array.from(
          element.closest("picture").querySelectorAll("source"),
        ).map((source) => ({
          srcsetPaths: getSrcsetPaths(source.srcset),
          type: source.type,
        })),
        width: element.naturalWidth,
      };
    });
    const expectedSources = MODERN_IMAGE_FORMATS.map(
      ({ extension, mimeType }) => ({
        srcsetPaths: getImageCandidates(asset, extension).map(({ path }) => path),
        type: mimeType,
      }),
    );

    expect(result.sources).toEqual(expectedSources);
    expect(getImagePaths(asset)).toContain(result.currentSrc);
    const response = await page.request.get(result.currentSrc);
    expect(response.status()).toBe(200);
    const selectedSource = result.sources.find(({ srcsetPaths }) =>
      srcsetPaths.includes(result.currentSrc),
    );
    const selectedExtension = result.currentSrc.endsWith(".avif")
      ? "avif"
      : "webp";
    const selectedCandidate = getImageCandidates(asset, selectedExtension).find(
      ({ path }) => path === result.currentSrc,
    );
    expect(selectedCandidate).toBeDefined();
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.width / result.height).toBeCloseTo(asset.width / asset.height, 2);
    expect(selectedSource).toEqual({
      srcsetPaths: getImageCandidates(asset, selectedExtension).map(
        ({ path }) => path,
      ),
      type: result.currentSrc.endsWith(".avif") ? "image/avif" : "image/webp",
    });
  }
});

test("installs, controls the page, validates install metadata, and preserves unrelated caches", async ({
  page,
}) => {
  const diagnostics = collectRuntimeDiagnostics(page);
  const manifestResponse = await page.goto(MANIFEST_PATH, {
    waitUntil: "domcontentloaded",
  });
  expect(manifestResponse?.status()).toBe(200);
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);

  await page.evaluate(
    async ([oldProjectCache, currentCache, unrelatedCache]) => {
      await Promise.all([
        caches.open(oldProjectCache),
        caches.open(currentCache),
        caches.open(unrelatedCache),
      ]);
    },
    [OLD_PROJECT_CACHE, currentBuild.cacheName, UNRELATED_CACHE],
  );

  await registerAndControl(page);

  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames).toContain(currentBuild.cacheName);
  expect(cacheNames).not.toContain(OLD_PROJECT_CACHE);
  expect(cacheNames).toContain(UNRELATED_CACHE);
  expect(
    cacheNames.filter((cacheName) => cacheName.startsWith(CACHE_PREFIX)),
  ).toEqual([currentBuild.cacheName]);
  expect(await getCurrentCachePaths(page)).toEqual(
    [...currentBuild.precachePaths].sort(),
  );

  const manifestResult = await page.evaluate(async (manifestPath) => {
    const response = await fetch(manifestPath);
    return {
      contentType: response.headers.get("Content-Type"),
      manifest: await response.json(),
      status: response.status,
    };
  }, MANIFEST_PATH);
  expect(manifestResult.status).toBe(200);
  expect(manifestResult.contentType).toContain("application/manifest+json");
  expect(manifestResult.manifest).toMatchObject({
    name: "Lauren English",
    short_name: "Lauren English",
    id: "/",
    start_url: "/index.html",
    scope: "/",
    display: "standalone",
    lang: "pl",
  });
  expect(manifestResult.manifest.shortcuts).toHaveLength(3);
  expect(
    manifestResult.manifest.shortcuts.map(
      ({ name, short_name: shortName, url }) => ({ name, shortName, url }),
    ),
  ).toEqual([
    {
      name: "Pakiety nauki",
      shortName: "Pakiety",
      url: "/pakiety.html",
    },
    {
      name: "Materiały do nauki",
      shortName: "Materiały",
      url: "/materialy.html",
    },
    {
      name: "Dziennik postępów",
      shortName: "Postępy",
      url: "/postepy.html",
    },
  ]);
  expect(manifestResult.manifest.screenshots).toHaveLength(2);

  const shortcutStatuses = await page.evaluate(
    async (shortcuts) =>
      Promise.all(
        shortcuts.map(async ({ url }) => ({
          status: (await fetch(url)).status,
          url,
        })),
      ),
    manifestResult.manifest.shortcuts,
  );
  expect(shortcutStatuses).toEqual([
    { status: 200, url: "/pakiety.html" },
    { status: 200, url: "/materialy.html" },
    { status: 200, url: "/postepy.html" },
  ]);

  const manifestAssets = [
    ...manifestResult.manifest.icons,
    ...manifestResult.manifest.shortcuts.flatMap(({ icons }) => icons),
    ...manifestResult.manifest.screenshots,
  ];
  expect(manifestResult.manifest.icons.map(({ src }) => src)).toEqual([
    ...MANIFEST_ICON_PATHS,
  ]);
  expect(
    manifestResult.manifest.shortcuts.flatMap(({ icons }) =>
      icons.map(({ src }) => src),
    ),
  ).toEqual([...SHORTCUT_ICON_PATHS]);
  expect(manifestResult.manifest.screenshots.map(({ src }) => src)).toEqual([
    ...MANIFEST_SCREENSHOT_PATHS,
  ]);
  const imageResults = await getImageResults(page, manifestAssets);
  for (const asset of manifestAssets) {
    const [width, height] = asset.sizes.split("x").map(Number);
    expect(imageResults.find(({ path }) => path === asset.src)).toMatchObject({
      contentType: expect.stringContaining(asset.type),
      height,
      path: asset.src,
      status: 200,
      width,
    });
  }
  expectCleanDiagnostics(diagnostics);
});

test("keeps online routing real and never stores failed or partial responses", async ({
  page,
}) => {
  const diagnostics = collectRuntimeDiagnostics(page);
  await page.goto(MANIFEST_PATH, { waitUntil: "domcontentloaded" });
  await registerAndControl(page);
  const origin = new URL(page.url()).origin;

  for (const path of currentBuild.primaryDocumentPaths) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), path).toBe(200);
  }

  const unknownPath = "/pwa-online-unknown-route";
  const unknownResponse = await page.goto(unknownPath, {
    waitUntil: "domcontentloaded",
  });
  expect(unknownResponse?.status()).toBe(404);

  const failedAssetPath = "/assets/pwa/shortcuts/not-a-real-icon.png";
  const failedAssetStatus = await page.evaluate(async (path) => {
    const response = await fetch(path);
    return response.status;
  }, failedAssetPath);
  expect(failedAssetStatus).toBe(404);

  const postPath = "/pwa-post-probe";
  const postResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === postPath &&
      response.request().method() === "POST",
  );
  const postResult = await page.evaluate(
    async ({ cacheName, path }) => {
      const cache = await caches.open(cacheName);
      await cache.delete(path);
      const response = await fetch(path, { method: "POST" });
      return {
        cachedAfterPost: Boolean(await cache.match(path)),
        status: response.status,
      };
    },
    { cacheName: currentBuild.cacheName, path: postPath },
  );
  const postResponse = await postResponsePromise;
  expect(UNSUCCESSFUL_POST_STATUSES).toContain(postResult.status);
  expect(postResult.cachedAfterPost).toBe(false);
  expect(postResponse.status()).toBe(postResult.status);
  expect(postResponse.fromServiceWorker()).toBe(false);

  const partialPath = MANIFEST_ICON_PATHS[0];
  const partialResult = await page.evaluate(
    async ({ cacheName, path }) => {
      const cache = await caches.open(cacheName);
      await cache.delete(path);
      const partialResponse = await fetch(`${path}?range-probe=1`, {
        headers: { Range: "bytes=0-15" },
      });
      const cachedAfterPartial = Boolean(await cache.match(path));
      const validResponse = await fetch(`${path}?range-probe=2`);
      const cachedAfterValid = Boolean(await cache.match(path));
      return {
        cachedAfterPartial,
        cachedAfterValid,
        partialStatus: partialResponse.status,
        validStatus: validResponse.status,
      };
    },
    { cacheName: currentBuild.cacheName, path: partialPath },
  );
  expect(partialResult).toEqual({
    cachedAfterPartial: false,
    cachedAfterValid: true,
    partialStatus: 206,
    validStatus: 200,
  });

  const cacheProbe = await page.evaluate(
    async ({ cacheName, failedAssetPath, unknownPath }) => {
      const cache = await caches.open(cacheName);
      const beforeDataFetch = (await cache.keys()).length;
      await fetch("data:text/plain,pwa-unsupported-scheme");
      return {
        dataSchemeChangedCache: (await cache.keys()).length !== beforeDataFetch,
        failedAssetCached: Boolean(await cache.match(failedAssetPath)),
        unknownRouteCached: Boolean(await cache.match(unknownPath)),
      };
    },
    { cacheName: currentBuild.cacheName, failedAssetPath, unknownPath },
  );
  expect(cacheProbe).toEqual({
    dataSchemeChangedCache: false,
    failedAssetCached: false,
    unknownRouteCached: false,
  });
  const expectedHttpErrors = [
    `404 ${origin}${unknownPath}`,
    `404 ${origin}${failedAssetPath}`,
    `${postResult.status} ${origin}${postPath}`,
  ].sort();
  const expectedRequestFailures = [
    `net::ERR_ABORTED ${origin}${failedAssetPath}`,
    `net::ERR_ABORTED ${origin}${postPath}`,
  ]
    .map((message) => message.trim())
    .sort();
  expect(diagnostics.consoleErrors).toHaveLength(expectedHttpErrors.length);
  expect(diagnostics.pageErrors).toEqual([]);
  expect(
    diagnostics.requestFailures.map((message) => message.trim()).sort(),
  ).toEqual(expectedRequestFailures);
  expect([...diagnostics.httpErrors].sort()).toEqual(expectedHttpErrors);
});

test("serves all published documents offline and uses offline.html for unknown navigation", async ({
  page,
  context,
}) => {
  const diagnostics = collectRuntimeDiagnostics(page);
  await page.goto(MANIFEST_PATH, { waitUntil: "domcontentloaded" });
  await registerAndControl(page);
  await context.setOffline(true);

  for (const path of currentBuild.primaryDocumentPaths) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("main")).toBeVisible();
    if (path !== OFFLINE_PATH) {
      await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
        "Jesteś offline",
      );
    }
  }

  const fallbackResponse = await page.goto("/pwa-offline-unknown-route", {
    waitUntil: "domcontentloaded",
  });
  expect(fallbackResponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Jesteś offline",
  );
  expect(await page.locator('link[rel="canonical"]').count()).toBe(0);
  expect(await page.title()).toBe("Offline | Lauren English");

  await context.setOffline(false);
  expectCleanDiagnostics(diagnostics);
});

test("uses the Vite runtime graph without duplicates or source bundles", async ({
  page,
}) => {
  const diagnostics = collectRuntimeDiagnostics(page);
  await page.goto(MANIFEST_PATH, { waitUntil: "domcontentloaded" });
  await registerAndControl(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const origin = new URL(page.url()).origin;

  const getCriticalResources = () =>
    page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => new URL(entry.name).pathname),
    );
  const resourcePaths = await getCriticalResources();
  const countPath = (path) =>
    resourcePaths.filter((resourcePath) => resourcePath === path).length;

  for (const path of viteRuntimePaths) {
    expect(countPath(path), path).toBe(1);
  }
  expect(
    resourcePaths.filter(
      (path) => path.startsWith("/build/") && /\.(?:css|js)$/.test(path),
    ),
  ).toHaveLength(viteRuntimePaths.length);
  expect(resourcePaths.filter((path) => path.startsWith("/css/"))).toHaveLength(
    0,
  );
  expect(resourcePaths.filter((path) => path.startsWith("/js/"))).toHaveLength(
    0,
  );
  expect(countPath("/css/style.css")).toBe(0);
  expect(countPath("/js/main.js")).toBe(0);
  expect(countPath("/assets/build/style.min.css")).toBe(0);
  expect(countPath("/assets/build/main.min.js")).toBe(0);
  const homepageHeroAsset = CONTENT_IMAGE_ASSETS.find(
    ({ key }) => key === "homepage-hero",
  );
  const hero = page.locator(".hero__image");
  const selectedHeroPath = await hero.evaluate(
    (image) => new URL(image.currentSrc).pathname,
  );
  const fallbackHeroCandidate = getImageCandidates(homepageHeroAsset, "jpg").at(-1);
  const selectedHeroCandidate = MODERN_IMAGE_FORMATS.flatMap(({ extension }) =>
    getImageCandidates(homepageHeroAsset, extension),
  ).find(({ path }) => path === selectedHeroPath);
  expect(fallbackHeroCandidate).toBeDefined();
  expect(selectedHeroCandidate).toBeDefined();
  expect(HERO_IMAGE_PATHS).toContain(selectedHeroPath);
  expect(countPath(selectedHeroPath)).toBe(
    CRITICAL_ASSET_BUDGET.heroImageRequests,
  );
  for (const path of HERO_IMAGE_PATHS.filter(
    (path) => path !== selectedHeroPath,
  )) {
    expect(countPath(path)).toBe(0);
  }
  expect(countPath(BRAND_LOGO_PATH)).toBe(
    CRITICAL_ASSET_BUDGET.brandLogoRequests,
  );
  const requestedFonts = resourcePaths
    .filter((path) => path.startsWith("/assets/fonts/"))
    .sort();
  expect(requestedFonts).toEqual([...FONT_PATHS].sort());
  expect(requestedFonts).toHaveLength(
    CRITICAL_ASSET_BUDGET.initialFontRequests,
  );
  const runtimeOrigins = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name))
      .filter(
        ({ pathname }) =>
          pathname.startsWith("/build/") && /\.(?:css|js)$/.test(pathname),
      )
      .map(({ origin }) => origin),
  );
  expect(
    runtimeOrigins.every((runtimeOrigin) => runtimeOrigin === origin),
  ).toBe(true);

  await expect(hero).toHaveAttribute("loading", "eager");
  await expect(hero).toHaveAttribute("fetchpriority", "high");
  await expect(hero).toHaveAttribute("width", String(fallbackHeroCandidate.width));
  await expect(hero).toHaveAttribute("height", String(fallbackHeroCandidate.height));
  expect(
    await hero.evaluate((image) => ({
      complete: image.complete,
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
    })),
  ).toMatchObject({ complete: true });

  const themeToggle = await getVisibleThemeToggle(page);
  await themeToggle.click();
  await page.evaluate(() => document.fonts.ready.then(() => true));
  expect(
    (await getCriticalResources())
      .filter((path) => path.startsWith("/assets/fonts/"))
      .sort(),
  ).toEqual([...FONT_PATHS].sort());

  const cachePathsBeforeQueries = await getCurrentCachePaths(page);
  await page.evaluate(async (path) => {
    await Promise.all(
      Array.from({ length: 8 }, (_, index) => fetch(`${path}?v=${index}`)),
    );
  }, HERO_IMAGE_PATH);
  expect(await getCurrentCachePaths(page)).toEqual(cachePathsBeforeQueries);
  expectCleanDiagnostics(diagnostics);
});
