#!/usr/bin/env node

/* Service Worker lifecycle gate (AUDIT P2-01).

   Proves the one contract the finding is about: the promise each lifecycle
   handler hands to event.waitUntil() covers the cache work *and* the
   worker/client transition that follows it, so the browser is required to keep
   install alive until skipWaiting() has settled and activate alive until
   clients.claim() has settled.

   Two stages, because the contract and its effect are observable in different
   places and only one of them needs a browser:

   - the contract stage evaluates the canonical sw.js — the real file, with the
     production build's manifest block injected — against stubbed caches/self
     objects whose promises this script resolves by hand. Holding the precache
     open and watching what has and has not happened yet is the only way to see
     that the transition is inside the lifecycle promise rather than beside it;
     a worker that calls skipWaiting()/claim() outside waitUntil() still works
     in the happy path, so behaviour alone cannot fail on the old shape.
   - the effect stage drives the same worker through a real install/activate
     and an update in headless Chromium, against a small in-memory fixture
     origin, and asserts what AUDIT asks for: precache stored, superseded
     caches gone, foreign caches untouched, and an already-open client taken
     over — without a reload — by the activated worker.

   The harness deliberately mirrors scripts/qa-functional.mjs rather than
   adding a test framework: the already-declared `playwright` package, a plain
   Node script, an in-process server on an ephemeral port, one PASS/FAIL line
   per scenario and a non-zero exit code when any assertion fails. The
   assertion helpers are the functional suite's own. Nothing reaches the
   network and nothing is written to disk.

   Usage: node scripts/qa-sw-lifecycle.mjs [--only=<substring of scenario name>] */

import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assert, assertDeepEqual, assertEqual } from "./functional/harness.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/* Mirrors scripts/generate-sw.js. That generator runs its own build on import,
   so the markers are restated here rather than imported. */
const MANIFEST_START = "/* build:sw-manifest:start */";
const MANIFEST_END = "/* build:sw-manifest:end */";

const APP_ID = "solidcraft";

/* The fixture origin's precache contract, in the generator's sorted order. */
const FIXTURE_ASSETS = [
  "/",
  "/app.css",
  "/app.js",
  "/index.html",
  "/offline.html",
];

const FOREIGN_CACHE = "other-app-v1";
const STALE_CACHE = `${APP_ID}-vstale`;

const canonicalSource = await fs.readFile(
  path.join(projectRoot, "sw.js"),
  "utf8",
);

/* ── worker source ──────────────────────────────────────────────────────── */

/* Rewrites the marked block exactly as the production build does, so every
   assertion below runs against canonical worker logic. */
function withManifest(version, assets) {
  const start = canonicalSource.indexOf(MANIFEST_START);
  const end = canonicalSource.indexOf(MANIFEST_END) + MANIFEST_END.length;

  assert(
    start !== -1 && end > start,
    "sw.js should carry exactly one generated manifest block",
  );

  const block = [
    MANIFEST_START,
    `const CACHE_VERSION = ${JSON.stringify(version)};`,
    "",
    `const ASSETS = ${JSON.stringify(assets)};`,
    MANIFEST_END,
  ].join("\n");

  return canonicalSource.slice(0, start) + block + canonicalSource.slice(end);
}

/* ── contract stage ─────────────────────────────────────────────────────── */

