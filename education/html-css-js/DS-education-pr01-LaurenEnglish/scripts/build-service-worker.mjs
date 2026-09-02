import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

import {
  CACHE_PREFIX,
  OFFLINE_PATH,
  PRECACHE_PATHS,
  PUBLISHED_DOCUMENT_PATHS,
  PRIMARY_DOCUMENT_PATHS,
  RUNTIME_CSS_PATHS,
  RUNTIME_JAVASCRIPT_PATHS,
  STATIC_PRECACHE_PATHS,
  normalizePublicPath,
} from "./pwa-config.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DIST_ROOT = resolve(ROOT, "dist");
export const TEMPLATE_PATH = resolve(ROOT, "service-worker.template.js");
export const OUTPUT_PATH = resolve(ROOT, "service-worker.js");
export const DIST_OUTPUT_PATH = resolve(DIST_ROOT, "service-worker.js");

const PACKAGE_PATH = resolve(ROOT, "package.json");
const DIRECT_RUNTIME_PATH = /^\/(?:css|js)(?:\/|$)/;
const VITE_BUNDLE_PATH = /^\/build\/.+-[A-Za-z0-9_-]+\.(?:css|js)$/;
const SOURCE_MAP_PATH = /\.map$/;
const DIRECT_RUNTIME_PATHS = new Set([
  ...RUNTIME_CSS_PATHS,
  ...RUNTIME_JAVASCRIPT_PATHS,
]);
const PLACEHOLDER_PATTERN = /__[A-Z0-9_]+__/g;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const resolvePublicFile = (publishRoot, publicPath) => {
  const filePath = resolve(publishRoot, `.${publicPath}`);
  const publishRelativePath = relative(publishRoot, filePath);
  assert(
    publishRelativePath && !publishRelativePath.startsWith(".."),
    `Precache path escapes the publish root: ${publicPath}`,
  );
  return filePath;
};

const toPublicPath = (publishRoot, filePath) => {
  const publishRelativePath = relative(publishRoot, filePath)
    .split("\\")
    .join("/");
  assert(
    publishRelativePath && !publishRelativePath.startsWith(".."),
    `Vite output escapes the publish root: ${filePath}`,
  );
  return normalizePublicPath(`/${publishRelativePath}`);
};

const collectPublishFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const entryPath = resolve(directory, entry.name);
    assert(
      !entry.isSymbolicLink(),
      `Vite output must not contain symbolic links: ${entryPath}`,
    );
    if (entry.isDirectory()) {
      files.push(...(await collectPublishFiles(entryPath)));
      continue;
    }
    assert(entry.isFile(), `Unsupported Vite output entry: ${entryPath}`);
    files.push(entryPath);
  }

  return files;
};

export const discoverViteRuntimePaths = async (publishRoot = DIST_ROOT) => {
  const buildRoot = resolve(publishRoot, "build");
  const buildStat = await stat(buildRoot).catch(() => null);
  assert(
    buildStat?.isDirectory(),
    "Vite build directory is missing; run vite build first",
  );

  const runtimePaths = (await collectPublishFiles(buildRoot))
    .map((filePath) => toPublicPath(publishRoot, filePath))
    .filter((publicPath) => !SOURCE_MAP_PATH.test(publicPath))
    .sort();

  assert(runtimePaths.length > 0, "Vite build contains no runtime assets");
  const bundlePaths = runtimePaths.filter((publicPath) =>
    /\.(?:css|js)$/.test(publicPath),
  );
  assert(
    bundlePaths.length > 0 &&
      bundlePaths.every((publicPath) => VITE_BUNDLE_PATH.test(publicPath)),
    `Vite CSS and JavaScript bundles must use hashed /build paths: ${bundlePaths.join(", ")}`,
  );
  assert(
    bundlePaths.some((publicPath) => publicPath.endsWith(".css")) &&
      bundlePaths.some((publicPath) => publicPath.endsWith(".js")),
    "Vite build must contain hashed CSS and JavaScript bundles",
  );

  return Object.freeze(runtimePaths);
};

export const createVitePrecachePaths = async (publishRoot = DIST_ROOT) =>
  Object.freeze([
    ...PUBLISHED_DOCUMENT_PATHS,
    ...(await discoverViteRuntimePaths(publishRoot)),
    ...STATIC_PRECACHE_PATHS,
  ]);

export const validatePrecachePaths = async (
  paths = PRECACHE_PATHS,
  { publishRoot = ROOT } = {},
) => {
  const normalizedPaths = paths.map((path) => {
    assert(
      typeof path === "string" && path.startsWith("/"),
      `Precache path must be root-relative: ${String(path)}`,
    );
    assert(
      !path.includes("?") && !path.includes("#"),
      `Precache path must not include a query or fragment: ${path}`,
    );

    const normalizedPath = normalizePublicPath(path);
    assert(
      normalizedPath === path,
      `Precache path must already be normalized: ${path} -> ${normalizedPath}`,
    );
    assert(
      normalizedPath !== "/service-worker.js",
      "Generated service-worker.js must not be included in its own precache",
    );
    if (DIRECT_RUNTIME_PATH.test(normalizedPath)) {
      assert(
        DIRECT_RUNTIME_PATHS.has(normalizedPath),
        `Unconfigured CSS or JavaScript cannot be precached: ${normalizedPath}`,
      );
    }
    return normalizedPath;
  });

  const duplicates = normalizedPaths.filter(
    (path, index) => normalizedPaths.indexOf(path) !== index,
  );
  assert(
    duplicates.length === 0,
    `Duplicate normalized precache paths: ${[...new Set(duplicates)].join(", ")}`,
  );

  const files = [];
  for (const publicPath of normalizedPaths) {
    const filePath = resolvePublicFile(publishRoot, publicPath);
    const fileStat = await stat(filePath).catch(() => null);
    assert(fileStat?.isFile(), `Precache file is missing: ${publicPath}`);
    files.push({
      publicPath,
      filePath,
      content: await readFile(filePath),
    });
  }

  return files;
};

