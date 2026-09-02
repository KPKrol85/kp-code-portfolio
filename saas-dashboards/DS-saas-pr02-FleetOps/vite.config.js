import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * FleetOps is a multi-page static site: every public route is a real HTML
 * document, and the demo application is hash-routed inside `index.html`.
 * Each maintained document below is a Vite/Rollup build entry so the produced
 * `dist/` mirrors the deployed URL structure exactly.
 */
const htmlEntries = [
  "index.html",
  "404.html",
  // Offline fallback for failed navigations: a maintained source document rather
  // than a `public/` passthrough, so it is built like every other page. The service
  // worker precaches the emitted `dist/offline.html`.
  "offline.html",
  "product/index.html",
  "features/index.html",
  "pricing/index.html",
  "about/index.html",
  "contact/index.html",
  "security/index.html",
  "careers/index.html",
  "privacy/index.html",
  "terms/index.html",
  "cookies/index.html",
];

const toEntryName = (entry) => entry.replace(/\/index\.html$/, "").replace(/\.html$/, "");

const input = Object.fromEntries(
  htmlEntries.map((entry) => [toEntryName(entry), resolve(__dirname, entry)])
);

// Documents whose runtime graph the service worker precaches. `404.html` is the
// online host error document and is not precached, and `offline.html` is
// deliberately self-contained PWA infrastructure, so neither contributes assets.
const precachedDocuments = htmlEntries.filter(
  (entry) => entry !== "404.html" && entry !== "offline.html"
);

const SW_FILE_NAME = "sw.js";
const SW_RUNTIME_ASSETS_PLACEHOLDER = "/* __FLEETOPS_RUNTIME_ASSETS__ */ []";
const SW_CACHE_REVISION_PLACEHOLDER = '/* __FLEETOPS_CACHE_REVISION__ */ "dev"';
const SW_CACHE_REVISION_PATTERN = /^[0-9a-f]{12}$/;

const ASSET_TAG = /<(link|script)\b[^>]*>/gi;
const REL_ATTRIBUTE = /\brel\s*=\s*["']([^"']*)["']/i;
const URL_ATTRIBUTE = /\b(?:href|src)\s*=\s*["']([^"']*)["']/i;

// The runtime resources of an emitted document: its stylesheets, its module scripts
// and the `modulepreload` links Vite injects for chunks the entry statically needs.
// Icons, fonts, images and manifest links are not runtime resources and stay out.
function collectDocumentAssetUrls(html) {
  const urls = [];

  for (const [tag, tagName] of html.matchAll(ASSET_TAG)) {
    const url = tag.match(URL_ATTRIBUTE)?.[1];
    if (!url) continue;

    if (tagName.toLowerCase() === "script") {
      urls.push(url);
      continue;
    }

    const rel = (tag.match(REL_ATTRIBUTE)?.[1] || "").toLowerCase();
    if (rel === "stylesheet" || rel === "modulepreload") urls.push(url);
  }

  return urls;
}

// The cache identity of one build, derived from the runtime asset URLs that build
// emitted. Those URLs carry Vite's content hashes, so the revision changes exactly
// when the precached asset set does, and two equivalent builds hash the same sorted
// list to the same value. Nothing here reads the clock, the filesystem or a random
// source, so the result is reproducible rather than merely unique. `public/sw.js`
// owns the `fleetops-` namespace the revision is appended to.
function cacheRevisionFor(sortedRuntimeAssetUrls) {
  return createHash("sha256").update(sortedRuntimeAssetUrls.join("\n")).digest("hex").slice(0, 12);
}

/**
 * Ties the production service-worker precache and cache identity to the runtime
 * assets this build actually emitted. `public/sw.js` stays the single maintained
 * worker source and owns both contracts; it carries two placeholders, replaced
 * here with the hashed URLs read out of the same bundle that produced those hashes
 * and with the revision derived from them. The emitted `dist/sw.js` is therefore a
 * pure build artifact, content hashing stays enabled, and neither a generated
 * filename nor a cache version is maintained by hand.
 */
