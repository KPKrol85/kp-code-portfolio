// The single namespace for every cache this worker owns: the current cache is
// named from it and activation retires the older ones by the same prefix.
const CACHE_PREFIX = "fleetops-";
// The cache identity is build data, never maintained configuration, exactly like
// the precache content below it: `vite build` replaces the placeholder with a
// revision derived from the runtime asset URLs the same build emitted (see
// `fleetopsServiceWorkerPrecache` in `vite.config.js`). A build whose precached
// assets changed therefore installs into a new cache and the previous build's
// hashed entries are deleted on activation, with no version to advance by hand.
// The maintained source keeps the `dev` revision, which no deployed client ever
// sees: the worker is registered in production builds only.
const CACHE_NAME = CACHE_PREFIX + (/* __FLEETOPS_CACHE_REVISION__ */ "dev");

const APP_SHELL_URLS = ["/", "/index.html"];
const PUBLIC_ROUTE_URLS = [
  "/product/",
  "/features/",
  "/pricing/",
  "/about/",
  "/contact/",
  "/security/",
  "/careers/",
  "/privacy/",
  "/terms/",
  "/cookies/",
];
// Branded fallback for a navigation that genuinely failed. It is deliberately not a
// `PUBLIC_ROUTE_URLS` entry: it is PWA infrastructure, it is never substituted for a
// requested route that is cached, and it is never used to answer a fulfilled response.
const OFFLINE_FALLBACK_URL = "/offline.html";

// Hashed stylesheet and script assets the precached documents need to render styled
// and interactive on a first offline visit. The list is build data, never maintained
// configuration: `vite build` replaces the placeholder below with the URLs the same
// build actually emitted (see `fleetopsServiceWorkerPrecache` in `vite.config.js`), so
// no content hash is ever written by hand and a generated URL cannot go stale. The
// maintained source keeps the list empty, which is also what the development server
// serves; the worker is registered in production builds only.
// `OFFLINE_FALLBACK_URL` deliberately does not depend on any of these assets.
const RUNTIME_ASSET_URLS = /* __FLEETOPS_RUNTIME_ASSETS__ */ [];

const PRECACHE_URLS = Array.from(
  new Set([...APP_SHELL_URLS, ...PUBLIC_ROUTE_URLS, OFFLINE_FALLBACK_URL, ...RUNTIME_ASSET_URLS])
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

function isStaticAsset(pathname) {
  if (pathname.startsWith("/assets/")) return true;

  const lower = pathname.toLowerCase();
  return lower.endsWith(".css") || lower.endsWith(".js") || lower.endsWith(".png") || lower.endsWith(".svg") || lower.endsWith(".ico") || lower.endsWith(".webp") || lower.endsWith(".woff2");
}

function normalizePublicPath(pathname) {
  if (pathname === "/index.html") return "/";
  if (PUBLIC_ROUTE_URLS.includes(pathname)) return pathname;

  const trailingSlashPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (PUBLIC_ROUTE_URLS.includes(trailingSlashPath)) return trailingSlashPath;

  return pathname;
}

function isAppShellPath(pathname) {
  return pathname === "/" || pathname === "/index.html";
}

function isKnownPublicRoute(pathname) {
  return isAppShellPath(pathname) || PUBLIC_ROUTE_URLS.includes(normalizePublicPath(pathname));
}

function cacheNavigationResponse(cache, request, response) {
  const url = new URL(request.url);

  if (!response || !response.ok || !isKnownPublicRoute(url.pathname)) {
    return Promise.resolve();
  }

  const cachePath = normalizePublicPath(url.pathname);
  const writes = [cache.put(cachePath, response.clone())];

  if (isAppShellPath(url.pathname) && cachePath !== "/index.html") {
    writes.push(cache.put("/index.html", response.clone()));
  }

  return Promise.all(writes);
}

function matchNavigationCache(cache, request) {
  const url = new URL(request.url);
  const cachePath = normalizePublicPath(url.pathname);

  return cache
    .match(request)
    .then((cached) => cached || cache.match(cachePath))
    .then((cached) => {
      if (cached || !isAppShellPath(url.pathname)) return cached;
      return cache.match("/").then((cachedShell) => cachedShell || cache.match("/index.html"));
    });
}

// A fulfilled fetch is a completed network response, whatever its status: a 404,
// a redirect or a 5xx must reach the browser unchanged. Only a rejected fetch is
// an actual connectivity failure, so only that case falls back to the cache.
// `cacheNavigationResponse` decides on its own whether the response may be stored.
//
// Recovery order after a rejected request: the document actually requested, then the
// offline fallback, then a network error if even the precache is unavailable. The
// fallback body answers the original request, so the requested URL is preserved and
// no redirect is performed.
function networkFirstNavigation(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    fetch(request)
      .then((response) => cacheNavigationResponse(cache, request, response).then(() => response))
      .catch(() =>
        matchNavigationCache(cache, request)
          .then((cached) => cached || cache.match(OFFLINE_FALLBACK_URL))
          .then((response) => response || Response.error())
      )
  );
}

function staleWhileRevalidate(request) {
  const url = new URL(request.url);
  const cacheKey = url.search === "" && RUNTIME_ASSET_URLS.includes(url.pathname) ? url.pathname : request;

  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(cacheKey).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(cacheKey, response.clone());
            return response;
          }
          return cached || response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
}
