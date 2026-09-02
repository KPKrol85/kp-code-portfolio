const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test, expect } = require("@playwright/test");

const repositoryFile = (relativePath) => readFileSync(resolve(__dirname, "..", relativePath), "utf8");

function generatedRuntimeAssetUrls() {
  const generated = repositoryFile("dist/sw.js");
  const runtimeAssetUrls = JSON.parse(generated.match(/^const RUNTIME_ASSET_URLS = (\[.*\]);$/m)?.[1] || "null");

  expect(Array.isArray(runtimeAssetUrls)).toBe(true);
  return runtimeAssetUrls;
}

async function generatedLazyRuntimeAssetUrls(page) {
  const eagerAssetUrls = new Set(
    await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('script[type="module"][src], link[rel="modulepreload"][href], link[rel="stylesheet"][href]'),
        (element) => new URL(element.src || element.href, window.location.href).pathname
      )
    )
  );
  const lazyAssetUrls = generatedRuntimeAssetUrls().filter((url) => !eagerAssetUrls.has(url));

  expect(lazyAssetUrls.some((url) => url.endsWith(".js"))).toBe(true);
  return lazyAssetUrls;
}

async function openFresh(page, target = "/") {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(target.startsWith("#") ? `/${target}` : target);
}

async function waitForServiceWorkerControl(page) {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not available in this browser context.");
    }

    await navigator.serviceWorker.ready;
  });

  // `ready` describes the active registration, while this helper's callers need
  // the current client to be controlled. Activation calls `clients.claim()`, so
  // wait for that state directly instead of introducing a second page load.
  await expect.poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function readPrecachedRuntimeAssetsFromWorker(context) {
  const workers = context.serviceWorkers();
  expect(workers).toHaveLength(1);

  return workers[0].evaluate(async () => {
    const assets = [];

    for (const key of await caches.keys()) {
      const cache = await caches.open(key);

      for (const request of await cache.keys()) {
        const pathname = new URL(request.url).pathname;
        if (!pathname.endsWith(".css") && !pathname.endsWith(".js")) continue;

        const response = await cache.match(request);
        assets.push({
          pathname,
          status: response?.status || null,
          bytes: response ? (await response.arrayBuffer()).byteLength : 0,
        });
      }
    }

    return assets;
  });
}

async function loginAsDemo(page) {
  await openFresh(page, "#/login");
  await expect(page.getByRole("heading", { name: "Zaloguj się", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Kontynuuj jako demo" }).click();
  await expect(page).toHaveURL(/#\/app$/);
  await expect(page.getByRole("heading", { name: "Przegląd", level: 1 })).toBeVisible();
}

async function getRouteScrollState(page) {
  return page.evaluate(() => {
    const getScrollTop = (selector) => {
      const element = document.querySelector(selector);
      return element ? Math.round(element.scrollTop || 0) : 0;
    };

    const routeContainer = document.querySelector(".app-main") || document.querySelector("main") || document.getElementById("app");
    const routeTop = routeContainer ? Math.round(routeContainer.getBoundingClientRect().top) : 0;
    const root = document.scrollingElement || document.documentElement;
    const values = {
      windowY: Math.round(window.scrollY || window.pageYOffset || 0),
      scrollingElementTop: Math.round(root?.scrollTop || 0),
      htmlTop: Math.round(document.documentElement.scrollTop || 0),
      bodyTop: Math.round(document.body.scrollTop || 0),
      appTop: getScrollTop("#app"),
      mainTop: getScrollTop("main"),
      appMainTop: getScrollTop(".app-main"),
      routeTop,
    };

    return {
      ...values,
      maxScrollTop: Math.max(
        values.windowY,
        values.scrollingElementTop,
        values.htmlTop,
        values.bodyTop,
        values.appTop,
        values.mainTop,
        values.appMainTop
      ),
    };
  });
}

async function scrollPageDown(page) {
  await page.evaluate(() => {
    const scrollToBottom = (element) => {
      if (!element) return;

      if (element === document.scrollingElement || element === document.documentElement || element === document.body) {
        window.scrollTo(0, element.scrollHeight);
        element.scrollTop = element.scrollHeight;
        return;
      }

      if (typeof element.scrollTo === "function") {
        element.scrollTo({ top: element.scrollHeight, left: 0, behavior: "auto" });
      } else if ("scrollTop" in element) {
        element.scrollTop = element.scrollHeight;
      }
    };

    [
      document.scrollingElement,
      document.documentElement,
      document.body,
      document.getElementById("app"),
      document.querySelector("main"),
      document.querySelector(".app-main"),
    ].forEach(scrollToBottom);
  });
  await expect.poll(async () => (await getRouteScrollState(page)).maxScrollTop).toBeGreaterThan(0);
}

async function expectPageTop(page) {
  await expect.poll(async () => (await getRouteScrollState(page)).maxScrollTop).toBe(0);

  const state = await getRouteScrollState(page);
  expect(state.routeTop).toBeGreaterThanOrEqual(0);
  expect(state.routeTop).toBeLessThanOrEqual(120);
}

// Media queries evaluate against the layout viewport, which excludes the
// classic scrollbar Chromium reserves, so a requested viewport width is not the
// width the shell breakpoints see. Compensate and return the layout width so a
// boundary test can assert it is measuring the width it claims to.
async function setShellLayoutWidth(page, width, height = 800) {
  await page.setViewportSize({ width, height });
  const gap = await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth);
  if (gap > 0) {
    await page.setViewportSize({ width: width + gap, height });
  }
  return page.evaluate(() => document.documentElement.clientWidth);
}

async function expectCrudErrorsLinked(page, scenario) {
  await page.locator(`.sidebar nav a[data-route="${scenario.route}"]`).click();
  await expect(page.getByRole("heading", { name: scenario.heading, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: scenario.addButton }).click();
  const dialog = page.getByRole("dialog", { name: scenario.dialog });
  await expect(dialog).toBeVisible();

  for (const name of scenario.fields) {
    const field = dialog.locator(`[name="${name}"]`);
    const error = dialog.locator(`[data-error-for="${name}"]`);
    const fieldId = `${scenario.prefix}-${name}`;
    const errorId = `${fieldId}-error`;

    await expect(field).toHaveAttribute("id", fieldId);
    await expect(error).toHaveAttribute("id", errorId);
    await expect(field).toHaveAttribute("aria-describedby", new RegExp(`(^|\\s)${errorId}(\\s|$)`));
  }

  await dialog.getByRole("button", { name: scenario.submitButton }).click();

  for (const name of scenario.invalidFields) {
    await expect(dialog.locator(`[name="${name}"]`)).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.locator(`[data-error-for="${name}"]`)).not.toHaveText("");
  }

  await dialog.getByRole("button", { name: "Anuluj" }).click();
}

const CONTACT_SUBMIT_LABEL = "Wyślij wiadomość";
const CONTACT_MESSAGE = "Opis potrzeb operacyjnych floty na potrzeby testu formularza.";

async function fillContactForm(page) {
  const form = page.locator("#contactForm");

  await form.getByLabel("Imię i nazwisko").fill("Jan Kowalski");
  await form.getByLabel("E-mail służbowy").fill("jan.kowalski@firma.pl");
  await form.getByLabel("Wielkość floty").selectOption("16-60");
  await form.getByLabel("Wiadomość").fill(CONTACT_MESSAGE);
  await form.locator("#contactPrivacyAck").check();

  return form;
}

// The contact form posts to the hosting provider's form ingestion, so both
// contact tests intercept that request. Nothing leaves the browser and no real
// submission is ever created.
async function interceptContactSubmission(page, respond) {
  const submissions = [];

  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }

      submissions.push({
        method: request.method(),
        contentType: request.headers()["content-type"] || "",
        body: request.postData() || "",
      });

      await respond(route);
    }
  );

  return submissions;
}

test("landing loads and demo login reaches the app shell", async ({ page }) => {
  await openFresh(page);
  await expect(page.locator("#app")).not.toBeEmpty();
  await expect(page.locator(".landing-home")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /FleetOps/, level: 1 })).toBeVisible();

  await loginAsDemo(page);
  await expect(page.locator(".sidebar")).toContainText("demo@fleetops.app");
});

