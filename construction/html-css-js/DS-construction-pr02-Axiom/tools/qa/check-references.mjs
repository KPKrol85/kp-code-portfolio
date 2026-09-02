// Static reference-integrity check (PH2-01).
//
// Resolves every local reference declared by the maintained HTML pages, the
// stylesheets under css/, manifest.webmanifest, and the canonical production
// precache definition owned by tools/sw/build-sw.mjs. Everything is read from
// the tracked sources, so the check needs no local server and no browser.
//
// Exit codes:
//   0 - every checked local reference resolves to a file
//   1 - at least one local reference is unresolved
//   2 - the checker itself could not complete (read/parse failure)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cssDir = path.join(rootDir, "css");
const manifestPath = path.join(rootDir, "manifest.webmanifest");
const buildSwPath = path.join(rootDir, "tools", "sw", "build-sw.mjs");

// Generated output, dependencies, and build templates hold no maintained page
// references: tools/templates/head.partial.html is a placeholder template, and
// dist/ is regenerated from the sources checked here.
const skippedDirNames = new Set(["node_modules", "dist", "reports", "tools"]);

// Attributes that carry a single local file or page reference. data-light and
// data-dark are the theme-aware logo sources read by js/components/theme.js.
const singleUrlAttributes = ["src", "href", "poster", "action", "data-light", "data-dark"];

// Attributes that carry a comma-separated candidate list.
const srcsetAttributes = ["srcset", "imagesrcset"];

// tools/sw/build-sw.mjs precaches production URLs served from dist/. These two
// are build outputs rather than tracked files, so instead of looking for a file
// that only exists after a build, the checker confirms that the owning builder
// still declares that exact output. The expected output path is derived from
// the precache URL itself, so no second list of production URLs is kept here.
const buildOutputOwners = new Map([
  ["/style.min.css", "tools/css/build-css.mjs"],
  ["/script.min.js", "tools/js/build-js.mjs"],
]);

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

// Reads the canonical production precache list straight out of
// tools/sw/build-sw.mjs so the production definition stays the single source of
// truth. Both generated service workers come from that builder's profiles -
// dist/sw.js from this list, the root sw.js from the local profile, whose
// entries every maintained page already references - so reading an output here
// would only check the generator against itself.
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
  const references = basePrecache.map((value) => ({
    kind: "BASE_PRECACHE",
    value,
    owner: buildOutputOwners.get(value),
  }));
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

// A precached build output exists only after a build, so the contract to check
// is that its owning builder still writes that exact file. Verified statically:
// the build is never run and dist/ never has to exist. A builder declares the
// path either as one literal ("dist/script.min.js") or as a directory literal
// plus a filename literal (path.join(distDir, "style.min.css")), so drift in
// either half fails the check.
const checkBuildOutput = async (sourceLabel, reference) => {
  const outputPath = path.posix.join("dist", reference.value);
  const finding = {
    source: sourceLabel,
    kind: reference.kind,
    value: reference.value,
    target: outputPath,
  };

  let builderSource;
  try {
    builderSource = await fs.readFile(path.join(rootDir, ...reference.owner.split("/")), "utf8");
  } catch {
    return { ...finding, reason: `owning builder ${reference.owner} is missing` };
  }

  const literals = collectStringLiterals(builderSource);
  const declared = literals.has(outputPath) || (literals.has(path.posix.dirname(outputPath)) && literals.has(path.posix.basename(outputPath)));

  if (declared) return null;

  return { ...finding, reason: `${reference.owner} does not declare this build output` };
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
    if (reference.owner) {
      state.checked += 1;

      const finding = await checkBuildOutput(sourceLabel, reference);
      if (finding) state.findings.push(finding);
      continue;
    }

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

const run = async () => {
  const state = { checked: 0, skipped: 0, findings: [] };

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

  const scope = [`${htmlFiles.length} HTML pages`, `${cssFiles.length} CSS files`, manifestLabel, `${precacheReferences.length} precache entries`].join(", ");
  const summary = `Checked ${state.checked} local references across ${scope} (${state.skipped} external or in-page references ignored).`;

  if (state.findings.length > 0) {
    state.findings.sort((a, b) => a.source.localeCompare(b.source) || a.value.localeCompare(b.value) || a.kind.localeCompare(b.kind));

    console.error(`Unresolved local references (${state.findings.length}):`);

    for (const finding of state.findings) {
      console.error(`  ${finding.source} [${finding.kind}] ${finding.value} -> ${finding.target} (${finding.reason})`);
    }

    console.error(summary);

    return 1;
  }

  console.log(summary);
  console.log("All local references resolved.");

  return 0;
};

try {
  process.exitCode = await run();
} catch (error) {
  console.error(`Reference integrity check failed: ${error.message}`);
  process.exitCode = 2;
}