const replaceQuotedPlaceholder = (source, placeholder, value) => {
  const token = JSON.stringify(placeholder);
  assert(
    source.includes(token),
    `Service-worker template is missing ${placeholder}`,
  );
  return source.replace(token, JSON.stringify(value, null, 2));
};

export const createCacheRevision = ({
  version,
  template,
  precacheFiles,
  precachePaths = PRECACHE_PATHS,
  primaryDocumentPaths = PRIMARY_DOCUMENT_PATHS,
}) => {
  const fingerprint = createHash("sha256");
  fingerprint.update(
    JSON.stringify({
      version,
      cachePrefix: CACHE_PREFIX,
      offlinePath: OFFLINE_PATH,
      primaryDocumentPaths,
      precachePaths,
    }),
  );
  fingerprint.update("\0service-worker-template\0");
  fingerprint.update(template);
  for (const { publicPath, content } of precacheFiles) {
    fingerprint.update(`\0${publicPath}\0`);
    fingerprint.update(content);
  }
  return `${version}-${fingerprint.digest("hex").slice(0, 12)}`;
};

export const createServiceWorkerBuild = async ({
  publishRoot = ROOT,
  precachePaths = PRECACHE_PATHS,
  primaryDocumentPaths = PRIMARY_DOCUMENT_PATHS,
} = {}) => {
  assert(
    Array.isArray(precachePaths) && precachePaths.length > 0,
    "Service-worker build requires a non-empty precache path list",
  );
  assert(
    Array.isArray(primaryDocumentPaths) && primaryDocumentPaths.length > 0,
    "Service-worker build requires primary document paths",
  );
  assert(
    new Set(primaryDocumentPaths).size === primaryDocumentPaths.length,
    "Primary document paths must not contain duplicates",
  );
  for (const primaryDocumentPath of primaryDocumentPaths) {
    assert(
      typeof primaryDocumentPath === "string" &&
        normalizePublicPath(primaryDocumentPath) === primaryDocumentPath,
      `Primary document path must be root-relative and normalized: ${String(primaryDocumentPath)}`,
    );
    assert(
      precachePaths.includes(primaryDocumentPath),
      `Primary document is missing from precache: ${primaryDocumentPath}`,
    );
  }

  const [{ version }, template, precacheFiles] = await Promise.all([
    readFile(PACKAGE_PATH, "utf8").then(JSON.parse),
    readFile(TEMPLATE_PATH, "utf8"),
    validatePrecachePaths(precachePaths, { publishRoot }),
  ]);

  assert(version, "package.json must define a version");

  const revision = createCacheRevision({
    version,
    template,
    precacheFiles,
    precachePaths,
    primaryDocumentPaths,
  });
  let source = template;
  source = replaceQuotedPlaceholder(source, "__CACHE_PREFIX__", CACHE_PREFIX);
  source = replaceQuotedPlaceholder(source, "__CACHE_REVISION__", revision);
  source = replaceQuotedPlaceholder(source, "__OFFLINE_PATH__", OFFLINE_PATH);
  source = replaceQuotedPlaceholder(
    source,
    "__PRECACHE_PATHS__",
    precachePaths,
  );
  source = replaceQuotedPlaceholder(
    source,
    "__PRIMARY_DOCUMENT_PATHS__",
    primaryDocumentPaths,
  );
  source = await format(source, { parser: "babel" });

  const unresolvedPlaceholders = source.match(PLACEHOLDER_PATTERN) ?? [];
  assert(
    unresolvedPlaceholders.length === 0,
    `Unresolved service-worker placeholders: ${unresolvedPlaceholders.join(", ")}`,
  );

  return {
    cacheName: `${CACHE_PREFIX}${revision}`,
    precacheFiles,
    precachePaths,
    primaryDocumentPaths,
    publishRoot,
    revision,
    source,
  };
};

export const createViteServiceWorkerBuild = async (publishRoot = DIST_ROOT) => {
  const precachePaths = await createVitePrecachePaths(publishRoot);
  return createServiceWorkerBuild({
    publishRoot,
    precachePaths,
    primaryDocumentPaths: PUBLISHED_DOCUMENT_PATHS,
  });
};

const VITE_BUILD_ARGUMENT = "--vite";

const run = async () => {
  const argumentsList = process.argv.slice(2);
  assert(
    argumentsList.length === 0 ||
      (argumentsList.length === 1 && argumentsList[0] === VITE_BUILD_ARGUMENT),
    `Usage: node scripts/build-service-worker.mjs [${VITE_BUILD_ARGUMENT}]`,
  );

  const isViteBuild = argumentsList[0] === VITE_BUILD_ARGUMENT;
  const build = isViteBuild
    ? await createViteServiceWorkerBuild()
    : await createServiceWorkerBuild();
  const outputPath = isViteBuild ? DIST_OUTPUT_PATH : OUTPUT_PATH;
  await writeFile(outputPath, build.source, "utf8");

  const outputLabel = relative(ROOT, outputPath).split("\\").join("/");
  console.log(
    `Generated ${outputLabel} with cache ${build.cacheName} and ${build.precacheFiles.length} validated precache entries.`,
  );
};

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  run().catch((error) => {
    console.error(`Service-worker build failed: ${error.message}`);
    process.exitCode = 1;
  });
}