test("public pages load the application graph only when an application hash is entered", async ({ page }) => {
  const requestCounts = new Map();
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    requestCounts.set(pathname, (requestCounts.get(pathname) || 0) + 1);
  });

  await openFresh(page);
  await expect(page.locator(".landing-home")).toBeVisible();

  const lazyAssetUrls = await generatedLazyRuntimeAssetUrls(page);
  const faqHeader = page.locator("#faq .accordion-header").first();
  await expect(faqHeader).toHaveAttribute("aria-expanded", "false");
  await faqHeader.click();
  await expect(faqHeader).toHaveAttribute("aria-expanded", "true");

  for (const url of lazyAssetUrls) {
    expect(requestCounts.get(url) || 0).toBe(0);
  }

  await page.evaluate(() => {
    window.location.hash = "#/app/orders";
  });
  await expect(page.getByRole("heading", { name: "Zaloguj się", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("auth:returnTo"))).toBe("#/app/orders");

  for (const url of lazyAssetUrls) {
    expect(requestCounts.get(url) || 0).toBeGreaterThan(0);
  }

  const loadedRequestCounts = new Map(lazyAssetUrls.map((url) => [url, requestCounts.get(url)]));
  await page.getByRole("button", { name: "Kontynuuj jako demo" }).click();
  await expect(page).toHaveURL(/#\/app\/orders$/);
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();
  await page.locator('.sidebar nav a[data-route="/app/reports"]').click();
  await expect(page.getByRole("heading", { name: "Raporty", level: 1 })).toBeVisible();

  for (const url of lazyAssetUrls) {
    expect(requestCounts.get(url)).toBe(loadedRequestCounts.get(url));
  }
});

test("direct application entries preserve the guarded return route after lazy loading", async ({ context }) => {
  const entries = [
    { hash: "#/app", heading: "Przegląd" },
    { hash: "#/app/orders", heading: "Zlecenia" },
  ];

  for (const entry of entries) {
    const page = await context.newPage();

    try {
      await openFresh(page, entry.hash);
      await expect(page.getByRole("heading", { name: "Zaloguj się", level: 1 })).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem("auth:returnTo"))).toBe(entry.hash);

      await page.getByRole("button", { name: "Kontynuuj jako demo" }).click();
      await expect(page).toHaveURL(new RegExp(`${entry.hash}$`));
      await expect(page.getByRole("heading", { name: entry.heading, level: 1 })).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem("auth:returnTo"))).toBeNull();
    } finally {
      await page.close();
    }
  }
});

