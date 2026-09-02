/* Produces dist/sw.js — the only Service Worker that reaches production.

   Canonical worker logic lives in sw.js at the repository root and is never
   edited here. This step rewrites the single marked block in that file from
   the finished dist/ tree, so the precache URL list is derived from files that
   actually shipped and the cache version is a fingerprint of their bytes. No
   maintainer has to keep a hand-written copy of the generated asset names in
   sync, and a forgotten version bump can no longer leave returning visitors on
   a stale unhashed style.min.css or script.min.js.

   It must run after scripts/build-dist.js and after "npm run build": the CSS
   and JS bundles it fingerprints do not exist until then, and the REQUIRED
   rules below fail the build loudly if it is invoked too early. */

const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { createLogger } = require("./utils/logger");

const logger = createLogger();

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const sourceSwPath = path.join(rootDir, "sw.js");
const outputSwPath = path.join(distDir, "sw.js");

const MANIFEST_START = "/* build:sw-manifest:start */";
const MANIFEST_END = "/* build:sw-manifest:end */";

/* index.html is precached under the manifest's start_url as well as under its
   own path, exactly as the hand-written list did. */
const START_URL = "/";
const START_URL_FILE = "index.html";

/* The precache contract: the app shell needed to open any page offline —
   every rendered document, the web manifest, the production CSS/JS bundles
   with the registration script, the web fonts and the installable icon set.

   Everything else dist/ carries stays runtime-cached by the fetch handler in
   sw.js: the gallery, hero, oferta, og, logo, partner-logo, screenshot and
   shortcut imagery, plus sitemap.xml, robots.txt and the Netlify config
   files. That core/runtime split is the one the hand-written list already
   expressed; this only derives its members instead of naming them. */
const PRECACHE_RULES = [
  { dir: ".", extensions: [".html"], recursive: true, required: true },
  { dir: ".", names: ["manifest.webmanifest"], required: true },
  { dir: "css", extensions: [".css"], required: true },
  { dir: "js", extensions: [".js"], required: true },
  { dir: "assets/fonts", extensions: [".woff2"], required: true },
  {
    dir: "assets/img/favicon",
    extensions: [".ico", ".png", ".svg"],
    required: true,
  },
];

/* dist/ is recreated by scripts/build-dist.js, which already refuses to stage
   these, so the guard is a statement of intent rather than a live filter — it
   keeps a stray tooling directory out of the manifest if dist/ was ever
   produced some other way. */
const NEVER_TRAVERSE = new Set([
  ".git",
  ".claude",
  ".codex",
  "node_modules",
  "dist",
  "partials",
]);

/* Code-unit ordering, not localeCompare: the sort must not depend on the
   machine's default locale, or two equivalent builds could disagree. */
function byUrl(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function toUrl(relPath) {
  return `/${relPath.split(path.sep).join("/")}`;
}

async function pathExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(absDir, { recursive }) {
  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const absPath = path.join(absDir, entry.name);

    if (entry.isDirectory()) {
      if (!recursive || NEVER_TRAVERSE.has(entry.name)) continue;
      files.push(...(await listFiles(absPath, { recursive })));
      continue;
    }

    if (entry.isFile()) files.push(absPath);
  }

  return files;
}

function matchesRule(absPath, rule) {
  const name = path.basename(absPath);
  if (rule.names) return rule.names.includes(name);
  return rule.extensions.includes(path.extname(name).toLowerCase());
}

async function collectPrecacheUrls() {
  const byUrlKey = new Map();

  for (const rule of PRECACHE_RULES) {
    const absDir = path.join(distDir, rule.dir);
    const files = (
      await listFiles(absDir, { recursive: rule.recursive === true })
    ).filter((absPath) => matchesRule(absPath, rule));

    if (rule.required && files.length === 0) {
      throw new Error(
        `No precache candidate matched rule "${rule.dir}" (${(rule.names || rule.extensions).join(", ")}). ` +
          'Run "npm run build:dist" so dist/ is complete before generating the Service Worker.',
      );
    }

    for (const absPath of files) {
      byUrlKey.set(toUrl(path.relative(distDir, absPath)), absPath);
    }
  }

  const startUrlFile = path.join(distDir, START_URL_FILE);
  if (!(await pathExists(startUrlFile))) {
    throw new Error(
      `Missing ${START_URL_FILE} in dist/: the ${START_URL} start URL cannot be precached.`,
    );
  }
  byUrlKey.set(START_URL, startUrlFile);

  return [...byUrlKey.entries()]
    .map(([url, absPath]) => ({ url, absPath }))
    .sort((a, b) => byUrl(a.url, b.url));
}

