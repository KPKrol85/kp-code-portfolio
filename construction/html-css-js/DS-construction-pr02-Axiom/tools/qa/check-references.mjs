// Static reference-integrity check (PH2-01) and release contract check (O-01).
//
// Two modes, in one run:
//
//   Static (always): resolves every local reference declared by the maintained
//   HTML pages, the stylesheets under css/, manifest.webmanifest, and the
//   static production precache definition owned by tools/sw/build-sw.mjs, and
//   verifies the content-hashed bundle contract that cannot be checked by
//   resolving a path - who owns the names, and what the canonical _headers
//   declares. Everything is read from the tracked sources, so this mode needs
//   no build, no local server, and no browser.
//
//   Post-build (only when dist/build-manifest.json exists): verifies the real
//   generated deployment - the bundles on disk, the rewritten HTML, the source
//   files the deployment publishes beside the bundles, the production service
//   worker, and the generated dist/_headers - against the manifest that
//   build:hash produced. Skipped, not failed, without a build.
//
// Exit codes:
//   0 - every checked local reference resolves and every contract holds
//   1 - at least one unresolved reference or violated contract
//   2 - the checker itself could not complete (read/parse failure)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Importing the release contract is safe here: tools/release/bundle-names.mjs
// declares constants and functions only, so it reads and writes nothing at
// import time and this checker stays usable without a build.
import {
  BUNDLES,
  HEADERS_FILENAME,
  MANIFEST_FILENAME,
  contentHash,
  findBundleFiles,
  findHeaderPolicyViolations,
  locateHeadersMarkerBlock,
  parseProductionName,
  readBundleManifest,
} from "../release/bundle-names.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cssDir = path.join(rootDir, "css");
const distDir = path.join(rootDir, "dist");
const manifestPath = path.join(rootDir, "manifest.webmanifest");
const buildSwPath = path.join(rootDir, "tools", "sw", "build-sw.mjs");

// Generated output, dependencies, and build templates hold no maintained page
// references: tools/templates/head.partial.html is a placeholder template, and
// dist/ is regenerated from the sources checked here. The post-build checks
// read dist/ directly instead, so skipping it here only scopes the walk over
// maintained sources.
const skippedDirNames = new Set(["node_modules", "dist", "reports", "tools"]);

// Attributes that carry a single local file or page reference. data-light and
// data-dark are the theme-aware logo sources read by js/components/theme.js.
const singleUrlAttributes = ["src", "href", "poster", "action", "data-light", "data-dark"];

// Attributes that carry a comma-separated candidate list.
const srcsetAttributes = ["srcset", "imagesrcset"];

// The bundle contract the rest of the project assumes, compared below against
// the declaration in tools/release/bundle-names.mjs, which owns the real thing.
// The production names themselves are never spelled here: they carry a per-build
// content hash and are only known from the manifest.
const expectedBundles = [
  { key: "css", intermediate: "style.min.css", builder: "tools/css/build-css.mjs" },
  { key: "js", intermediate: "script.min.js", builder: "tools/js/build-js.mjs" },
];

// Scripts that consume production bundle names. They must read them from the
// shared contract, never build or hardcode one of their own.
const bundleNameConsumers = ["tools/sw/build-sw.mjs", "tools/release/build-dist.mjs"];

// The fixed production URLs the pre-O-01 contract used. No consumer may still
// declare one: nothing is served under those paths any more. The bare filenames
// are deliberately not banned - build-dist.mjs lists them as the references a
// rewritten page must no longer contain.
const obsoleteProductionUrls = BUNDLES.map((bundle) => `/${bundle.intermediate}`);

// A filename that already carries a content hash. Finding one written into a
// script means that script is guessing a name the manifest owns.
const productionNameLiteral = /^(?:style|script)\.[0-9a-f]{16}\.min\.(?:css|js)$/;

const externalSchemePattern = /^[a-z][a-z0-9+.-]*:/i;

const toPosix = (value) => value.split(path.sep).join("/");

const relativeToRoot = (absolutePath) => toPosix(path.relative(rootDir, absolutePath));

const collectFiles = async (dir, extension, files = []) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || skippedDirNames.has(entry.name)) continue;
      await collectFiles(entryPath, extension, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(entryPath);
    }
  }

  return files.sort();
};

