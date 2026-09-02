const CACHE_PREFIX = "lauren-english-v";
const CACHE_REVISION = "1.0.0-68938c7ba083";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_REVISION}`;
const OFFLINE_PATH = "/offline.html";
const PRECACHE_PATHS = [
  "/index.html",
  "/uslugi.html",
  "/pakiety.html",
  "/materialy.html",
  "/postepy.html",
  "/kontakt.html",
  "/offline.html",
  "/css/style.css",
  "/css/tokens/tokens.css",
  "/css/base/base.css",
  "/css/base/typography.css",
  "/css/utilities/utilities.css",
  "/css/components/eyebrow.css",
  "/css/components/cta-panel.css",
  "/css/components/project-disclosure.css",
  "/css/components/buttons.css",
  "/css/components/navigation.css",
  "/css/components/cards.css",
  "/css/components/badges.css",
  "/css/components/lists.css",
  "/css/components/accordion.css",
  "/css/components/forms.css",
  "/css/components/tabs.css",
  "/css/sections/hero.css",
  "/css/sections/how.css",
  "/css/sections/services.css",
  "/css/sections/pricing.css",
  "/css/sections/resources.css",
  "/css/sections/testimonials.css",
  "/css/sections/about.css",
  "/css/sections/contact.css",
  "/css/sections/footer.css",
  "/css/sections/offline.css",
  "/css/sections/reveal.css",
  "/css/pages/pages.css",
  "/css/pages/legal.css",
  "/js/main.js",
  "/js/modules/reveal.js",
  "/js/modules/headerShrink.js",
  "/js/modules/mobileNav.js",
  "/js/modules/scrollSpy.js",
  "/js/modules/accordion.js",
  "/js/modules/materialsCatalog.js",
  "/js/modules/anchorFocus.js",
  "/js/modules/projectDisclosure.js",
  "/js/pages/progress-page.js",
  "/js/state/browserStorage.js",
  "/js/data/materials.js",
  "/js/data/materialAccess.js",
  "/js/data/materialFilters.js",
  "/js/data/packages.js",
  "/js/data/progress.js",
  "/js/state/storage.js",
  "/assets/fonts/inter-400.woff2",
  "/assets/fonts/inter-latin-ext.woff2",
  "/assets/fonts/inter-600.woff2",
  "/assets/fonts/inter-700.woff2",
  "/assets/fonts/literata-700.woff2",
  "/assets/favicon/web-app-manifest-192x192.png",
  "/assets/favicon/web-app-manifest-512x512.png",
  "/assets/pwa/shortcuts/packages-192.png",
  "/assets/pwa/shortcuts/materials-192.png",
  "/assets/pwa/shortcuts/progress-192.png",
  "/assets/img/logo/logo.svg",
  "/assets/icons/sun.svg",
  "/assets/icons/moon.svg",
  "/assets/img/hero/hero-01-540.jpg",
  "/assets/img/hero/hero-01-720.jpg",
  "/assets/img/hero/hero-01-1080.jpg",
  "/assets/img/hero/hero-01-540.avif",
  "/assets/img/hero/hero-01-720.avif",
  "/assets/img/hero/hero-01-1080.avif",
  "/assets/img/hero/hero-01-540.webp",
  "/assets/img/hero/hero-01-720.webp",
  "/assets/img/hero/hero-01-1080.webp",
  "/assets/img/hero/hero-08-540.jpg",
  "/assets/img/hero/hero-08-720.jpg",
  "/assets/img/hero/hero-08-1080.jpg",
  "/assets/img/hero/hero-08-540.avif",
  "/assets/img/hero/hero-08-720.avif",
  "/assets/img/hero/hero-08-1080.avif",
  "/assets/img/hero/hero-08-540.webp",
  "/assets/img/hero/hero-08-720.webp",
  "/assets/img/hero/hero-08-1080.webp",
  "/assets/img/about/lauren.jpg",
  "/assets/img/about/lauren.avif",
  "/assets/img/about/lauren.webp",
  "/site.webmanifest",
];
const PRIMARY_DOCUMENT_PATHS = [
  "/index.html",
  "/uslugi.html",
  "/pakiety.html",
  "/materialy.html",
  "/postepy.html",
  "/kontakt.html",
];

const primaryDocuments = new Set(PRIMARY_DOCUMENT_PATHS);
const staticPrecachePaths = new Set(
  PRECACHE_PATHS.filter(
    (path) => path !== OFFLINE_PATH && !primaryDocuments.has(path),
  ),
);

const normalizePathname = (pathname) =>
  pathname === "/" ? "/index.html" : pathname;

const getRequestUrl = (request) => {
  try {
    return new URL(request.url);
  } catch {
    return null;
  }
};

const isIntendedSameOriginGet = (request) => {
  const url = getRequestUrl(request);
  return (
    request.method === "GET" &&
    url !== null &&
    ["http:", "https:"].includes(url.protocol) &&
    url.origin === self.location.origin
  );
};

const isCacheableResponse = (request, response) =>
  isIntendedSameOriginGet(request) &&
  response instanceof Response &&
  response.ok &&
  response.status === 200 &&
  response.type === "basic" &&
  !response.redirected &&
  !response.headers.has("Content-Range");

const currentCache = () => caches.open(CACHE_NAME);

const handleNavigation = async (request) => {
  const requestUrl = getRequestUrl(request);
  const normalizedPath = normalizePathname(requestUrl.pathname);
  const isPrimaryDocument = primaryDocuments.has(normalizedPath);

  try {
    const response = await fetch(request);
    const isHtml = response.headers
      .get("Content-Type")
      ?.toLowerCase()
      .includes("text/html");

    if (isPrimaryDocument && isHtml && isCacheableResponse(request, response)) {
      const cache = await currentCache();
      await cache.put(normalizedPath, response.clone());
    }

    return response;
  } catch {
    const cache = await currentCache();
    const cachedPrimary = isPrimaryDocument
      ? await cache.match(normalizedPath)
      : null;
    return (
      cachedPrimary ??
      (await cache.match(OFFLINE_PATH)) ??
      new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
};

const handleStaticAsset = async (request, normalizedPath) => {
  const cache = await currentCache();
  const cached = await cache.match(normalizedPath);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableResponse(request, response)) {
    await cache.put(normalizedPath, response.clone());
  }
  return response;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await currentCache();
        await cache.addAll(PRECACHE_PATHS);
        await self.skipWaiting();
      } catch (error) {
        await caches.delete(CACHE_NAME);
        throw error;
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME,
          )
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isIntendedSameOriginGet(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  const requestUrl = getRequestUrl(request);
  const normalizedPath = normalizePathname(requestUrl.pathname);
  if (staticPrecachePaths.has(normalizedPath)) {
    event.respondWith(handleStaticAsset(request, normalizedPath));
  }
});