test("a delayed application import cannot render an obsolete hash", async ({ page }) => {
  await openFresh(page);
  await expect(page.locator(".landing-home")).toBeVisible();

  const lazyJavascriptUrl = (await generatedLazyRuntimeAssetUrls(page)).find((url) => url.endsWith(".js"));
  let releaseApplicationRequest;
  const applicationRequestGate = new Promise((resolveRequest) => {
    releaseApplicationRequest = resolveRequest;
  });
  let applicationRequestCount = 0;
  const isApplicationRequest = (url) => url.pathname === lazyJavascriptUrl;

  await page.route(isApplicationRequest, async (route) => {
    applicationRequestCount += 1;
    await applicationRequestGate;
    await route.continue();
  });

  try {
    await page.evaluate(() => {
      window.location.hash = "#/app/orders";
    });
    await expect.poll(() => applicationRequestCount).toBe(1);

    await page.evaluate(() => {
      window.location.hash = "#/login";
    });
    releaseApplicationRequest();

    await expect(page.getByRole("heading", { name: "Zaloguj się", level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/#\/login$/);
    expect(await page.evaluate(() => sessionStorage.getItem("auth:returnTo"))).toBeNull();
    expect(applicationRequestCount).toBe(1);
  } finally {
    releaseApplicationRequest();
    await page.unroute(isApplicationRequest);
  }
});

test("application bootstrap and routing do not publish module APIs on window", async ({ page }) => {
  await loginAsDemo(page);
  await page.locator('.sidebar nav a[data-route="/app/orders"]').click();
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();

  const publishedGlobals = await page.evaluate(() => {
    const legacyGlobals = [
      "FleetStorage",
      "CleanupRegistry",
      "format",
      "dom",
      "FleetUI",
      "FleetStore",
      "FleetRouter",
      "renderAppShell",
      "FleetPermissions",
      "FleetSeed",
      "Accordion",
      "Dropdown",
      "Modal",
      "Toast",
      "RecordDrawer",
      "Table",
      "settingsView",
      "fleetView",
      "dashboardView",
      "driversView",
      "notFoundView",
      "ordersView",
      "reportsView",
    ];

    return legacyGlobals.filter((name) => Object.prototype.hasOwnProperty.call(window, name));
  });

  expect(publishedGlobals).toEqual([]);
});

test("public static pages expose route-specific metadata", async ({ page }) => {
  const routes = [
    { path: "/", title: "FleetOps", heading: /FleetOps/, canonical: "https://saas-pr02-fleetops.netlify.app/" },
    { path: "/product/", title: "Produkt FleetOps | FleetOps", heading: "Produkt FleetOps", canonical: "https://saas-pr02-fleetops.netlify.app/product/" },
    { path: "/features/", title: "Funkcje FleetOps | FleetOps", heading: "Funkcje FleetOps", canonical: "https://saas-pr02-fleetops.netlify.app/features/" },
    { path: "/pricing/", title: "Cennik FleetOps | FleetOps", heading: "Cennik FleetOps", canonical: "https://saas-pr02-fleetops.netlify.app/pricing/" },
    { path: "/about/", title: "O nas | FleetOps", heading: "O nas", canonical: "https://saas-pr02-fleetops.netlify.app/about/" },
    { path: "/contact/", title: "Kontakt | FleetOps", heading: "Kontakt", canonical: "https://saas-pr02-fleetops.netlify.app/contact/" },
    { path: "/security/", title: "Bezpieczeństwo | FleetOps", heading: "Bezpieczeństwo", canonical: "https://saas-pr02-fleetops.netlify.app/security/" },
    { path: "/careers/", title: "Kariera | FleetOps", heading: "Kariera", canonical: "https://saas-pr02-fleetops.netlify.app/careers/" },
    { path: "/privacy/", title: "Polityka prywatności | FleetOps", heading: "Polityka prywatności", canonical: "https://saas-pr02-fleetops.netlify.app/privacy/" },
    { path: "/terms/", title: "Regulamin | FleetOps", heading: "Regulamin", canonical: "https://saas-pr02-fleetops.netlify.app/terms/" },
    { path: "/cookies/", title: "Polityka cookies | FleetOps", heading: "Polityka cookies", canonical: "https://saas-pr02-fleetops.netlify.app/cookies/" },
  ];

  for (const route of routes) {
    await openFresh(page, route.path);
    await expect(page).toHaveTitle(route.title);
    await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", route.canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", route.canonical);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", route.title);
  }
});

test("legacy public hashes redirect to static URLs", async ({ page }) => {
  const redirects = [
    { hash: "#/", expected: /\/$/ },
    { hash: "#/product", expected: /\/product\/$/ },
    { hash: "#/features", expected: /\/features\/$/ },
    { hash: "#/pricing", expected: /\/pricing\/$/ },
    { hash: "#/about", expected: /\/about\/$/ },
    { hash: "#/contact", expected: /\/contact\/$/ },
    { hash: "#/security", expected: /\/security\/$/ },
    { hash: "#/careers", expected: /\/careers\/$/ },
    { hash: "#/privacy", expected: /\/privacy\/$/ },
    { hash: "#/terms", expected: /\/terms\/$/ },
    { hash: "#/cookies", expected: /\/cookies\/$/ },
  ];

  for (const redirect of redirects) {
    await openFresh(page, redirect.hash);
    await expect(page).toHaveURL(redirect.expected);
    await expect(page.locator(".landing")).toBeVisible();
  }
});

test("static and dynamic entrypoints do not emit console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  for (const path of ["/", "/features/", "/pricing/", "/about/", "/contact/", "/privacy/"]) {
    await openFresh(page, path);
    await expect(page.locator("#app > .landing")).toBeVisible();
  }

  await openFresh(page, "#/login");
  await expect(page.getByRole("heading", { name: "Zaloguj się", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Kontynuuj jako demo" }).click();
  await expect(page).toHaveURL(/#\/app$/);
  await expect(page.getByRole("heading", { name: "Przegląd", level: 1 })).toBeVisible();

  expect(errors).toEqual([]);
});

// The worker's cache identity is build data, so it is checked against the build that
// produced it rather than against a recorded name: the revision is recomputed here,
// independently of the plugin, from the runtime asset list in the same artifact. That
// pins both halves of the contract at once — two equivalent builds emit the same sorted
// list and therefore the same cache name, and a build that emits a different runtime
// asset hash cannot keep the previous name, because the hashed URLs are the digest
// input. The maintained source is asserted to carry no build-specific value at all, so
// neither result can be produced by a hand edit.
test("the generated service worker derives its cache name from this build's runtime assets", () => {
  const generated = repositoryFile("dist/sw.js");
  const maintained = repositoryFile("public/sw.js");

  const prefix = generated.match(/^const CACHE_PREFIX = "([^"]*)";$/m)?.[1];
  const revision = generated.match(/^const CACHE_NAME = CACHE_PREFIX \+ \("([^"]*)"\);$/m)?.[1];
  const runtimeAssetUrls = generatedRuntimeAssetUrls();

  expect(prefix).toBe("fleetops-");
  expect(Array.isArray(runtimeAssetUrls)).toBe(true);
  expect(runtimeAssetUrls.length).toBeGreaterThan(0);
  // Sorted output is what keeps the digest independent of bundle iteration order.
  expect(runtimeAssetUrls).toEqual([...runtimeAssetUrls].sort());

  const expectedRevision = createHash("sha256").update(runtimeAssetUrls.join("\n")).digest("hex").slice(0, 12);
  expect(revision).toBe(expectedRevision);

  // No cache version is maintained by hand: the build placeholder is what ships in the
  // repository, and no build-specific cache literal survives anywhere in the source.
  expect(maintained).toContain('CACHE_PREFIX + (/* __FLEETOPS_CACHE_REVISION__ */ "dev")');
  expect(maintained).not.toMatch(/fleetops-v\d/);
});

test.describe("service worker navigation cache", () => {
  test.use({ serviceWorkers: "allow" });

  test("serves cached static public routes by their own documents while offline", async ({ page, context }) => {
    const routes = [
      { path: "/features/", title: "Funkcje FleetOps | FleetOps", heading: "Funkcje FleetOps" },
      { path: "/pricing/", title: "Cennik FleetOps | FleetOps", heading: "Cennik FleetOps" },
      { path: "/about/", title: "O nas | FleetOps", heading: "O nas" },
      { path: "/contact/", title: "Kontakt | FleetOps", heading: "Kontakt" },
      { path: "/privacy/", title: "Polityka prywatności | FleetOps", heading: "Polityka prywatności" },
    ];

    await page.goto("/");
    await waitForServiceWorkerControl(page);
    await context.setOffline(true);

    try {
      for (const route of routes) {
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveTitle(route.title);
        await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();
        await expect(page.locator(".landing-home")).toHaveCount(0);
      }
    } finally {
      await context.setOffline(false);
    }
  });

  // The service worker must pass a fulfilled network response through unchanged,
  // including an HTTP error status, instead of treating it as an offline failure.
  // Only the status is asserted here: the Vite preview returns a plain 404 and does
  // not serve Netlify's custom `404.html` body, which stays a deployment check.
  test("returns the host 404 response for an unknown path while controlled by the service worker", async ({ page }) => {
    await page.goto("/");
    await waitForServiceWorkerControl(page);

    const response = await page.goto("/missing-page", { waitUntil: "domcontentloaded" });

    expect(response).not.toBeNull();
    expect(response.status()).toBe(404);
  });

  // The counterpart of the test above: a genuinely rejected navigation request with no
  // cached document for the requested URL must render the precached FleetOps offline
  // document instead of the browser's own connectivity error page. The fallback answers
  // the original request, so the requested URL stays in the address bar.
  test("serves the branded offline fallback for an uncached navigation while offline", async ({ page, context }) => {
    await page.goto("/");
    await waitForServiceWorkerControl(page);
    await context.setOffline(true);

    try {
      await page.goto("/offline-fallback-probe", { waitUntil: "domcontentloaded" });

      await expect(page).toHaveTitle("Brak połączenia z siecią | FleetOps");
      await expect(page.getByRole("heading", { name: "Brak połączenia z siecią", level: 1 })).toBeVisible();
      await expect(page.getByText("FleetOps", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Wróć do FleetOps" })).toHaveAttribute("href", "/");
      await expect(page).toHaveURL(/\/offline-fallback-probe$/);
    } finally {
      await context.setOffline(false);
    }
  });

  // Precaching the documents alone leaves a first offline visit to a precached but
  // unvisited route rendering as unstyled, inert HTML: the hashed stylesheet and entry
  // script this build emitted have to be precached alongside them.
  test("renders a precached but unvisited route styled and interactive on a first offline navigation", async ({ page, context }) => {
    // Keep Chromium's normal HTTP cache out of the proof: successful CSS and JavaScript
    // responses below must come through the active worker rather than a previous page load.
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });

    await page.goto("/");
    await waitForServiceWorkerControl(page);
    await context.setOffline(true);

    try {
      // Installation readiness, client control and cache readiness are separate states.
      // Read and consume the generated runtime responses inside the active worker after
      // the offline transition, which both validates the exact dependency and provides
      // a deterministic worker handshake before the browser issues concurrent subrequests.
      const precachedAssets = await readPrecachedRuntimeAssetsFromWorker(context);
      const stylesheets = precachedAssets.filter(({ pathname }) => pathname.endsWith(".css"));
      const scripts = precachedAssets.filter(({ pathname }) => pathname.endsWith(".js"));

      expect(stylesheets).not.toHaveLength(0);
      expect(scripts).not.toHaveLength(0);
      expect(precachedAssets.every(({ status, bytes }) => status === 200 && bytes > 0)).toBe(true);

      // First navigation to `/contact/` in this context: it is in the document
      // precache and has never been visited.
      await page.goto("/contact/", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveTitle("Kontakt | FleetOps");
      await expect(page.getByRole("heading", { name: "Kontakt", level: 1 })).toBeVisible();

      // The production stylesheet is applied, not merely linked: a stylesheet that
      // did not load contributes no custom properties.
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim())).not.toBe("");

      // The production entry script executed: the FAQ markup ships without
      // `aria-expanded`, so both the attribute and the toggle come from the bundle.
      const header = page.locator("#faq .accordion-item").first().locator(".accordion-header");
      await expect(header).toHaveAttribute("aria-expanded", "false");
      await header.click();
      await expect(header).toHaveAttribute("aria-expanded", "true");
    } finally {
      await context.setOffline(false);
      await client.detach();
    }
  });

  test("loads the precached application graph on a first offline application entry", async ({ page, context }) => {
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });

    await page.goto("/");
    await expect(page.locator(".landing-home")).toBeVisible();
    const lazyAssetUrls = await generatedLazyRuntimeAssetUrls(page);
    const loadedResourceUrls = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname)
    );

    for (const url of lazyAssetUrls) {
      expect(loadedResourceUrls).not.toContain(url);
    }

    await waitForServiceWorkerControl(page);
    await context.setOffline(true);

    try {
      const precachedAssets = await readPrecachedRuntimeAssetsFromWorker(context);

      for (const url of lazyAssetUrls) {
        const cachedAsset = precachedAssets.find(({ pathname }) => pathname === url);
        expect(cachedAsset).toBeDefined();
        expect(cachedAsset.status).toBe(200);
        expect(cachedAsset.bytes).toBeGreaterThan(0);
      }

      await page.evaluate(() => {
        window.location.hash = "#/app/orders";
      });
      await expect(page.getByRole("heading", { name: "Zaloguj się", level: 1 })).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem("auth:returnTo"))).toBe("#/app/orders");

      await page.getByRole("button", { name: "Kontynuuj jako demo" }).click();
      await expect(page).toHaveURL(/#\/app\/orders$/);
      await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();
      await page.locator('.sidebar nav a[data-route="/app/reports"]').click();
      await expect(page.getByRole("heading", { name: "Raporty", level: 1 })).toBeVisible();
    } finally {
      await context.setOffline(false);
      await client.detach();
    }
  });
});