function createDeferred() {
  let settle;
  let fail;
  const promise = new Promise((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, resolve: settle, reject: fail };
}

/* Records how a promise has settled without awaiting it, so a scenario can
   assert that a lifecycle promise is still pending. */
function track(promise) {
  const state = { settled: false, rejected: false, reason: null };
  promise.then(
    () => {
      state.settled = true;
    },
    (error) => {
      state.settled = true;
      state.rejected = true;
      state.reason = error;
    },
  );
  return state;
}

/* A macrotask boundary drains the microtask queue, so every .then() the worker
   could still run has run by the time the next assertion executes. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/* Evaluates the worker source with `caches` and `self` supplied as stubs whose
   promises stay pending until this script resolves them. */
function loadWorker(source) {
  const log = {
    opened: [],
    precached: [],
    deleted: [],
    skipWaiting: 0,
    claim: 0,
  };

  const pending = {
    precache: createDeferred(),
    keys: createDeferred(),
    deletes: new Map(),
    skipWaiting: createDeferred(),
    claim: createDeferred(),
  };

  const cachesStub = {
    open(name) {
      log.opened.push(name);
      return Promise.resolve({
        addAll(urls) {
          log.precached.push([...urls]);
          return pending.precache.promise;
        },
        put: () => Promise.resolve(),
      });
    },
    keys: () => pending.keys.promise,
    delete(key) {
      log.deleted.push(key);
      const deferred = createDeferred();
      pending.deletes.set(key, deferred);
      return deferred.promise;
    },
    match: () => Promise.resolve(undefined),
  };

  const handlers = new Map();
  const selfStub = {
    location: { origin: "https://fixture.invalid" },
    addEventListener: (type, handler) => handlers.set(type, handler),
    skipWaiting() {
      log.skipWaiting += 1;
      return pending.skipWaiting.promise;
    },
    clients: {
      claim() {
        log.claim += 1;
        return pending.claim.promise;
      },
    },
  };

  /* eslint-disable-next-line no-new-func -- the worker body is repository
     source, evaluated here only to hand it instrumented globals. */
  new Function("self", "caches", source)(selfStub, cachesStub);

  return { handlers, log, pending };
}

/* Dispatches one lifecycle handler and returns the single promise it was
   required to hand to event.waitUntil(). */
function dispatch(handlers, type) {
  const handler = handlers.get(type);
  assert(handler, `sw.js should register a ${type} listener`);

  const waited = [];
  handler({ waitUntil: (promise) => waited.push(promise) });

  assertEqual(
    waited.length,
    1,
    `${type} should hand exactly one promise to event.waitUntil()`,
  );

  return { promise: waited[0], state: track(waited[0]) };
}

const contractScenarios = [
  {
    name: "install-lifecycle-covers-precache-and-skip-waiting",
    async run() {
      const version = "contract1";
      const { handlers, log, pending } = loadWorker(
        withManifest(version, FIXTURE_ASSETS),
      );

      const install = dispatch(handlers, "install");
      await flush();

      assertDeepEqual(
        log.opened,
        [`${APP_ID}-v${version}`],
        "install should open the versioned cache",
      );
      assertDeepEqual(
        log.precached,
        [FIXTURE_ASSETS],
        "install should precache the generated manifest",
      );
      assertEqual(
        log.skipWaiting,
        0,
        "skipWaiting() should not run before the precache settles",
      );
      assert(
        !install.state.settled,
        "the install lifecycle promise should stay pending while precaching",
      );

      pending.precache.resolve();
      await flush();

      assertEqual(
        log.skipWaiting,
        1,
        "install should call skipWaiting() once the precache is stored",
      );
      assert(
        !install.state.settled,
        "the install lifecycle promise should stay pending until skipWaiting() settles",
      );

      pending.skipWaiting.resolve();
      await flush();

      assert(
        install.state.settled && !install.state.rejected,
        `the install lifecycle promise should resolve once both complete${
          install.state.rejected
            ? ` — rejected with ${install.state.reason}`
            : ""
        }`,
      );
    },
  },
  {
    name: "activate-lifecycle-covers-cleanup-and-clients-claim",
    async run() {
      const version = "contract2";
      const current = `${APP_ID}-v${version}`;
      const superseded = `${APP_ID}-vcontract1`;

      const { handlers, log, pending } = loadWorker(
        withManifest(version, FIXTURE_ASSETS),
      );

      const activate = dispatch(handlers, "activate");
      await flush();

      assert(
        !activate.state.settled,
        "the activate lifecycle promise should stay pending while reading cache keys",
      );

      pending.keys.resolve([FOREIGN_CACHE, superseded, current]);
      await flush();

      assertDeepEqual(
        log.deleted,
        [superseded],
        "activate should delete superseded caches in this app's namespace only",
      );
      assertEqual(
        log.claim,
        0,
        "clients.claim() should not run before the cleanup settles",
      );
      assert(
        !activate.state.settled,
        "the activate lifecycle promise should stay pending while cleaning up",
      );

      pending.deletes.get(superseded).resolve(true);
      await flush();

      assertEqual(
        log.claim,
        1,
        "activate should claim clients once the cleanup is done",
      );
      assert(
        !activate.state.settled,
        "the activate lifecycle promise should stay pending until clients.claim() settles",
      );

      pending.claim.resolve();
      await flush();

      assert(
        activate.state.settled && !activate.state.rejected,
        `the activate lifecycle promise should resolve once both complete${
          activate.state.rejected
            ? ` — rejected with ${activate.state.reason}`
            : ""
        }`,
      );
    },
  },
  {
    name: "development-lifecycle-keeps-its-own-semantics",
    async run() {
      /* The canonical source as committed: CACHE_VERSION "dev", empty ASSETS. */
      const { handlers, log, pending } = loadWorker(canonicalSource);

      const install = dispatch(handlers, "install");
      await flush();

      assertDeepEqual(
        log.opened,
        [],
        "development install should not open a cache",
      );
      assertEqual(
        log.skipWaiting,
        1,
        "development install should still call skipWaiting()",
      );
      assert(
        !install.state.settled,
        "the development install promise should stay pending until skipWaiting() settles",
      );

      pending.skipWaiting.resolve();
      await flush();

      assert(
        install.state.settled && !install.state.rejected,
        "the development install promise should resolve once skipWaiting() settles",
      );

      const activate = dispatch(handlers, "activate");
      pending.keys.resolve([FOREIGN_CACHE, `${APP_ID}-vdev`, STALE_CACHE]);
      await flush();

      assertDeepEqual(
        log.deleted,
        [`${APP_ID}-vdev`, STALE_CACHE],
        "development activate should clear every cache in this app's namespace, its own included",
      );
      assertEqual(
        log.claim,
        0,
        "clients.claim() should not run before the cleanup settles",
      );

      for (const key of log.deleted) pending.deletes.get(key).resolve(true);
      await flush();

      assertEqual(log.claim, 1, "development activate should claim clients");
      assert(
        !activate.state.settled,
        "the development activate promise should stay pending until clients.claim() settles",
      );

      pending.claim.resolve();
      await flush();

      assert(
        activate.state.settled && !activate.state.rejected,
        "the development activate promise should resolve once clients.claim() settles",
      );
    },
  },
];

/* ── effect stage ───────────────────────────────────────────────────────── */

const FIXTURE_FILES = new Map([
  [
    "/index.html",
    {
      type: "text/html; charset=utf-8",
      body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SW lifecycle fixture</title></head><body><h1>SW lifecycle fixture</h1></body></html>',
    },
  ],
  [
    "/offline.html",
    {
      type: "text/html; charset=utf-8",
      body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Offline fixture</title></head><body>offline</body></html>',
    },
  ],
  ["/app.css", { type: "text/css; charset=utf-8", body: ":root{color:#000}" }],
  [
    "/app.js",
    { type: "text/javascript; charset=utf-8", body: "/* fixture asset */" },
  ],
]);

/* A minimal origin the worker can own: the fixture files above plus /sw.js,
   whose body this script swaps to simulate a deployed update. The real project
   pages are deliberately not served — this gate is about the worker, and the
   functional and a11y suites already drive the maintained markup. */
async function startFixtureServer(initialWorkerSource) {
  let workerSource = initialWorkerSource;

  const server = createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];

    if (url === "/sw.js") {
      res.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "Service-Worker-Allowed": "/",
      });
      res.end(workerSource);
      return;
    }

    const file = FIXTURE_FILES.get(url === "/" ? "/index.html" : url);

    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": file.type,
      "Cache-Control": "no-store",
    });
    res.end(file.body);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();

  return {
    origin: `http://127.0.0.1:${port}`,
    serveWorker: (source) => {
      workerSource = source;
    },
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

/* clients.claim() now runs inside the activate lifecycle promise, so a client
   becomes controlled while the worker is still "activating". Waiting for the
   settled state is what proves the whole lifecycle promise resolved. */
async function waitForActivated(page) {
  /* The registration is resolved once and parked on window: waitForFunction
     polls its predicate synchronously, so an async one would only ever be
     tested for the truthiness of the pending promise it returns. The parked
     object is the live per-scope registration and keeps reflecting updates. */
  await page.evaluate(async () => {
    window.__registration = await navigator.serviceWorker.getRegistration("/");
  });

  await page.waitForFunction(
    () => {
      const registration = window.__registration;
      return Boolean(
        registration &&
          !registration.installing &&
          !registration.waiting &&
          registration.active &&
          registration.active.state === "activated",
      );
    },
    null,
    { timeout: 20000 },
  );
}

async function readCacheState(page) {
  return page.evaluate(async () => {
    const keys = await caches.keys();
    const entries = {};

    for (const key of keys) {
      const cache = await caches.open(key);
      entries[key] = (await cache.keys())
        .map((request) => new URL(request.url).pathname)
        .sort();
    }

    return { keys: keys.slice().sort(), entries };
  });
}

const effectScenarios = [
  {
    name: "activated-worker-precaches-cleans-up-and-claims-open-client",
    async run({ browser }) {
      const first = "effect1";
      const second = "effect2";
      const firstCache = `${APP_ID}-v${first}`;
      const secondCache = `${APP_ID}-v${second}`;

      const server = await startFixtureServer(
        withManifest(first, FIXTURE_ASSETS),
      );

      const context = await browser.newContext({
        baseURL: server.origin,
        serviceWorkers: "allow",
      });

      try {
        const page = await context.newPage();
        await page.goto("/index.html", { waitUntil: "load" });

        /* Instrumented before registering: this client is open and
           uncontrolled, so only clients.claim() can put it under control. The
           token proves later that the same document is still loaded. */
        const token = await page.evaluate(() => {
          window.__clientToken = Math.random().toString(36).slice(2);
          window.__controllerChanges = 0;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            window.__controllerChanges += 1;
          });
          return window.__clientToken;
        });

        assertEqual(
          await page.evaluate(() => navigator.serviceWorker.controller),
          null,
          "the fixture page should start uncontrolled",
        );

        await page.evaluate(async () => {
          const registration = await navigator.serviceWorker.register(
            "/sw.js",
            { scope: "/" },
          );
          await navigator.serviceWorker.ready;
          return registration.scope;
        });

        await page.waitForFunction(
          () => Boolean(navigator.serviceWorker.controller),
          null,
          { timeout: 20000 },
        );

        assertEqual(
          await page.evaluate(() => window.__controllerChanges),
          1,
          "clients.claim() should take control of the already-open client",
        );

        await waitForActivated(page);

        const afterInstall = await readCacheState(page);

        assertDeepEqual(
          afterInstall.keys,
          [firstCache],
          "installation should leave exactly the versioned cache behind",
        );
        assertDeepEqual(
          afterInstall.entries[firstCache],
          [...FIXTURE_ASSETS].sort(),
          "the versioned cache should hold every precached URL",
        );

        /* One superseded cache in this app's namespace and one that belongs to
           another app: activation must remove the first and leave the second. */
        await page.evaluate(
          async ([stale, foreign]) => {
            for (const name of [stale, foreign]) {
              const cache = await caches.open(name);
              await cache.put("/app.css", new Response("stale"));
            }
          },
          [STALE_CACHE, FOREIGN_CACHE],
        );

        server.serveWorker(withManifest(second, FIXTURE_ASSETS));

        await page.evaluate(async () => {
          const registration =
            await navigator.serviceWorker.getRegistration("/");
          await registration.update();
        });

        await page.waitForFunction(
          () => window.__controllerChanges >= 2,
          null,
          { timeout: 20000 },
        );

        assertEqual(
          await page.evaluate(() => window.__clientToken),
          token,
          "the client should still be the same never-reloaded document",
        );

        await waitForActivated(page);

        const registration = await page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration("/");
          return {
            waiting: Boolean(reg.waiting),
            installing: Boolean(reg.installing),
            state: reg.active?.state ?? null,
          };
        });

        assertDeepEqual(
          registration,
          { waiting: false, installing: false, state: "activated" },
          "skipWaiting() should leave the updated worker activated with nothing waiting",
        );

        const afterUpdate = await readCacheState(page);

        assertDeepEqual(
          afterUpdate.keys,
          [FOREIGN_CACHE, secondCache].sort(),
          "activation should drop superseded solidcraft-v caches and keep foreign ones",
        );
        assertDeepEqual(
          afterUpdate.entries[secondCache],
          [...FIXTURE_ASSETS].sort(),
          "the updated versioned cache should hold every precached URL",
        );
      } finally {
        await context.close();
        await server.close();
      }
    },
  },
];

