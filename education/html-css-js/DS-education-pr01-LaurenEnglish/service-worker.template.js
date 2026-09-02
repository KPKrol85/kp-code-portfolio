const CACHE_PREFIX = "__CACHE_PREFIX__";
const CACHE_REVISION = "__CACHE_REVISION__";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_REVISION}`;
const OFFLINE_PATH = "__OFFLINE_PATH__";
const PRECACHE_PATHS = "__PRECACHE_PATHS__";
const PRIMARY_DOCUMENT_PATHS = "__PRIMARY_DOCUMENT_PATHS__";

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
