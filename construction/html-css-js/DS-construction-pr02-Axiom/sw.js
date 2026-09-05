// Generated file - do not edit.
// Source: sw.template.js
// Generator: tools/sw/build-sw.mjs (npm run build:sw:local)
// Profile: local - repository root (npm run serve)

const REVISION = "5aeb3c3b22b4b154";
const CACHE_PREFIX = "axiom-static-";
const CACHE_NAME = `${CACHE_PREFIX}${REVISION}`;
const HTML_CACHE_PREFIX = "html-pages-";
const HTML_CACHE_NAME = `${HTML_CACHE_PREFIX}${REVISION}`;
const ASSETS = ["/","/offline.html","/css/main.css","/js/main.js","/js/offline.js","/js/theme-init.js","/manifest.webmanifest","/assets/img/favicon/favicon.svg","/assets/img/favicon/favicon-96x96.png","/assets/img/favicon/web-app-manifest-192x192.png","/assets/img/favicon/web-app-manifest-512x512.png","/assets/img/favicon/web-app-manifest-1024x1024.png","/assets/img/favicon/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .concat(keys.filter((key) => key.startsWith(HTML_CACHE_PREFIX) && key !== HTML_CACHE_NAME))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const dest = req.destination;
  if (dest === "document" && req.method === "GET" && new URL(req.url).origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(HTML_CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("./offline.html")) || (await caches.match("./index.html")))
    );
    return;
  }
  if (dest === "style" || dest === "script") {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const fetchPromise = fetch(req)
            .then((net) => {
              if (net && net.status === 200) cache.put(req, net.clone());
              return net;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }
  if (dest === "image") {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req)
            .then((net) => {
              if (net && net.status === 200) cache.put(req, net.clone());
              return net;
            })
            .catch(() => cached);
        })
      )
    );
    return;
  }
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