function fleetopsServiceWorkerPrecache() {
  return {
    name: "fleetops-service-worker-precache",
    apply: "build",
    generateBundle: {
      // After every emitting hook, so the finished HTML documents are in the bundle.
      order: "post",
      handler(_options, bundle) {
        // Only files this build emitted may enter the precache: `cache.addAll()` is
        // atomic, so one URL without a file behind it would fail the whole install.
        const emitted = new Set(
          Object.keys(bundle)
            .filter((fileName) => fileName.endsWith(".css") || fileName.endsWith(".js"))
            .map((fileName) => `/${fileName}`)
        );

        const runtimeAssetUrls = new Set();
        const chunksByUrl = new Map(
          Object.values(bundle)
            .filter((output) => output.type === "chunk")
            .map((chunk) => [`/${chunk.fileName}`, chunk])
        );

        const addRuntimeAssetGraph = (url) => {
          if (!emitted.has(url) || runtimeAssetUrls.has(url)) return;

          runtimeAssetUrls.add(url);

          const chunk = chunksByUrl.get(url);
          if (!chunk) return;

          const dependentFileNames = [
            ...chunk.imports,
            ...chunk.dynamicImports,
            ...(chunk.viteMetadata?.importedCss || []),
          ];

          for (const fileName of dependentFileNames) {
            addRuntimeAssetGraph(`/${fileName}`);
          }
        };

        for (const fileName of precachedDocuments) {
          const document = bundle[fileName];
          if (!document || document.type !== "asset") {
            this.error(`The build did not emit the precached document "${fileName}".`);
          }

          for (const url of collectDocumentAssetUrls(String(document.source))) {
            addRuntimeAssetGraph(url);
          }
        }

        if (runtimeAssetUrls.size === 0) {
          this.error("No generated runtime asset was found for the service-worker precache.");
        }

        const source = readFileSync(resolve(__dirname, "public", SW_FILE_NAME), "utf8");
        for (const placeholder of [SW_RUNTIME_ASSETS_PLACEHOLDER, SW_CACHE_REVISION_PLACEHOLDER]) {
          if (!source.includes(placeholder)) {
            this.error(`"public/${SW_FILE_NAME}" no longer carries the \`${placeholder}\` build placeholder.`);
          }
        }

        // Sorted so two equivalent builds produce byte-identical output, and so the
        // cache revision depends on the asset set rather than on bundle iteration order.
        const sortedRuntimeAssetUrls = [...runtimeAssetUrls].sort();
        const cacheRevision = cacheRevisionFor(sortedRuntimeAssetUrls);
        if (!SW_CACHE_REVISION_PATTERN.test(cacheRevision)) {
          this.error(`The generated service-worker cache revision "${cacheRevision}" is not a 12-character hexadecimal digest.`);
        }

        this.emitFile({
          type: "asset",
          fileName: SW_FILE_NAME,
          source: source
            .replace(SW_RUNTIME_ASSETS_PLACEHOLDER, JSON.stringify(sortedRuntimeAssetUrls))
            .replace(SW_CACHE_REVISION_PLACEHOLDER, JSON.stringify(cacheRevision)),
        });
      },
    },
  };
}

export default defineConfig({
  // FleetOps is deployed at the domain root; asset URLs stay root-relative.
  base: "/",
  // Multi-page app: no SPA history fallback, each document is served directly.
  appType: "mpa",
  // Production-static files (assets, service worker, hosting config, SEO files)
  // are copied verbatim and keep their exact production URLs.
  // `assets/img-src/` stays outside this directory: it is an image source input,
  // not production output.
  publicDir: "public",
  // Rewrites the `public/sw.js` copy in `dist/` with this build's real asset URLs
  // and the cache revision derived from them.
  plugins: [fleetopsServiceWorkerPrecache()],
  server: {
    host: "127.0.0.1",
    port: 8181,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8182,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: { input },
  },
});