test("static public navigation resets scroll position", async ({ page }) => {
  await openFresh(page);
  await scrollPageDown(page);
  await page.getByRole("link", { name: "Porozmawiajmy" }).click();
  await expect(page).toHaveURL(/\/contact\/$/);
  await expect(page.getByRole("heading", { name: "Kontakt", level: 1 })).toBeVisible();
  await expectPageTop(page);

  await scrollPageDown(page);
  await page.locator('.site-header__link[href="/pricing/"]').click();
  await expect(page).toHaveURL(/\/pricing\/$/);
  await expect(page.getByRole("heading", { name: "Cennik FleetOps", level: 1 })).toBeVisible();
  await expectPageTop(page);

  await scrollPageDown(page);
  await page.locator('a.site-header__action[href="/#/login"]').click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("heading", { name: "Zaloguj się", level: 1 })).toBeVisible();
  await expectPageTop(page);

  await page.getByRole("button", { name: "Kontynuuj jako demo" }).click();
  await expect(page).toHaveURL(/#\/app$/);
  await expect(page.getByRole("heading", { name: "Przegląd", level: 1 })).toBeVisible();
  await page.locator('.sidebar nav a[data-route="/app/orders"]').click();
  await expect(page).toHaveURL(/#\/app\/orders$/);
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();
  await expectPageTop(page);
  await scrollPageDown(page);
  await page.locator('.sidebar nav a[data-route="/app/reports"]').click();
  await expect(page).toHaveURL(/#\/app\/reports$/);
  await expect(page.getByRole("heading", { name: "Raporty", level: 1 })).toBeVisible();
  await expectPageTop(page);
});

test("mobile drawer route changes reset visible scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await openFresh(page);
  await scrollPageDown(page);
  await page.locator("#navToggle").click();
  await page.locator('#mobileNav a[href="/contact/"]').click();
  await expect(page).toHaveURL(/\/contact\/$/);
  await expect(page.getByRole("heading", { name: "Kontakt", level: 1 })).toBeVisible();
  await expectPageTop(page);

  await scrollPageDown(page);
  await page.locator("#navToggle").click();
  await page.locator('#mobileNav a[href="/pricing/"]').click();
  await expect(page).toHaveURL(/\/pricing\/$/);
  await expect(page.getByRole("heading", { name: "Cennik FleetOps", level: 1 })).toBeVisible();
  await expectPageTop(page);

  await openFresh(page, "#/login");
  await page.getByRole("button", { name: "Kontynuuj jako demo" }).click();
  await expect(page).toHaveURL(/#\/app$/);
  await expect(page.getByRole("heading", { name: "Przegląd", level: 1 })).toBeVisible();
  await page.locator("#drawerToggle").click();
  await page.locator('#appDrawer a[data-route="/app/orders"]').click();
  await expect(page).toHaveURL(/#\/app\/orders$/);
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();
  await expectPageTop(page);
  await scrollPageDown(page);
  await page.locator("#drawerToggle").click();
  await page.locator('#appDrawer a[data-route="/app/reports"]').click();
  await expect(page).toHaveURL(/#\/app\/reports$/);
  await expect(page.getByRole("heading", { name: "Raporty", level: 1 })).toBeVisible();
  await expectPageTop(page);
});

test("toast feedback exposes stable polite and assertive live regions", async ({ page }) => {
  await openFresh(page, "#/login");
  await page.getByLabel("E-mail").fill("smoke@fleetops.app");
  await page.getByLabel("Hasło").fill("test");
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(/#\/app$/);

  const statusRegion = page.locator("#fleetops-toast-status");
  const alertRegion = page.locator("#fleetops-toast-alert");

  await expect(statusRegion).toHaveAttribute("role", "status");
  await expect(statusRegion).toHaveAttribute("aria-live", "polite");
  await expect(statusRegion).toHaveAttribute("aria-atomic", "true");
  await expect(alertRegion).toHaveAttribute("role", "alert");
  await expect(alertRegion).toHaveAttribute("aria-live", "assertive");
  await expect(alertRegion).toHaveAttribute("aria-atomic", "true");
  await expect(statusRegion).toHaveText("Zalogowano");

  await page.locator("#roleSwitcher").selectOption("u_drv_1");
  await page.locator('.sidebar nav a[data-route="/app/orders"]').click();
  const firstOrder = page.locator("tr.order-row").first();
  await expect(firstOrder).toBeVisible();
  await firstOrder.locator('[data-order-menu] .dropdown-trigger').click();
  await firstOrder.locator('[data-order-action="edit"]').click({ force: true });
  await expect(alertRegion).toContainText("Brak uprawnień:");
});

test("non-admin roles remain restricted and permission denials reach the activity trail", async ({ page }) => {
  await loginAsDemo(page);
  const roleSwitcher = page.locator("#roleSwitcher");
  const alertRegion = page.locator("#fleetops-toast-alert");

  await roleSwitcher.selectOption("u_disp_1");
  await expect(page.getByRole("heading", { name: "Przegląd", level: 1 })).toBeVisible();
  await page.locator('.sidebar nav a[data-route="/app/orders"]').click();
  await expect(page.getByRole("button", { name: "Dodaj zlecenie" })).toBeEnabled();
  const dispatcherOrder = page.locator("tr.order-row").first();
  await expect(dispatcherOrder).toBeVisible();
  await dispatcherOrder.locator('[data-order-menu] .dropdown-trigger').click();
  const dispatcherDelete = dispatcherOrder.locator('[data-order-action="delete"]');
  await expect(dispatcherDelete).toHaveAttribute("aria-disabled", "true");
  await dispatcherDelete.click({ force: true });
  await expect(alertRegion).toContainText("Dyspozytor");

  await roleSwitcher.selectOption("u_drv_1");
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dodaj zlecenie" })).toBeDisabled();
  const driverOrder = page.locator("tr.order-row").first();
  await expect(driverOrder).toBeVisible();
  await driverOrder.locator('[data-order-menu] .dropdown-trigger').click();
  const driverEdit = driverOrder.locator('[data-order-action="edit"]');
  await expect(driverEdit).toHaveAttribute("aria-disabled", "true");
  await driverEdit.click({ force: true });
  await expect(alertRegion).toContainText("Kierowca");
  await expect.poll(async () =>
    page.evaluate(() => {
      const activity = JSON.parse(localStorage.getItem("fleet-activity-v1") || "[]");
      const denials = activity.filter((entry) => entry.title === "Odmowa uprawnień");
      return {
        count: denials.length,
        hasDispatcher: denials.some((entry) => entry.detail.includes("Dyspozytor")),
        hasDriver: denials.some((entry) => entry.detail.includes("Kierowca")),
      };
    })
  ).toEqual({ count: 2, hasDispatcher: true, hasDriver: true });
});

test("offline mutations are rejected with an explicit not-saved message and reconnect does not imply sync", async ({ page, context }) => {
  await loginAsDemo(page);
  await page.locator('.sidebar nav a[data-route="/app/drivers"]').click();
  await expect(page.getByRole("heading", { name: "Kierowcy", level: 1 })).toBeVisible();

  const driverName = "Offline Rejection Test";
  const alertRegion = page.locator("#fleetops-toast-alert");
  const statusRegion = page.locator("#fleetops-toast-status");

  await context.setOffline(true);

  await page.getByRole("button", { name: "Dodaj kierowcę" }).click();
  const addDriverDialog = page.getByRole("dialog", { name: "Dodaj kierowcę" });
  await expect(addDriverDialog).toBeVisible();
  await addDriverDialog.getByLabel("Imię i nazwisko").fill(driverName);
  await addDriverDialog.getByLabel("Telefon").fill("+48 600 900 999");
  await addDriverDialog.getByRole("button", { name: "Dodaj kierowcę" }).click();

  await expect(alertRegion).toContainText("nie została zapisana");
  await expect(alertRegion).toContainText("Powtórz akcję po przywróceniu połączenia");

  // The record is rejected outright, not queued: the form stays open on failure.
  await expect(addDriverDialog).toBeVisible();
  await page.getByRole("button", { name: "Anuluj" }).click();
  await expect(page.locator("tr.driver-row").filter({ hasText: driverName })).toHaveCount(0);

  await context.setOffline(false);

  await expect(statusRegion).toHaveText("Połączenie przywrócone");
  const alertTextAfterReconnect = (await alertRegion.textContent()) || "";
  expect(alertTextAfterReconnect).not.toMatch(/zsynchronizow|przetworzon|kolejk/i);

  // Reconnect never replays the rejected mutation.
  await expect(page.locator("tr.driver-row").filter({ hasText: driverName })).toHaveCount(0);
});

test("dropdowns use disclosure semantics and close with Escape", async ({ page }) => {
  const ariaMenuSelector = '[role="menu"], [aria-haspopup="menu"], [role="menuitem"]';

  await openFresh(page);
  await expect(page.locator(ariaMenuSelector)).toHaveCount(0);

  await loginAsDemo(page);
  await page.locator('.sidebar nav a[data-route="/app/orders"]').click();
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();
  await expect(page.locator(ariaMenuSelector)).toHaveCount(0);

  const firstDropdown = page.locator("[data-order-menu]").first();
  const trigger = firstDropdown.locator(".dropdown-trigger");
  const panel = firstDropdown.locator(".dropdown-menu");

  await expect(trigger).toHaveAttribute("aria-controls", /order-actions-\d+/);
  await expect(panel).toHaveAttribute("id", /order-actions-\d+/);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(panel).not.toBeVisible();

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(panel).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("record detail drawer handles read-only app details accessibly", async ({ page }) => {
  await loginAsDemo(page);
  await page.locator('.sidebar nav a[data-route="/app/orders"]').click();
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();

  const firstOrderRow = page.locator("tr.order-row").first();
  const firstOrderTrigger = firstOrderRow.locator("[data-record-detail]");
  await expect(firstOrderTrigger).toBeVisible();
  await firstOrderTrigger.click();

  const orderDrawer = page.getByRole("dialog", { name: /Zlecenie FO-/ });
  await expect(orderDrawer).toBeVisible();
  await expect(page.locator(".record-drawer")).toHaveCount(1);
  await expect(page.locator(".modal")).toHaveCount(0);
  await expect(orderDrawer.getByRole("button", { name: "Pełny widok zlecenia - wkrótce" })).toBeDisabled();
  await expect(orderDrawer.getByRole("button", { name: "Zamknij szczegóły" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(orderDrawer.getByRole("button", { name: "Zamknij szczegóły" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator(".record-drawer")).toHaveCount(0);
  await expect(firstOrderTrigger).toBeFocused();

  await firstOrderRow.locator("td").nth(1).click();
  await expect(page.getByRole("dialog", { name: /Zlecenie FO-/ })).toBeVisible();
  await expect(page.locator(".record-drawer")).toHaveCount(1);
  await page.locator(".record-drawer__backdrop").click({ position: { x: 8, y: 8 } });
  await expect(page.locator(".record-drawer")).toHaveCount(0);

  await page.locator('.sidebar nav a[data-route="/app/drivers"]').click();
  await expect(page.getByRole("heading", { name: "Kierowcy", level: 1 })).toBeVisible();
  const firstDriverTrigger = page.locator(".driver-row [data-record-detail]").first();
  await expect(firstDriverTrigger).toBeVisible();
  await firstDriverTrigger.click();
  await expect(page.getByRole("dialog", { name: "Szczegóły kierowcy" })).toBeVisible();
  await expect(page.locator(".modal")).toHaveCount(0);
  await page.getByRole("button", { name: "Zamknij szczegóły" }).click();
  await expect(firstDriverTrigger).toBeFocused();

  await page.locator('.sidebar nav a[data-route="/app/fleet"]').click();
  await expect(page.getByRole("heading", { name: "Flota", level: 1 })).toBeVisible();
  const firstVehicleDetails = page.getByRole("button", { name: "Szczegóły" }).first();
  await expect(firstVehicleDetails).toBeVisible();
  await firstVehicleDetails.click();
  await expect(page.getByRole("dialog", { name: "Szczegóły pojazdu" })).toBeVisible();
  await expect(page.locator(".modal")).toHaveCount(0);

  await page.evaluate(() => {
    window.location.hash = "#/app/reports";
  });
  await expect(page.getByRole("heading", { name: "Raporty", level: 1 })).toBeVisible();
  await expect(page.locator(".record-drawer")).toHaveCount(0);
});

test("record detail drawer fits mobile viewport and CRUD still uses modals", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await loginAsDemo(page);

  await page.locator("#drawerToggle").click();
  await page.locator('#appDrawer a[data-route="/app/orders"]').click();
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();
  const scrollWidthBeforeDrawer = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.locator("tr.order-row [data-record-detail]").first().click();
  await expect(page.getByRole("dialog", { name: /Zlecenie FO-/ })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const rect = document.querySelector(".record-drawer__panel").getBoundingClientRect();
        return Math.ceil(rect.right - window.innerWidth);
      }),
    )
    .toBeLessThanOrEqual(1);

  const drawerBounds = await page.evaluate(() => {
    const rect = document.querySelector(".record-drawer__panel").getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(drawerBounds.left).toBeGreaterThanOrEqual(-1);
  expect(drawerBounds.width).toBeLessThanOrEqual(drawerBounds.viewportWidth + 1);
  expect(drawerBounds.right).toBeLessThanOrEqual(drawerBounds.viewportWidth + 1);
  expect(drawerBounds.scrollWidth).toBeLessThanOrEqual(scrollWidthBeforeDrawer + 1);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Dodaj zlecenie" }).click();
  await expect(page.getByRole("dialog", { name: "Dodaj zlecenie" })).toBeVisible();
  await expect(page.locator(".modal")).toBeVisible();
  await page.getByRole("button", { name: "Anuluj" }).click();

  await page.locator("#drawerToggle").click();
  await page.locator('#appDrawer a[data-route="/app/fleet"]').click();
  await expect(page.getByRole("heading", { name: "Flota", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Dodaj pojazd" }).click();
  await expect(page.getByRole("dialog", { name: "Dodaj pojazd" })).toBeVisible();
  await expect(page.locator(".modal")).toBeVisible();
  await page.getByRole("button", { name: "Anuluj" }).click();

  await page.locator("#drawerToggle").click();
  await page.locator('#appDrawer a[data-route="/app/drivers"]').click();
  await expect(page.getByRole("heading", { name: "Kierowcy", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Dodaj kierowcę" }).click();
  await expect(page.getByRole("dialog", { name: "Dodaj kierowcę" })).toBeVisible();
  await expect(page.locator(".modal")).toBeVisible();
});

test("core app routes render route-level headings", async ({ page }) => {
  await loginAsDemo(page);

  const routes = [
    { path: "/app", heading: "Przegląd" },
    { path: "/app/orders", heading: "Zlecenia" },
    { path: "/app/fleet", heading: "Flota" },
    { path: "/app/drivers", heading: "Kierowcy" },
    { path: "/app/reports", heading: "Raporty" },
    { path: "/app/settings", heading: "Ustawienia" },
  ];

  for (const route of routes) {
    await page.locator(`.sidebar nav a[data-route="${route.path}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${route.path}$`));
    await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();
  }
});

test("orders CSV export stays demo-disabled while reports JSON export works", async ({ page }) => {
  await loginAsDemo(page);
  await page.locator('.sidebar nav a[data-route="/app/orders"]').click();
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();

  const csvExport = page.getByRole("button", { name: "Eksportuj CSV" });
  await expect(csvExport).toBeDisabled();
  await expect(csvExport).toHaveAttribute("title", "Eksport CSV jest niedostępny w wersji demo");

  await page.locator('.sidebar nav a[data-route="/app/reports"]').click();
  await expect(page.getByRole("heading", { name: "Raporty", level: 1 })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksportuj JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fleetops-reports.json");
});

test("app topbar search and alerts are demo-disabled while the adjacent controls stay operable", async ({ page }) => {
  await loginAsDemo(page);

  const search = page.locator(".topbar .search input");
  await expect(search).toBeDisabled();
  await expect(search).toHaveAttribute("title", "Wyszukiwanie globalne jest niedostępne w wersji demo");

  const alerts = page.getByRole("button", { name: "Alerty" });
  await expect(alerts).toBeDisabled();
  await expect(alerts).toHaveAttribute("title", "Alerty są niedostępne w wersji demo");

  const roleSwitcher = page.locator("#roleSwitcher");
  await expect(roleSwitcher).toBeEnabled();
  await roleSwitcher.selectOption("u_drv_1");
  await expect(page.locator("#fleetops-toast-status")).toContainText("Rola zmieniona: Kierowca");

  const userMenuBtn = page.locator("#userMenuBtn");
  await expect(userMenuBtn).toBeEnabled();
  await userMenuBtn.click();
  await expect(userMenuBtn).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#logoutBtn")).toBeVisible();
});

test("settings table preferences update persisted list and dense state", async ({ page, context }) => {
  await loginAsDemo(page);
  await page.locator('.sidebar nav a[data-route="/app/settings"]').click();
  await expect(page.getByRole("heading", { name: "Ustawienia", level: 1 })).toBeVisible();

  const pageSizeButton = page.getByRole("button", { name: "25 wierszy" });
  const denseButton = page.getByRole("button", { name: "Gęsty widok" });
  const compactToggle = page.locator("#compactToggle");

  await expect(pageSizeButton).toHaveAttribute("aria-pressed", "false");
  await expect(denseButton).toHaveAttribute("aria-pressed", "false");
  await expect(compactToggle).not.toBeChecked();

  await pageSizeButton.click();
  await expect(pageSizeButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () =>
    page.evaluate(() => {
      const prefs = JSON.parse(localStorage.getItem("fleet-list-prefs-v1") || "{}");
      return ["orders", "fleet", "drivers"].every((key) => prefs[key]?.pageSize === 25 && prefs[key]?.visibleCount === 25);
    }),
  ).toBe(true);

  await denseButton.click();
  await expect(denseButton).toHaveAttribute("aria-pressed", "true");
  await expect(compactToggle).toBeChecked();
  await expect(page.locator("body")).toHaveAttribute("data-compact", "true");
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("fleet-compact") || "false"))).toBe(true);

  const restoredPage = await context.newPage();
  await restoredPage.goto("/#/app/settings");
  await expect(restoredPage.getByRole("heading", { name: "Ustawienia", level: 1 })).toBeVisible();
  await expect(restoredPage.getByRole("button", { name: "25 wierszy" })).toHaveAttribute("aria-pressed", "true");
  await expect(restoredPage.getByRole("button", { name: "Gęsty widok" })).toHaveAttribute("aria-pressed", "true");
  await expect(restoredPage.locator("#compactToggle")).toBeChecked();
  await restoredPage.close();
});

test("demo reset runs only after an explicit confirmation that names the reset scope", async ({ page }) => {
  await loginAsDemo(page);

  const driverName = "Reset Confirmation Test";
  const statusRegion = page.locator("#fleetops-toast-status");
  const createdDriver = page.locator("tr.driver-row").filter({ hasText: driverName });
  const roleSwitcher = page.locator("#roleSwitcher");

  // Representative resettable state: one locally created domain record.
  await page.locator('.sidebar nav a[data-route="/app/drivers"]').click();
  await expect(page.getByRole("heading", { name: "Kierowcy", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Dodaj kierowcę" }).click();
  const addDriverDialog = page.getByRole("dialog", { name: "Dodaj kierowcę" });
  await addDriverDialog.getByLabel("Imię i nazwisko").fill(driverName);
  await addDriverDialog.getByLabel("Telefon").fill("+48 600 700 800");
  await addDriverDialog.getByRole("button", { name: "Dodaj kierowcę" }).click();
  await expect(createdDriver).toHaveCount(1);

  // The reset preserves the selected role, so move away from the default one.
  await roleSwitcher.selectOption("u_disp_1");
  await expect(roleSwitcher).toHaveValue("u_disp_1");

  await page.locator('.sidebar nav a[data-route="/app/settings"]').click();
  await expect(page.getByRole("heading", { name: "Ustawienia", level: 1 })).toBeVisible();

  const resetButton = page.getByRole("button", { name: "Resetuj", exact: true });
  await resetButton.click();

  const confirmDialog = page.getByRole("dialog", { name: "Potwierdzenie resetu demo" });
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog).toContainText("zlecenia, pojazdy i kierowcy");
  await expect(confirmDialog).toContainText("historia aktywności");
  await expect(confirmDialog).toContainText("filtry oraz preferencje list i tabel");
  await expect(confirmDialog).toContainText("motyw i tryb kompaktowy");
  await expect(confirmDialog).toContainText("zakres przeglądu");
  await expect(confirmDialog).toContainText("Bez zmian pozostaną aktualna sesja i wybrana rola");

  // Cancelling is a no-op: no reset, no success toast, no redirect.
  await confirmDialog.getByRole("button", { name: "Anuluj" }).click();
  await expect(confirmDialog).toHaveCount(0);
  await expect(page).toHaveURL(/#\/app\/settings$/);
  await expect(statusRegion).not.toContainText("Demo przywrócone");
  await page.locator('.sidebar nav a[data-route="/app/drivers"]').click();
  await expect(createdDriver).toHaveCount(1);

  await page.locator('.sidebar nav a[data-route="/app/settings"]').click();
  await expect(page.getByRole("heading", { name: "Ustawienia", level: 1 })).toBeVisible();
  await resetButton.click();
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Resetuj dane demo" }).click();

  await expect(statusRegion).toHaveText("Demo przywrócone do stanu początkowego");
  await expect(page).toHaveURL(/#\/app$/);
  await expect(page.getByRole("heading", { name: "Przegląd", level: 1 })).toBeVisible();

  // Session and selected role survive the reset; the created record does not.
  await expect(roleSwitcher).toHaveValue("u_disp_1");
  await page.locator('.sidebar nav a[data-route="/app/drivers"]').click();
  await expect(page.getByRole("heading", { name: "Kierowcy", level: 1 })).toBeVisible();
  await expect(createdDriver).toHaveCount(0);
});

test("CRUD validation errors are programmatically associated with fields", async ({ page }) => {
  await loginAsDemo(page);

  const scenarios = [
    {
      route: "/app/orders",
      heading: "Zlecenia",
      addButton: "Dodaj zlecenie",
      dialog: "Dodaj zlecenie",
      submitButton: "Dodaj zlecenie",
      prefix: "orders-form",
      fields: ["client", "route", "status", "eta", "priority"],
      invalidFields: ["client", "route", "eta"],
    },
    {
      route: "/app/fleet",
      heading: "Flota",
      addButton: "Dodaj pojazd",
      dialog: "Dodaj pojazd",
      submitButton: "Dodaj pojazd",
      prefix: "fleet-form",
      fields: ["id", "type", "status", "lastCheck", "driver"],
      invalidFields: ["id", "type", "lastCheck"],
    },
    {
      route: "/app/drivers",
      heading: "Kierowcy",
      addButton: "Dodaj kierowcę",
      dialog: "Dodaj kierowcę",
      submitButton: "Dodaj kierowcę",
      prefix: "drivers-form",
      fields: ["name", "status", "phone", "lastTrip"],
      invalidFields: ["name", "phone"],
    },
  ];

  for (const scenario of scenarios) {
    await expectCrudErrorsLinked(page, scenario);
  }
});

test("orders CRUD flow escapes user-entered HTML-like text", async ({ page }) => {
  const dialogs = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await loginAsDemo(page);
  await page.locator('.sidebar nav a[data-route="/app/orders"]').click();
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();
  await expect(page.locator("table.table")).toBeVisible();

  const htmlLikeClient = "<img src=x onerror=alert(1)>";
  const editedClient = "Smoke Test Edited Client";

  await page.getByRole("button", { name: "Dodaj zlecenie" }).click();
  const addOrderDialog = page.getByRole("dialog", { name: "Dodaj zlecenie" });
  await expect(addOrderDialog).toBeVisible();
  await addOrderDialog.getByLabel("Klient").fill(htmlLikeClient);
  await addOrderDialog.getByLabel("Trasa").fill("Warszawa - Poznan");
  await addOrderDialog.getByLabel("Status").selectOption("in-progress");
  await addOrderDialog.getByLabel("ETA").fill("2026-12-31");
  await addOrderDialog.getByLabel("Priorytet").selectOption("high");
  await addOrderDialog.getByRole("button", { name: "Dodaj zlecenie" }).click();

  const createdRow = page.locator("tr.order-row").filter({ hasText: htmlLikeClient }).first();
  await expect(createdRow).toBeVisible();
  await expect(createdRow).toContainText(htmlLikeClient);
  await expect(createdRow.locator("img")).toHaveCount(0);
  expect(dialogs).toEqual([]);

  await createdRow.locator('[data-order-menu] .dropdown-trigger').click();
  await createdRow.locator('[data-order-action="edit"]').click();
  await expect(page.getByRole("dialog", { name: /Edytuj FO-/ })).toBeVisible();
  const editOrderDialog = page.getByRole("dialog", { name: /Edytuj FO-/ });
  await editOrderDialog.getByLabel("Klient").fill(editedClient);
  await editOrderDialog.getByRole("button", { name: "Zapisz zmiany" }).click();

  const editedRow = page.locator("tr.order-row").filter({ hasText: editedClient }).first();
  await expect(editedRow).toBeVisible();

  await editedRow.locator('[data-order-menu] .dropdown-trigger').click();
  await editedRow.locator('[data-order-action="delete"]').click();
  await expect(page.getByRole("dialog", { name: "Potwierdzenie usunięcia" })).toBeVisible();
  await page.locator(".modal").getByRole("button", { name: "Usuń" }).click();
  await expect(page.locator("tr.order-row").filter({ hasText: editedClient })).toHaveCount(0);
});

test("app shell exposes one main landmark that the skip link focuses", async ({ page }) => {
  await loginAsDemo(page);

  const skipLink = page.locator(".skip-link");
  const mainContent = page.locator("main#main-content");

  const routes = [
    { hash: "#/app", heading: "Przegląd" },
    { hash: "#/app/orders", heading: "Zlecenia" },
    { hash: "#/app/does-not-exist", heading: "Nie znaleziono" },
  ];

  for (const route of routes) {
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, route.hash);
    await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();

    await expect(page.locator("main")).toHaveCount(1);
    await expect(mainContent).toHaveCount(1);
    await expect(mainContent).toHaveClass(/app-content/);
    await expect(mainContent).not.toHaveAttribute("role", "main");

    await expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(await skipLink.evaluate((link) => Boolean(document.getElementById(link.hash.slice(1))))).toBe(true);

    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(mainContent).toBeFocused();
  }
});

test("application shell switches navigation mode at one boundary between 1024 px and 1025 px", async ({ page }) => {
  await loginAsDemo(page);

  const appDrawer = page.locator("#appDrawer");
  const drawerToggle = page.locator("#drawerToggle");
  const appMain = page.locator(".app-main");
  const drawerOrdersLink = appDrawer.locator('nav a[data-route="/app/orders"]');
  const sidebarColumn = 240;

  for (const width of [1023, 1024]) {
    expect(await setShellLayoutWidth(page, width)).toBe(width);

    // Drawer mode: the toggle is the only navigation affordance, the sidebar
    // stays an overlay and keeps its PH4-01 modal semantics.
    await expect(drawerToggle).toBeVisible();
    await expect(appDrawer).toBeHidden();
    await expect(appDrawer).toHaveAttribute("role", "dialog");
    await expect(appDrawer).toHaveAttribute("aria-modal", "true");
    await expect(appDrawer).toHaveAttribute("aria-hidden", "true");

    // The two-column grid must not be active, so content keeps the full width.
    const mainBox = await appMain.boundingBox();
    expect(Math.round(mainBox.x)).toBe(0);
    expect(Math.round(mainBox.width)).toBe(width);

    await drawerToggle.click();
    await expect(appDrawer).toBeVisible();
    await expect(drawerOrdersLink).toBeVisible();
    await expect(appDrawer).toHaveAttribute("aria-hidden", "false");
    await page.keyboard.press("Escape");
    await expect(appDrawer).toHaveAttribute("aria-hidden", "true");
  }

  expect(await setShellLayoutWidth(page, 1025)).toBe(1025);

  // Desktop mode: the mobile top bar is withdrawn and the persistent sidebar is
  // the single navigation affordance, without PH4-01 overlay semantics.
  await expect(drawerToggle).toBeHidden();
  await expect(appDrawer).toBeVisible();
  await expect(drawerOrdersLink).toBeVisible();
  await expect(appDrawer).not.toHaveAttribute("role", "dialog");
  await expect(appDrawer).not.toHaveAttribute("aria-modal", "true");
  await expect(appDrawer).not.toHaveAttribute("aria-hidden", "true");

  // The sidebar is a static grid item, so content occupies the second column.
  // The drawer's transform transition settles after the resize.
  await expect.poll(async () => Math.round((await appDrawer.boundingBox()).x)).toBe(0);
  const sidebarBox = await appDrawer.boundingBox();
  const desktopMainBox = await appMain.boundingBox();
  expect(Math.round(sidebarBox.width)).toBe(sidebarColumn);
  expect(Math.round(desktopMainBox.x)).toBe(sidebarColumn);
  expect(Math.round(desktopMainBox.width)).toBe(1025 - sidebarColumn);
});

test("drawer ARIA semantics are viewport-conditional and survive route renders and resizes", async ({ page }) => {
  await loginAsDemo(page);

  const appDrawer = page.locator("#appDrawer");
  await expect(appDrawer).not.toHaveAttribute("role", "dialog");
  await expect(appDrawer).not.toHaveAttribute("aria-modal", "true");
  await expect(appDrawer).not.toHaveAttribute("aria-hidden", "true");
  await expect(appDrawer.locator('nav a[data-route="/app/orders"]')).toBeVisible();

  await page.locator('.sidebar nav a[data-route="/app/orders"]').click();
  await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();
  await expect(appDrawer).not.toHaveAttribute("aria-hidden", "true");
  await expect(appDrawer).not.toHaveAttribute("role", "dialog");

  await page.setViewportSize({ width: 390, height: 800 });
  await expect(appDrawer).toHaveAttribute("role", "dialog");
  await expect(appDrawer).toHaveAttribute("aria-modal", "true");
  await expect(appDrawer).toHaveAttribute("aria-hidden", "true");

  await page.locator("#drawerToggle").click();
  await expect(appDrawer).toHaveAttribute("aria-hidden", "false");
  await page.keyboard.press("Escape");
  await expect(appDrawer).toHaveAttribute("aria-hidden", "true");

  await page.locator("#drawerToggle").click();
  await expect(appDrawer).toHaveAttribute("aria-hidden", "false");
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(appDrawer).not.toHaveAttribute("aria-hidden", "true");
  await expect(appDrawer).not.toHaveAttribute("role", "dialog");
  await expect(appDrawer).not.toHaveAttribute("aria-modal", "true");

  await openFresh(page, "/");
  const mobileNav = page.locator("#mobileNav");
  await expect(mobileNav).not.toHaveAttribute("role", "dialog");
  await expect(mobileNav).not.toHaveAttribute("aria-modal", "true");
  await expect(mobileNav).not.toHaveAttribute("aria-hidden", "true");
  await expect(mobileNav.locator('.site-header__link[href="/pricing/"]')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 800 });
  await expect(mobileNav).toHaveAttribute("role", "dialog");
  await expect(mobileNav).toHaveAttribute("aria-modal", "true");
  await expect(mobileNav).toHaveAttribute("aria-hidden", "true");

  await page.locator("#navToggle").click();
  await expect(mobileNav).toHaveAttribute("aria-hidden", "false");

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(mobileNav).not.toHaveAttribute("aria-hidden", "true");
  await expect(mobileNav).not.toHaveAttribute("role", "dialog");
  await expect(mobileNav).not.toHaveAttribute("aria-modal", "true");
});

test("collapsed FAQ accordion panels are hidden from the accessibility tree and stay in sync with aria-expanded", async ({ page }) => {
  await openFresh(page);

  const item = page.locator("#faq .accordion-item").first();
  const header = item.locator(".accordion-header");
  const panel = item.locator(".accordion-content");

  await expect(header).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveAttribute("hidden", "");
  await expect(panel).not.toBeVisible();

  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
  await expect(panel).not.toHaveAttribute("hidden", "");
  await expect(panel).toBeVisible();

  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "false");
  await expect(panel).not.toBeVisible();
  await expect
    .poll(async () => panel.evaluate((el) => el.hidden))
    .toBe(true);
});

test("public contact form submits its Netlify Forms contract and confirms only a successful response", async ({ page }) => {
  await openFresh(page, "/contact/");

  // The provider parses this metadata out of the deployed document, so it has to
  // exist in the served HTML rather than being created at runtime.
  const form = page.locator("#contactForm");
  await expect(form).toHaveAttribute("name", "fleetops-contact");
  await expect(form).toHaveAttribute("method", /^post$/i);
  await expect(form).toHaveAttribute("data-netlify", "true");
  await expect(form).toHaveAttribute("data-netlify-honeypot", "bot-field");
  await expect(form.locator('input[type="hidden"][name="form-name"]')).toHaveValue("fleetops-contact");

  // The honeypot has to stay a rendered control for the provider, so it is
  // clipped rather than removed, and kept out of the accessibility tree and the
  // tab order instead.
  const honeypot = form.locator('input[name="bot-field"]');
  await expect(honeypot).toHaveValue("");
  await expect(honeypot).toHaveAttribute("tabindex", "-1");

  const honeypotWrapper = form.locator(".contact-form__honeypot");
  await expect(honeypotWrapper).toHaveAttribute("aria-hidden", "true");
  const honeypotBox = await honeypotWrapper.boundingBox();
  expect(honeypotBox.width).toBeLessThanOrEqual(1);
  expect(honeypotBox.height).toBeLessThanOrEqual(1);

  // The response is held so the pending state can be observed before it resolves.
  let releaseSubmission;
  const heldSubmission = new Promise((resolve) => {
    releaseSubmission = resolve;
  });

  const submissions = await interceptContactSubmission(page, async (route) => {
    await heldSubmission;
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>OK</title>" });
  });

  await fillContactForm(page);

  const submit = page.locator("#contactSubmit");
  await submit.click();

  // While the request is in flight the control is unusable, which is what makes
  // a duplicate submission impossible.
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveText("Wysyłanie…");
  await expect(form).toHaveAttribute("aria-busy", "true");

  // Nothing is claimed before the provider has answered: no toast exists yet.
  await expect(page.locator("#fleetops-toast-status")).toHaveCount(0);

  releaseSubmission();

  await expect(page.locator("#fleetops-toast-status")).toContainText("Wiadomość została wysłana.");

  expect(submissions).toHaveLength(1);
  expect(submissions[0].method).toBe("POST");
  expect(submissions[0].contentType).toContain("application/x-www-form-urlencoded");

  const payload = new URLSearchParams(submissions[0].body);
  expect(payload.get("form-name")).toBe("fleetops-contact");
  expect(payload.get("name")).toBe("Jan Kowalski");
  expect(payload.get("email")).toBe("jan.kowalski@firma.pl");
  expect(payload.get("fleet")).toBe("16-60");
  expect(payload.get("message")).toBe(CONTACT_MESSAGE);
  expect(payload.get("bot-field")).toBe("");

  // A confirmed success is the only thing that clears the form, acknowledgement
  // included, and the control returns to its idle state.
  await expect(form.getByLabel("Imię i nazwisko")).toHaveValue("");
  await expect(form.getByLabel("E-mail służbowy")).toHaveValue("");
  await expect(form.getByLabel("Wiadomość")).toHaveValue("");
  await expect(form.locator("#contactPrivacyAck")).not.toBeChecked();
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveText(CONTACT_SUBMIT_LABEL);
  await expect(form).toHaveAttribute("aria-busy", "false");
  await expect(page).toHaveURL(/\/contact\/$/);
});

test("a contact submission the provider rejects is reported as an error and keeps the typed message", async ({ page }) => {
  await openFresh(page, "/contact/");

  // A fulfilled response carrying an error status is the case a `.catch()`-only
  // implementation would present as a successful submission.
  const submissions = await interceptContactSubmission(page, async (route) => {
    await route.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" });
  });

  const form = await fillContactForm(page);
  const submit = page.locator("#contactSubmit");
  await submit.click();

  await expect(page.locator("#fleetops-toast-alert")).toContainText("Nie udało się potwierdzić wysłania wiadomości.");
  expect(submissions).toHaveLength(1);

  // No success is announced anywhere, and what the user typed survives.
  await expect(page.locator("#fleetops-toast-status")).toHaveText("");
  await expect(page.locator(".toast-container")).not.toContainText("Wiadomość została wysłana.");
  await expect(form.getByLabel("Imię i nazwisko")).toHaveValue("Jan Kowalski");
  await expect(form.getByLabel("E-mail służbowy")).toHaveValue("jan.kowalski@firma.pl");
  await expect(form.getByLabel("Wiadomość")).toHaveValue(CONTACT_MESSAGE);
  await expect(form.locator("#contactPrivacyAck")).toBeChecked();

  // The control is usable again so the message can be sent once more.
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveText(CONTACT_SUBMIT_LABEL);
  await expect(form).toHaveAttribute("aria-busy", "false");
  await expect(page).toHaveURL(/\/contact\/$/);

  // The published fallback channels stay available on the page.
  await expect(page.locator('.contact-panel__link[href="mailto:kontakt@kp-code.pl"]')).toBeVisible();
  await expect(page.locator('.contact-panel__link[href="tel:+48533537091"]')).toBeVisible();
});

test("public pages present scenario cards and metric figures as illustrative demo content", async ({ page }) => {
  await openFresh(page, "/");

  // No fictional customer endorsement survives on the landing page.
  const landingText = await page.locator("body").innerText();
  expect(landingText).not.toMatch(/CargoNord|FreshLine|AeroParts/);
  expect(landingText).not.toMatch(/Operatorzy o FleetOps/);
  await expect(page.locator("blockquote")).toHaveCount(0);

  // The section reads as demonstrational scenarios rather than customer quotes.
  await expect(page.getByRole("heading", { name: "Co pokazuje demo FleetOps", level: 2 })).toBeVisible();
  const scenarioLead = page.locator(".section-header__lead", { hasText: "przykładowe scenariusze operacyjne" });
  await expect(scenarioLead).toBeVisible();
  await expect(scenarioLead).toContainText("nie są opinie klientów");
  await expect(page.locator(".grid--scenarios .card--scenario")).toHaveCount(3);

  await openFresh(page, "/product/");

  const panel = page.locator(".marketing-hero__panel");
  await expect(panel.locator(".tag")).toHaveText("Przykładowe wskaźniki demo");

  // The disclaimer sits with the figures and is visible public copy.
  const note = page.locator(".marketing-hero__stats-note");
  await expect(note).toBeVisible();
  await expect(note).toContainText("ilustracyjne");
  await expect(note).toContainText("Nie są to zmierzone wyniki działania FleetOps");
  await expect(note).toContainText("zobowiązanie SLA");

  // The retained numeric cards still demonstrate the layout.
  await expect(panel.locator(".marketing-hero__stat-value")).toHaveCount(3);
  await expect(panel.getByText("96.8%")).toBeVisible();
  await expect(panel.getByText("99.6%")).toBeVisible();
  await expect(panel.getByText("12 min")).toBeVisible();
});

async function readThemeAssets(page) {
  return page.evaluate(() => {
    const hero = document.querySelector(".img-swap img");
    return {
      documentTheme: document.documentElement.getAttribute("data-theme"),
      headerLogo: document.querySelector(".site-header__logo").getAttribute("src"),
      heroSources: Array.from(document.querySelectorAll(".img-swap source"), (source) => source.getAttribute("srcset")),
      heroSrc: hero.getAttribute("src"),
      heroBoxRatio: Number((hero.getBoundingClientRect().width / hero.getBoundingClientRect().height).toFixed(3)),
    };
  });
}

const LIGHT_THEME_ASSETS = {
  headerLogo: "/assets/logos/logo-black.svg",
  heroSources: ["/assets/img/hero/hero-light.avif", "/assets/img/hero/hero-light.webp"],
  heroSrc: "/assets/img/hero/hero-light.jpg",
};

const DARK_THEME_ASSETS = {
  headerLogo: "/assets/logos/logo-white.svg",
  heroSources: ["/assets/img/hero/hero-dark.avif", "/assets/img/hero/hero-dark.webp"],
  heroSrc: "/assets/img/hero/hero-dark.jpg",
};

// The maintained documents ship the light logo and hero URLs in their markup, so
// every dark render depends on the runtime applying the persisted theme to those
// assets. This covers the first render, where nothing has toggled yet.
test("a persisted dark theme reaches the logo and hero on first render and follows every later toggle", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("fleet-theme", JSON.stringify("dark"));
  });
  await page.goto("/");

  const themeToggle = page.locator("#themeToggleLanding");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // No interaction has happened yet: the persisted theme alone has to own the assets.
  expect(await readThemeAssets(page)).toEqual({
    documentTheme: "dark",
    heroBoxRatio: 1.6,
    ...DARK_THEME_ASSETS,
  });

  await themeToggle.click();
  expect(await readThemeAssets(page)).toEqual({
    documentTheme: "light",
    heroBoxRatio: 1.6,
    ...LIGHT_THEME_ASSETS,
  });

  await themeToggle.click();
  expect(await readThemeAssets(page)).toEqual({
    documentTheme: "dark",
    heroBoxRatio: 1.6,
    ...DARK_THEME_ASSETS,
  });
});

// The rendered box has to come from the declared ratio rather than from whichever
// resource the current theme loaded, so both generated hero variants are pinned to
// the intrinsic width the maintained assets ship with.
test("the hero box keeps one aspect ratio across both theme variants", async ({ page }) => {
  await openFresh(page, "/");

  const hero = page.locator(".img-swap img");
  // The layout box, which the hero's entrance animation does not scale.
  const layoutBox = () => hero.evaluate((image) => [image.offsetWidth, image.offsetHeight]);

  await expect(hero).toHaveJSProperty("naturalWidth", 1440);
  const lightBox = await layoutBox();

  await page.locator("#themeToggleLanding").click();
  await expect(hero).toHaveJSProperty("naturalWidth", 1440);
  const darkBox = await layoutBox();

  expect(darkBox).toEqual(lightBox);
});
