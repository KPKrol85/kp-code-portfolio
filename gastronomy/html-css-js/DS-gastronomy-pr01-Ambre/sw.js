const CACHE_VERSION = "v1.8";

const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const RUNTIME_IMG_CACHE = `runtime-img-${CACHE_VERSION}`;

const OFFLINE_PAGE = "/offline.html";
const OFFLINE_IMAGE = "/assets/img/offline-image.svg";

const PRECACHE = [
  "/",
  "/index.html",
  "/menu.html",
  "/galeria.html",
  "/cookies.html",
  "/polityka-prywatnosci.html",
  "/regulamin.html",
  "/404.html",
  "/manifest.webmanifest",
  "/css/style.css",
  "/js/script.js",
  "/js/sw-register.js",
  "/js/pwa-install.js",
  "/assets/icons/favicons/favicon-96x96.png",
  "/assets/icons/favicons/web-app-manifest-192x192.png",
  "/assets/icons/favicons/web-app-manifest-512x512.png",
  "/assets/icons/favicons/apple-touch-icon.png",
  "/assets/icons/favicons/fav-icon-1024.png",
  "/assets/icons/shortcuts/offer-96.png",
  "/assets/icons/shortcuts/contact-96.png",
  "/assets/icons/shortcuts/legal-96.png",
  OFFLINE_PAGE,
  OFFLINE_IMAGE,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      await cache.addAll(PRECACHE);
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if ("navigationPreload" in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {}
      }
      const keep = new Set([APP_SHELL_CACHE, RUNTIME_IMG_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));
    })(),
  );
  self.clients.claim();
});

async function putSafe(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch {}
  return response;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  const acceptsHtml = req.headers.get("accept")?.includes("text/html");
  if (req.mode === "navigate" || acceptsHtml) {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          const res = preload || (await fetch(req));
          if (res && res.ok) {
            await putSafe(APP_SHELL_CACHE, req, res);
          }
          return res;
        } catch {
          const cached = await caches.match(req);
          return cached || caches.match(OFFLINE_PAGE);
        }
      })(),
    );
    return;
  }

  if (req.destination === "style" || req.destination === "script" || req.destination === "worker") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            return putSafe(APP_SHELL_CACHE, req, res);
          }
          return res;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          return Response.error();
        }
      })(),
    );
    return;
  }

  if (req.destination === "image") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            return putSafe(RUNTIME_IMG_CACHE, req, res);
          }
          return res;
        } catch {
          return caches.match(OFFLINE_IMAGE);
        }
      })(),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event?.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