async function fileDigest(absPath) {
  return crypto
    .createHash("sha256")
    .update(await fs.readFile(absPath))
    .digest("hex");
}

/* The version is a fingerprint of the precache contract itself: each URL paired
   with the SHA-256 of the bytes served at it, in the emitted order. Identical
   output gives an identical version, any changed or renamed precached file
   gives a different one, and nothing machine-specific, random or time-based
   enters the input. */
async function fingerprint(entries) {
  const hash = crypto.createHash("sha256");
  for (const entry of entries) {
    hash.update(entry.url);
    hash.update("\0");
    hash.update(await fileDigest(entry.absPath));
    hash.update("\n");
  }
  return hash.digest("hex").slice(0, 16);
}

function renderManifestBlock(version, urls) {
  return [
    MANIFEST_START,
    "/* Generated by scripts/generate-sw.js from the built dist/ tree. Do not edit. */",
    `const CACHE_VERSION = ${JSON.stringify(version)};`,
    "",
    "const ASSETS = [",
    ...urls.map((url) => `  ${JSON.stringify(url)},`),
    "];",
    MANIFEST_END,
  ].join("\n");
}

function injectManifest(source, block) {
  const startCount = source.split(MANIFEST_START).length - 1;
  const endCount = source.split(MANIFEST_END).length - 1;

  if (startCount !== 1 || endCount !== 1) {
    throw new Error(
      `sw.js must contain exactly one ${MANIFEST_START} and one ${MANIFEST_END} marker (found ${startCount} and ${endCount}).`,
    );
  }

  const start = source.indexOf(MANIFEST_START);
  const end = source.indexOf(MANIFEST_END) + MANIFEST_END.length;

  if (end < start) {
    throw new Error(`sw.js has ${MANIFEST_END} before ${MANIFEST_START}.`);
  }

  return source.slice(0, start) + block + source.slice(end);
}

/* Every emitted URL must resolve to a real file in dist/, be unique, be a web
   path rather than a filesystem path, and stay in the deterministic order the
   manifest was sorted into. Verification lives in the generator for the same
   reason it lives inside build:css and build:js — the build fails at the step
   that produced the fault. */
async function verify(entries) {
  const urls = entries.map((entry) => entry.url);

  if (new Set(urls).size !== urls.length) {
    const seen = new Set();
    const duplicates = urls.filter((url) =>
      seen.has(url) ? true : (seen.add(url), false),
    );
    throw new Error(
      `Duplicate precache URL(s): ${[...new Set(duplicates)].join(", ")}`,
    );
  }

  const sorted = [...urls].sort(byUrl);
  if (sorted.some((url, index) => url !== urls[index])) {
    throw new Error("Precache URLs are not in deterministic sorted order.");
  }

  for (const { url, absPath } of entries) {
    if (
      !url.startsWith("/") ||
      url.includes("\\") ||
      /^[a-zA-Z]:/.test(url) ||
      url.includes("//")
    ) {
      throw new Error(`Precache entry is not a site-root web path: ${url}`);
    }

    const stat = await fs.stat(absPath).catch(() => null);
    if (!stat?.isFile()) {
      throw new Error(
        `Precache entry does not resolve to a file in dist/: ${url}`,
      );
    }
  }
}

async function generate() {
  logger.debug("generate-sw: start");

  if (!(await pathExists(distDir))) {
    throw new Error('dist/ not found. Run "npm run build:dist" first.');
  }

  const entries = await collectPrecacheUrls();
  await verify(entries);

  const urls = entries.map((entry) => entry.url);
  const version = await fingerprint(entries);
  const source = await fs.readFile(sourceSwPath, "utf8");
  const output = injectManifest(source, renderManifestBlock(version, urls));

  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(outputSwPath, output, "utf8");

  logger.debug(
    `generate-sw: precached URLs\n${urls.map((url) => `  ${url}`).join("\n")}`,
  );
  logger.summary(
    `OK: dist/sw.js generated (${urls.length} precached URL(s), cache solidcraft-v${version}).`,
  );
}

generate().catch((error) => {
  logger.error("FAIL: Service Worker generation failed.");
  logger.error(error.stack || String(error));
  process.exit(1);
});