/* ── runner ─────────────────────────────────────────────────────────────── */

const allScenarios = [...contractScenarios, ...effectScenarios];

const only = readOnlyFilter(process.argv.slice(2));
const scenarios = only
  ? allScenarios.filter((scenario) => scenario.name.includes(only))
  : allScenarios;

if (scenarios.length === 0) {
  console.error(`FAIL qa:sw-lifecycle (no scenario matches "${only}")`);
  process.exit(1);
}

const needsBrowser = scenarios.some((scenario) =>
  effectScenarios.includes(scenario),
);

const browser = needsBrowser
  ? await (
      await loadDependency("playwright")
    ).chromium.launch({
      headless: true,
    })
  : null;

const failures = [];

try {
  for (const scenario of scenarios) {
    const startedAt = Date.now();

    try {
      await scenario.run({ browser });
      console.log(`PASS ${scenario.name} (${Date.now() - startedAt} ms)`);
    } catch (error) {
      const message = error?.message || String(error);
      failures.push({ name: scenario.name, message });
      console.error(`FAIL ${scenario.name} (${Date.now() - startedAt} ms)`);
      console.error(`  ${message.split("\n")[0]}`);
      if (error?.name !== "AssertionError" && error?.stack) {
        console.error(`  ${error.stack.split("\n").slice(1, 3).join("\n  ")}`);
      }
    }
  }
} finally {
  if (browser) await browser.close();
}

if (failures.length > 0) {
  console.error(
    `FAIL qa:sw-lifecycle (${failures.length} of ${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"} failed)`,
  );
  for (const failure of failures) {
    console.error(`- ${failure.name} | ${failure.message.split("\n")[0]}`);
  }
  process.exit(1);
}

console.log(
  `PASS qa:sw-lifecycle (${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"}, 0 failures)`,
);

function readOnlyFilter(argv) {
  const flag = argv.find((arg) => arg.startsWith("--only="));
  return flag ? flag.slice("--only=".length) : "";
}

async function loadDependency(name) {
  try {
    return await import(name);
  } catch {
    console.error(
      `Missing dependency: ${name}. Run "npm install" to install local QA tooling.`,
    );
    process.exit(1);
  }
}