// Every file under a directory, as sorted POSIX paths relative to it. Unlike
// collectFiles this filters nothing, so a stray file of any name or extension is
// visible when a generated directory is compared against an allowlist.
const collectPublishedFiles = async (dir, base = dir, files = []) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectPublishedFiles(entryPath, base, files);
      continue;
    }

    files.push(toPosix(path.relative(base, entryPath)));
  }

  return files.sort();
};

// HTML candidate parsing: a candidate is a whitespace-free URL followed by an
// optional width or density descriptor, so descriptors and comma-bearing data
// URLs are never mistaken for filenames.
const parseSrcsetCandidates = (value) => {
  const candidates = [];
  let index = 0;

  while (index < value.length) {
    while (index < value.length && /[\s,]/.test(value[index])) index += 1;
    if (index >= value.length) break;

    const start = index;
    while (index < value.length && !/\s/.test(value[index])) index += 1;
    const token = value.slice(start, index);

    if (token.endsWith(",")) {
      // No descriptor followed the URL; the trailing commas are separators.
      candidates.push(token.replace(/,+$/, ""));
      continue;
    }

    // Skip the descriptor of this candidate up to the next separator comma.
    while (index < value.length && value[index] !== ",") index += 1;
    candidates.push(token);
  }

  return candidates.filter(Boolean);
};

