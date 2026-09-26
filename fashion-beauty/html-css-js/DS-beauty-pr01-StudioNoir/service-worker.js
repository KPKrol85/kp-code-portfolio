const CACHE_NAME = "studio-noir-v1";
const ASSETS = [
  "/studio-noir/",
  "/studio-noir/index.html",
  "/studio-noir/offline.html",
  "/studio-noir/css/style.css",
  "/studio-noir/css/style.min.css",
  "/studio-noir/css/tokens.css",
  "/studio-noir/css/base.css",
  "/studio-noir/css/layout.css",
  "/studio-noir/css/components.css",
  "/studio-noir/css/sections.css",
  "/studio-noir/js/main.js",
  "/studio-noir/js/reveal.js",
  "/studio-noir/js/header.js",
  "/studio-noir/js/nav.js",
  "/studio-noir/js/lightbox.js",
  "/studio-noir/js/booking.js",
  "/studio-noir/js/theme.js",
  "/studio-noir/assets/img/hero-editorial.svg",
  "/studio-noir/assets/icons/favicon.svg"
];

const OFFLINE_PAGE = "/studio-noir/offline.html";

function isDocumentRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

async function handleDocumentRequest(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const offlinePage = await caches.match(OFFLINE_PAGE);
    if (offlinePage) return offlinePage;

    return Response.error();
  }
}

async function handleAssetRequest(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    return Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  if (isDocumentRequest(request)) {
    event.respondWith(handleDocumentRequest(request));
    return;
  }

  event.respondWith(handleAssetRequest(request));
});
