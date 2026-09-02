const REVISION = "__SW_REVISION__";
const CACHE_PREFIX = "axiom-static-";
const CACHE_NAME = `${CACHE_PREFIX}${REVISION}`;
const HTML_CACHE_PREFIX = "html-pages-";
const HTML_CACHE_NAME = `${HTML_CACHE_PREFIX}${REVISION}`;
const ASSETS = __PRECACHE_ASSETS__;

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
