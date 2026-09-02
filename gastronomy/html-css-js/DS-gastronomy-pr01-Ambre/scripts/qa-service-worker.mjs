import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const rootDir = process.cwd();
const host = "127.0.0.1";
const harnessPath = "/__sw-cache-ownership-test__.html";

const cacheNames = {
  currentAppShell: "ambre-app-shell-v1.8",
  currentRuntimeImages: "ambre-runtime-img-v1.8",
  legacyAppShell: "app-shell-v1.8",
  legacyRuntimeImages: "runtime-img-v1.8",
  obsoleteAppShell: "ambre-app-shell-v1.7",
  obsoleteRuntimeImages: "ambre-runtime-img-v1.7",
  unknownGeneric: "app-shell-v1.7",
  unrelatedSentinel: "audit-unrelated-cache"
};

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"]
]);

const createStaticServer = () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${host}`);

    if (url.pathname === harnessPath) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end("<!doctype html><html lang=\"en\"><title>Service Worker cache test</title></html>");
      return;
    }

    const requestedPath = decodeURIComponent(url.pathname);
    const normalizedPath = requestedPath === "/" ? "/index.html" : requestedPath;
    const filePath = path.resolve(rootDir, normalizedPath.replace(/^\/+/, ""));
    const rootPrefix = `${rootDir}${path.sep}`;

    if (!filePath.startsWith(rootPrefix) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolve(server));
  });
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const run = async () => {
  console.log("QA SERVICE WORKER: starting isolated activation test...");
  const server = await createStaticServer();
  let browser;
  let context;

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object", "The test server must expose a local port");

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    const page = await context.newPage();
    const baseUrl = `http://${host}:${address.port}`;

    await page.goto(`${baseUrl}${harnessPath}`, { waitUntil: "domcontentloaded" });

    await page.evaluate(async (names) => {
      for (const name of Object.values(names)) {
        const cache = await caches.open(name);
        const markerPath = `/__cache-marker__/${encodeURIComponent(name)}`;
        await cache.put(markerPath, new Response(name));
      }
    }, cacheNames);

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const worker = registration.installing || registration.waiting || registration.active;

      if (!worker) throw new Error("Service Worker registration did not expose a worker");

      if (worker.state !== "activated") {
        await new Promise((resolve, reject) => {
          let timeoutId;
          const finish = (callback) => {
            clearTimeout(timeoutId);
            worker.removeEventListener("statechange", handleStateChange);
            callback();
          };
          const handleStateChange = () => {
            if (worker.state === "activated") finish(resolve);
            if (worker.state === "redundant") {
              finish(() => reject(new Error("Service Worker became redundant")));
            }
          };

          timeoutId = setTimeout(
            () => finish(() => reject(new Error(`Service Worker activation timed out in state ${worker.state}`))),
            15000,
          );
          worker.addEventListener("statechange", handleStateChange);
          handleStateChange();
        });
      }

      await navigator.serviceWorker.ready;
    });

    const state = await page.evaluate(async (names) => {
      const survivingNames = [
        names.currentAppShell,
        names.currentRuntimeImages,
        names.unknownGeneric,
        names.unrelatedSentinel
      ];
      const markers = {};

      for (const name of survivingNames) {
        const cache = await caches.open(name);
        const markerPath = `/__cache-marker__/${encodeURIComponent(name)}`;
        const response = await cache.match(markerPath);
        markers[name] = response ? await response.text() : null;
      }

      const appShell = await caches.open(names.currentAppShell);

      return {
        keys: (await caches.keys()).sort(),
        markers,
        offlinePagePrecached: Boolean(await appShell.match("/offline.html"))
      };
    }, cacheNames);

    const expectedKeys = [
      cacheNames.currentAppShell,
      cacheNames.currentRuntimeImages,
      cacheNames.unknownGeneric,
      cacheNames.unrelatedSentinel
    ].sort();

    assert.deepEqual(state.keys, expectedKeys, "Activation must delete only obsolete Ambre-owned caches");
    assert.equal(state.offlinePagePrecached, true, "The current app-shell cache must remain usable");

    for (const name of expectedKeys) {
      assert.equal(state.markers[name], name, `Activation must preserve cache contents for ${name}`);
    }

    console.log("QA SERVICE WORKER: PASS");
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    await closeServer(server);
  }
};

run().catch((error) => {
  console.error("QA SERVICE WORKER: FAIL");
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