const extractHtmlReferences = (html) => {
  const references = [];
  const markup = html.replace(/<!--[\s\S]*?-->/g, "");
  const attributeNames = [...singleUrlAttributes, ...srcsetAttributes];
  const attributePattern = new RegExp(`\\s(${attributeNames.join("|")})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "gi");

  for (const match of markup.matchAll(attributePattern)) {
    const attribute = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? "";

    if (srcsetAttributes.includes(attribute)) {
      for (const candidate of parseSrcsetCandidates(value)) {
        references.push({ kind: attribute, value: candidate });
      }
      continue;
    }

    references.push({ kind: attribute, value });
  }

  return references;
};

const extractCssReferences = (css) => {
  const references = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const importPattern = /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)')[^;]*;?/gi;
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/gi;

  for (const match of source.matchAll(importPattern)) {
    references.push({ kind: "@import", value: match[1] ?? match[2] ?? "" });
  }

  // Scan declarations only, so an `@import url(...)` target is not reported
  // once as an import and once again as a plain url() reference.
  for (const match of source.replace(importPattern, "").matchAll(urlPattern)) {
    references.push({ kind: "url()", value: match[1] ?? match[2] ?? match[3] ?? "" });
  }

  return references;
};

const extractManifestReferences = (manifest) => {
  const references = [];

  const addIcons = (icons, label) => {
    if (!Array.isArray(icons)) return;

    icons.forEach((icon, index) => {
      if (typeof icon?.src === "string") {
        references.push({ kind: `${label}[${index}].src`, value: icon.src });
      }
    });
  };

  if (typeof manifest.start_url === "string") {
    references.push({ kind: "start_url", value: manifest.start_url });
  }

  addIcons(manifest.icons, "icons");
  addIcons(manifest.screenshots, "screenshots");

  if (Array.isArray(manifest.shortcuts)) {
    manifest.shortcuts.forEach((shortcut, index) => {
      if (typeof shortcut?.url === "string") {
        references.push({ kind: `shortcuts[${index}].url`, value: shortcut.url });
      }

      addIcons(shortcut?.icons, `shortcuts[${index}].icons`);
    });
  }

  return references;
};

// Reads the static production precache list straight out of
// tools/sw/build-sw.mjs so the production definition stays the single source of
// truth. Both generated service workers come from that builder's profiles -
// dist/sw.js from this list, the root sw.js from the local profile, whose
// entries every maintained page already references - so reading an output here
// would only check the generator against itself.
//
// Only the fixed URLs appear in this declaration. The content-hashed bundle
// URLs are appended per build from the manifest, and checkGeneratedRelease
// verifies those against the deployment that actually produced them.
const readBasePrecache = async () => {
  const source = await fs.readFile(buildSwPath, "utf8");
  const match = source.match(/const BASE_PRECACHE\s*=\s*(\[[\s\S]*?\])\s*;/);

  if (!match) {
    throw new Error(`Could not locate BASE_PRECACHE in ${relativeToRoot(buildSwPath)}`);
  }

  let entries;
  try {
    entries = JSON.parse(match[1].replace(/,(\s*])$/, "$1"));
  } catch (error) {
    throw new Error(`Could not parse BASE_PRECACHE in ${relativeToRoot(buildSwPath)}: ${error.message}`, { cause: error });
  }

  if (!Array.isArray(entries) || entries.some((entry) => typeof entry !== "string")) {
    throw new Error(`BASE_PRECACHE in ${relativeToRoot(buildSwPath)} is not a list of strings`);
  }

  return entries;
};

// Mirrors the manifest icon derivation in tools/sw/build-sw.mjs, which appends
// the manifest icons to BASE_PRECACHE.
const collectPrecacheReferences = async (manifest) => {
  const basePrecache = await readBasePrecache();
  const references = basePrecache.map((value) => ({ kind: "BASE_PRECACHE", value }));
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];

  for (const icon of icons) {
    if (typeof icon?.src !== "string" || !icon.src) continue;

    const value = icon.src.startsWith("/") ? icon.src : `/${icon.src}`;
    references.push({ kind: "manifest icons", value });
  }

  return references;
};

// Every string literal in a builder, with comments removed, so an output path
// that survives only in prose cannot satisfy the contract.
const collectStringLiterals = (source) => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const literals = new Set();

  for (const match of code.matchAll(/"([^"\\\n]*)"|'([^'\\\n]*)'|`([^`\\\n]*)`/g)) {
    literals.add(match[1] ?? match[2] ?? match[3]);
  }

  return literals;
};

// A builder declares an output path either as one literal ("dist/script.min.js")
// or as a directory literal plus a filename literal (path.join(distDir,
// "style.min.css")), so drift in either half is visible without running a build.
const declaresOutputPath = (literals, outputPath) =>
  literals.has(outputPath) ||
  (literals.has(path.posix.dirname(outputPath)) && literals.has(path.posix.basename(outputPath)));

const readToolSource = async (relativePath) => {
  try {
    return await fs.readFile(path.join(rootDir, ...relativePath.split("/")), "utf8");
  } catch {
    return null;
  }
};

// The content-hashed bundle contract (O-01), checked without a build. Production
// filenames only exist per build, so what is verifiable statically is ownership:
// who declares the intermediates, who is allowed to name the production files,
// and what the canonical deployment headers promise.
const checkBundleContract = async (state) => {
  const note = (source, reason) => state.contract.push({ source, reason });

  // The shared module still declares exactly the two bundles everything assumes.
  if (BUNDLES.length !== expectedBundles.length) {
    note(
      "tools/release/bundle-names.mjs",
      `declares ${BUNDLES.length} bundles, expected ${expectedBundles.length} (one CSS, one JavaScript)`,
    );
  }

  for (const expected of expectedBundles) {
    const declared = BUNDLES.find((bundle) => bundle.key === expected.key);

    if (!declared) {
      note("tools/release/bundle-names.mjs", `declares no "${expected.key}" bundle`);
      continue;
    }

    if (declared.intermediate !== expected.intermediate) {
      note(
        "tools/release/bundle-names.mjs",
        `"${expected.key}" declares intermediate ${declared.intermediate}, expected ${expected.intermediate}`,
      );
      continue;
    }

    // The intermediate is still written by the builder that is supposed to own it.
    const builderSource = await readToolSource(expected.builder);

    if (builderSource === null) {
      note(expected.builder, "owning builder is missing");
      continue;
    }

    if (!declaresOutputPath(collectStringLiterals(builderSource), `dist/${expected.intermediate}`)) {
      note(expected.builder, `does not declare its build output dist/${expected.intermediate}`);
    }
  }

  // Consumers read production names from the shared contract and never mint one.
  for (const consumer of bundleNameConsumers) {
    const source = await readToolSource(consumer);

    if (source === null) {
      note(consumer, "bundle name consumer is missing");
      continue;
    }

    if (!/from\s+["'][^"']*bundle-names\.mjs["']/.test(source)) {
      note(consumer, "does not import the shared contract tools/release/bundle-names.mjs");
    }

    const literals = collectStringLiterals(source);

    for (const literal of literals) {
      if (productionNameLiteral.test(literal)) {
        note(consumer, `hardcodes the content-hashed production filename "${literal}"`);
      }
    }

    for (const obsolete of obsoleteProductionUrls) {
      if (literals.has(obsolete)) {
        note(consumer, `still declares the obsolete production URL "${obsolete}"`);
      }
    }
  }

  // The canonical deployment headers: exactly one marker block, and no
  // immutable rule on a URL that carries no content or release identity.
  const canonicalHeaders = await readToolSource(HEADERS_FILENAME);

  if (canonicalHeaders === null) {
    note(HEADERS_FILENAME, "canonical deployment headers file is missing");
    return;
  }

  try {
    locateHeadersMarkerBlock(canonicalHeaders, HEADERS_FILENAME);
  } catch (error) {
    note(HEADERS_FILENAME, error.message.replace(`${HEADERS_FILENAME} `, ""));
  }

  for (const problem of findHeaderPolicyViolations(canonicalHeaders, { label: HEADERS_FILENAME })) {
    note(HEADERS_FILENAME, problem.replace(`${HEADERS_FILENAME} `, ""));
  }
};

// Turns a reference into a repository-relative POSIX path, or explains why it
// is not a local filesystem target.
const resolveReference = (value, sourceDirPosix) => {
  const trimmed = value.trim();

  if (!trimmed) return { status: "skipped" };
  if (trimmed.startsWith("#")) return { status: "skipped" };
  if (trimmed.startsWith("//")) return { status: "skipped" };
  if (externalSchemePattern.test(trimmed)) return { status: "skipped" };

  const withoutQuery = trimmed.split("#")[0].split("?")[0];

  if (!withoutQuery) return { status: "skipped" };

  let decoded;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return { status: "malformed", reason: "invalid percent-encoding" };
  }

  if (decoded.includes("\\")) {
    return { status: "malformed", reason: "backslash in local path" };
  }

  const isRootRelative = decoded.startsWith("/");
  const segments = isRootRelative ? [] : sourceDirPosix.split("/").filter((part) => part !== ".");

  for (const segment of decoded.split("/")) {
    if (!segment || segment === ".") continue;

    if (segment === "..") {
      if (segments.length === 0) {
        return { status: "malformed", reason: "path escapes the project root" };
      }

      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  // A trailing slash, or a bare root, addresses a directory index.
  if (segments.length === 0 || decoded.endsWith("/")) {
    segments.push("index.html");
  }

  return { status: "local", target: segments.join("/") };
};

const checkReferences = async (sourceLabel, sourceDirPosix, references, state) => {
  for (const reference of references) {
    const resolved = resolveReference(reference.value, sourceDirPosix);

    if (resolved.status === "skipped") {
      state.skipped += 1;
      continue;
    }

    state.checked += 1;

    if (resolved.status === "malformed") {
      state.findings.push({
        source: sourceLabel,
        kind: reference.kind,
        value: reference.value,
        target: reference.value,
        reason: resolved.reason,
      });
      continue;
    }

    let stats;
    try {
      stats = await fs.stat(path.join(rootDir, ...resolved.target.split("/")));
    } catch {
      state.findings.push({
        source: sourceLabel,
        kind: reference.kind,
        value: reference.value,
        target: resolved.target,
        reason: "missing file",
      });
      continue;
    }

    if (!stats.isFile()) {
      state.findings.push({
        source: sourceLabel,
        kind: reference.kind,
        value: reference.value,
        target: resolved.target,
        reason: "not a file",
      });
    }
  }
};

// The references a rewritten production page must no longer carry. None is a
// substring of a hashed production filename, and none matches js/theme-init.js,
// which production pages load directly and the build leaves alone.
const staleProductionReferences = [
  "css/main.css",
  "js/main.js",
  ...BUNDLES.map((bundle) => bundle.intermediate),
];

// The only canonical source files the release assembler publishes beside the
// generated bundles: the pre-paint theme script every maintained page loads, and
// the recovery script offline.html loads and the production service worker
// precaches. Every other module of the js/main.js graph reaches production
// inside the JavaScript bundle, and the css/ layers inside the CSS bundle, so
// the deployment publishes neither source tree. tools/release/build-dist.mjs
// owns that copy contract; this list is what its output must match.
const publishedSourceScripts = ["theme-init.js", "offline.js"];

// Verifies the real generated deployment against the manifest build:hash wrote.
// Returns false when there is no build to check, which is a skip, not a failure.
const checkGeneratedRelease = async (state) => {
  const note = (source, reason) => state.contract.push({ source, reason });

  try {
    await fs.access(path.join(distDir, MANIFEST_FILENAME));
  } catch {
    return false;
  }

  let bundles;
  try {
    bundles = await readBundleManifest(distDir);
  } catch (error) {
    note(`dist/${MANIFEST_FILENAME}`, error.message);
    return true;
  }

  // Exactly one production bundle of each kind, no fixed name left behind, and
  // each filename addressed by the bytes it actually names.
  for (const bundle of BUNDLES) {
    const found = await findBundleFiles(distDir, bundle);

    if (found.length !== 1) {
      note("dist/", `holds ${found.length} ${bundle.suffix} bundles at the deployment root, expected exactly one`);
    }

    if (found.includes(bundle.intermediate)) {
      note("dist/", `still holds the fixed production bundle dist/${bundle.intermediate}`);
    }

    const filename = bundles[bundle.key];
    const declaredHash = parseProductionName(bundle, filename);
    const actualHash = contentHash(await fs.readFile(path.join(distDir, filename)));

    if (declaredHash !== actualHash) {
      note(`dist/${filename}`, `filename claims hash ${declaredHash}, its bytes hash to ${actualHash}`);
    }
  }

  // The source payload published beside the bundles. A css/ tree, or anything
  // under js/ outside the allowlist, means the deployment shipped a second,
  // unreferenced copy of code the bundles already carry.
  try {
    await fs.stat(path.join(distDir, "css"));
    note("dist/css/", "publishes the unbundled stylesheet source tree, which no production page references");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  let publishedScripts;
  try {
    publishedScripts = await collectPublishedFiles(path.join(distDir, "js"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;

    publishedScripts = [];
  }

  for (const expected of publishedSourceScripts) {
    if (publishedScripts.includes(expected)) continue;

    note(`dist/js/${expected}`, "is not published, but production pages load it directly");
  }

  for (const published of publishedScripts) {
    if (publishedSourceScripts.includes(published)) continue;

    note(
      `dist/js/${published}`,
      "is published, but production reaches this source through the content-addressed JavaScript bundle",
    );
  }

  // Every generated page points at both bundles and at neither source entry
  // point nor either fixed production name.
  const distHtmlFiles = await collectFiles(distDir, ".html");

  for (const file of distHtmlFiles) {
    const label = toPosix(path.relative(rootDir, file));
    const html = await fs.readFile(file, "utf8");

    for (const bundle of BUNDLES) {
      if (!html.includes(bundles[bundle.key])) {
        note(label, `does not reference the production bundle ${bundles[bundle.key]}`);
      }
    }

    for (const stale of staleProductionReferences) {
      if (html.includes(stale)) {
        note(label, `still references ${stale} after the production rewrite`);
      }
    }
  }

  // The production service worker precaches exactly these bundle URLs.
  const swPath = path.join(distDir, "sw.js");
  let swSource;
  try {
    swSource = await fs.readFile(swPath, "utf8");
  } catch {
    swSource = null;
    note("dist/sw.js", "generated production service worker is missing");
  }

  if (swSource !== null) {
    const assetsMatch = swSource.match(/const ASSETS = (\[[\s\S]*?\]);/);

    if (!assetsMatch) {
      note("dist/sw.js", "declares no precache asset list");
    } else {
      let assets;
      try {
        assets = JSON.parse(assetsMatch[1]);
      } catch (error) {
        assets = null;
        note("dist/sw.js", `precache asset list is not valid JSON: ${error.message}`);
      }

      if (assets) {
        const expectedUrls = BUNDLES.map((bundle) => `/${bundles[bundle.key]}`);

        for (const url of expectedUrls) {
          if (!assets.includes(url)) note("dist/sw.js", `does not precache ${url}`);
        }

        const strayBundleUrls = assets.filter(
          (asset) =>
            BUNDLES.some((bundle) => asset.endsWith(bundle.suffix)) && !expectedUrls.includes(asset),
        );

        for (const stray of strayBundleUrls) {
          note("dist/sw.js", `precaches ${stray}, which this build did not produce`);
        }
      }
    }
  }

  // The generated deployment headers carry the exact immutable rules, and give
  // immutable caching to nothing else.
  const generatedHeadersLabel = `dist/${HEADERS_FILENAME}`;
  let generatedHeaders;
  try {
    generatedHeaders = await fs.readFile(path.join(distDir, HEADERS_FILENAME), "utf8");
  } catch {
    generatedHeaders = null;
    note(generatedHeadersLabel, "generated deployment headers file is missing");
  }

  if (generatedHeaders !== null) {
    try {
      locateHeadersMarkerBlock(generatedHeaders, generatedHeadersLabel);
    } catch (error) {
      note(generatedHeadersLabel, error.message.replace(`${generatedHeadersLabel} `, ""));
    }

    const problems = findHeaderPolicyViolations(generatedHeaders, {
      label: generatedHeadersLabel,
      bundles,
    });

    for (const problem of problems) {
      note(generatedHeadersLabel, problem.replace(`${generatedHeadersLabel} `, ""));
    }
  }

  return true;
};

const run = async () => {
  const state = { checked: 0, skipped: 0, findings: [], contract: [] };

  const htmlFiles = await collectFiles(rootDir, ".html");
  const cssFiles = await collectFiles(cssDir, ".css");

  for (const file of htmlFiles) {
    const label = relativeToRoot(file);
    const html = await fs.readFile(file, "utf8");

    await checkReferences(label, path.posix.dirname(label), extractHtmlReferences(html), state);
  }

  for (const file of cssFiles) {
    const label = relativeToRoot(file);
    const css = await fs.readFile(file, "utf8");

    await checkReferences(label, path.posix.dirname(label), extractCssReferences(css), state);
  }

  const manifestLabel = relativeToRoot(manifestPath);
  const manifestRaw = await fs.readFile(manifestPath, "utf8");

  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (error) {
    throw new Error(`Could not parse ${manifestLabel}: ${error.message}`, {
      cause: error,
    });
  }

  await checkReferences(manifestLabel, ".", extractManifestReferences(manifest), state);

  const precacheReferences = await collectPrecacheReferences(manifest);
  await checkReferences(relativeToRoot(buildSwPath), ".", precacheReferences, state);

  await checkBundleContract(state);
  const postBuildChecked = await checkGeneratedRelease(state);

  const scope = [`${htmlFiles.length} HTML pages`, `${cssFiles.length} CSS files`, manifestLabel, `${precacheReferences.length} precache entries`].join(", ");
  const summary = `Checked ${state.checked} local references across ${scope} (${state.skipped} external or in-page references ignored).`;
  const releaseSummary = postBuildChecked
    ? `Verified the generated release in dist/ against dist/${MANIFEST_FILENAME}.`
    : `No dist/${MANIFEST_FILENAME} present, so the post-build release checks were skipped. Run \`npm run build\` to include them.`;

  if (state.findings.length > 0) {
    state.findings.sort((a, b) => a.source.localeCompare(b.source) || a.value.localeCompare(b.value) || a.kind.localeCompare(b.kind));

    console.error(`Unresolved local references (${state.findings.length}):`);

    for (const finding of state.findings) {
      console.error(`  ${finding.source} [${finding.kind}] ${finding.value} -> ${finding.target} (${finding.reason})`);
    }
  }

  if (state.contract.length > 0) {
    state.contract.sort((a, b) => a.source.localeCompare(b.source) || a.reason.localeCompare(b.reason));

    console.error(`Bundle contract violations (${state.contract.length}):`);

    for (const violation of state.contract) {
      console.error(`  ${violation.source}: ${violation.reason}`);
    }
  }

  if (state.findings.length > 0 || state.contract.length > 0) {
    console.error(summary);
    console.error(releaseSummary);

    return 1;
  }

  console.log(summary);
  console.log(releaseSummary);
  console.log("All local references resolved and the bundle contract holds.");

  return 0;
};

try {
  process.exitCode = await run();
} catch (error) {
  console.error(`Reference integrity check failed: ${error.message}`);
  process.exitCode = 2;
}
