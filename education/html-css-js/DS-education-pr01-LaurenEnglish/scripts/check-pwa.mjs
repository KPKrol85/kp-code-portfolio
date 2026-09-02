import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

import {
  DIST_OUTPUT_PATH,
  DIST_ROOT,
  OUTPUT_PATH,
  ROOT,
  TEMPLATE_PATH,
  createCacheRevision,
  createServiceWorkerBuild,
  createViteServiceWorkerBuild,
  discoverViteRuntimePaths,
} from "./build-service-worker.mjs";
import {
  BRAND_LOGO_PATH,
  CACHE_PREFIX,
  CRITICAL_ASSET_BUDGET,
  CSS_ENTRY_PATH,
  FONT_ASSETS,
  FONT_PATHS,
  HERO_IMAGE_PATH,
  JAVASCRIPT_ENTRY_PATH,
  MANIFEST_ICON_PATHS,
  MANIFEST_PATH,
  MANIFEST_SCREENSHOT_PATHS,
  OFFLINE_PATH,
  PRECACHE_PATHS,
  PUBLISHED_DOCUMENT_PATHS,
  PRIMARY_DOCUMENT_PATHS,
  RUNTIME_CSS_PATHS,
  RUNTIME_JAVASCRIPT_PATHS,
  SHORTCUT_ICON_PATHS,
  STATIC_PRECACHE_PATHS,
  THEME_ICON_PATHS,
  normalizePublicPath,
} from "./pwa-config.mjs";
import {
  CONTENT_IMAGE_ASSETS,
  MODERN_IMAGE_FORMATS,
  getImageCandidates,
  getImageSrcset,
} from "./image-config.mjs";
import { ALL_PAGES, INDEXABLE_PAGES, SITE } from "./site-config.mjs";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const VITE_MODE_ARGUMENT = "--vite";
const argumentsList = process.argv.slice(2);
assert(
  argumentsList.length === 0 ||
    (argumentsList.length === 1 && argumentsList[0] === VITE_MODE_ARGUMENT),
  `Usage: node scripts/check-pwa.mjs [${VITE_MODE_ARGUMENT}]`,
);

const isViteMode = argumentsList[0] === VITE_MODE_ARGUMENT;
const validationTarget = Object.freeze(
  isViteMode
    ? {
        label: "Vite PWA",
        publishRoot: DIST_ROOT,
        outputPath: DIST_OUTPUT_PATH,
        createBuild: createViteServiceWorkerBuild,
        rebuildCommand: "npm run build",
      }
    : {
        label: "PWA",
        publishRoot: ROOT,
        outputPath: OUTPUT_PATH,
        createBuild: createServiceWorkerBuild,
        rebuildCommand: "npm run build:sw",
      },
);

const countOccurrences = (source, value) => source.split(value).length - 1;
const readText = (path) => readFile(path, "utf8");
const publicFile = (path) => resolve(validationTarget.publishRoot, `.${path}`);
const sha256 = (buffer) =>
  createHash("sha256").update(buffer).digest("hex").toUpperCase();
const normalizeUnicodeRange = (unicodeRange) =>
  unicodeRange?.replace(/\s+/g, " ").trim() ?? "all";
const fontAssetKey = ({ family, style, weight, unicodeRange }) =>
  `${family}:${weight}:${style}:${normalizeUnicodeRange(unicodeRange)}`;

// License files are text, so a raw-byte hash would pin the checkout's newline
// rendering rather than the license itself. `latin1` maps bytes one-to-one, so
// this rewrites CRLF to LF without interpreting any other byte: every wording,
// whitespace and encoding difference still changes the hash.
const canonicalLicenseBytes = (buffer) =>
  Buffer.from(buffer.toString("latin1").replace(/\r\n/g, "\n"), "latin1");

const LITERATA_FONT_SHA256 =
  "DACE38D75534603D7B2E727E3A5979B6C53BEDB9DB9E14D4263EF92CFCB5F3D3";
// Hashed over the canonical LF form declared by `* text=auto eol=lf`, which is
// also how these files are stored in the Git index.
const PINNED_FONT_LICENSES = Object.freeze({
  "OFL-Inter.txt":
    "262481E844521B326F5ECD053E59B98C8B2DA78C8EE1BDBB6E8174305E54935A",
  "OFL-Literata.txt":
    "8742963604CD89DC81437811A850018FC03B2BFAD686D7422C8235967C87614E",
});
const DISTRIBUTED_FONT_LICENSES = Object.freeze({
  "inter-400.woff2": "OFL-Inter.txt",
  "inter-500.woff2": "OFL-Inter.txt",
  "inter-600.woff2": "OFL-Inter.txt",
  "inter-700.woff2": "OFL-Inter.txt",
  "inter-latin-ext.woff2": "OFL-Inter.txt",
  "literata-700.woff2": "OFL-Literata.txt",
});

const getAttribute = (tag, name) =>
  tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;

const getJpegDimensions = (buffer) => {
  assert(
    buffer[0] === 0xff && buffer[1] === 0xd8,
    `${HERO_IMAGE_PATH} is not a JPEG file`,
  );

  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const segmentLength = buffer.readUInt16BE(offset);
    if (startOfFrameMarkers.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }

  throw new Error(`Could not read JPEG dimensions for ${HERO_IMAGE_PATH}`);
};

const getPngDimensions = (buffer, path) => {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert(
    buffer.length >= 24 && buffer.subarray(0, 8).equals(pngSignature),
    `${path} is not a PNG file`,
  );
  assert(
    buffer.subarray(12, 16).toString("ascii") === "IHDR",
    `${path} does not begin with a PNG IHDR chunk`,
  );
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

const getDeclaredDimensions = (asset, label) => {
  const sizeMatch = asset.sizes?.match(/^(\d+)x(\d+)$/);
  assert(sizeMatch, `${label} has an invalid sizes value: ${asset.src}`);
  return { width: Number(sizeMatch[1]), height: Number(sizeMatch[2]) };
};

const getPictureSources = (html, fallbackPath) => {
  const pictures = html.match(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi) ?? [];
  const picture = pictures.find((candidate) =>
    new RegExp(
      `\\bsrc="${fallbackPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
    ).test(candidate),
  );
  assert(picture, `Missing picture element for ${fallbackPath}`);

  const sourceTags = picture.match(/<source\b[^>]*>/gi) ?? [];
  return sourceTags.map((source) => ({
    srcset: getAttribute(source, "srcset"),
    sizes: getAttribute(source, "sizes"),
    type: getAttribute(source, "type"),
  }));
};

const verifyModernImageAssets = async () => {
  for (const asset of CONTENT_IMAGE_ASSETS) {
    for (const { extension, mimeType } of MODERN_IMAGE_FORMATS) {
      for (const { path } of getImageCandidates(asset, extension)) {
        const buffer = await readFile(publicFile(path));
        const isWebp =
          extension === "webp" &&
          buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
          buffer.subarray(8, 12).toString("ascii") === "WEBP";
        const isAvif =
          extension === "avif" &&
          buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
          buffer.subarray(8, 32).includes(Buffer.from("avif"));
        assert(
          isWebp || isAvif,
          `${path} must be a valid ${mimeType} image file`,
        );
        if (asset.key === "homepage-hero") {
          assert(
            buffer.length <= CRITICAL_ASSET_BUDGET.maximumHeroImageBytes,
            `${path} is ${buffer.length} bytes; maximum is ${CRITICAL_ASSET_BUDGET.maximumHeroImageBytes} bytes`,
          );
          if (extension === "avif") {
            assert(
              buffer.length <= CRITICAL_ASSET_BUDGET.maximumHeroAvifTransferBytes,
              `${path} is ${buffer.length} bytes; maximum is ${CRITICAL_ASSET_BUDGET.maximumHeroAvifTransferBytes} bytes`,
            );
          }
        }
      }
    }
  }
};

const verifyPictureMarkup = async () => {
  const pages = await Promise.all([
    readText(resolve(ROOT, "index.html")),
    readText(resolve(ROOT, "kontakt.html")),
  ]);
  const html = pages.join("\n");

  for (const asset of CONTENT_IMAGE_ASSETS) {
    const sources = getPictureSources(html, asset.fallbackPath);
    assert(
      sources.length === MODERN_IMAGE_FORMATS.length,
      `${asset.fallbackPath} must provide AVIF and WebP picture sources`,
    );
    const expectedSources = MODERN_IMAGE_FORMATS.map(({ extension, mimeType }) => ({
      sizes: asset.sizes ?? null,
      srcset: getImageSrcset(asset, extension),
      type: mimeType,
    }));
    assert(
      sources.every((source, index) => {
        const expectedSource = expectedSources[index];
        return source.srcset === expectedSource.srcset &&
          source.sizes === expectedSource.sizes &&
          source.type === expectedSource.type;
      }),
      `${asset.fallbackPath} picture sources must use the configured AVIF then WebP order`,
    );
  }
};

const verifyPngAsset = async (asset, label) => {
  assert(
    typeof asset.src === "string" &&
      asset.src.startsWith("/") &&
      !asset.src.includes("?") &&
      !asset.src.includes("#"),
    `${label} path must be root-relative and normalized: ${asset.src}`,
  );
  assert(
    asset.type === "image/png" && extname(asset.src) === ".png",
    `${label} type does not match its PNG file: ${asset.src}`,
  );
  const declared = getDeclaredDimensions(asset, label);
  const buffer = await readFile(publicFile(asset.src));
  const actual = getPngDimensions(buffer, asset.src);
  assert(
    actual.width === declared.width && actual.height === declared.height,
    `${label} dimensions do not match ${asset.src}`,
  );
  return actual;
};

const assertUniquePaths = (paths, label) => {
  const duplicates = paths.filter(
    (path, index) => paths.indexOf(path) !== index,
  );
  assert(
    duplicates.length === 0,
    `${label} contains duplicate paths: ${[...new Set(duplicates)].join(", ")}`,
  );
};

const getMarkupImagePaths = (html) =>
  (html.match(/<(?:img|source)\b[^>]*>/gi) ?? [])
    .flatMap((tag) => [
      getAttribute(tag, "src"),
      ...(getAttribute(tag, "srcset")?.split(",") ?? []),
    ])
    .map((candidate) => candidate?.trim().split(/\s+/)[0] ?? "")
    .filter((path) => path.startsWith("/"));

// The precache is only as good as the resource the browser actually requests.
// Every candidate the precached documents can select must therefore resolve
// from the same precache, otherwise offline rendering depends on viewport,
// device density or format support instead of the cache contract.
const verifyOfflineDocumentImageCoverage = async (build) => {
  const documentPaths = build.precachePaths.filter((path) =>
    path.endsWith(".html"),
  );
  assert(
    documentPaths.length > 0,
    "Offline precache must contain published HTML documents",
  );

  const precachedPaths = new Set(build.precachePaths);
  const uncoveredReferences = new Set();
  for (const documentPath of documentPaths) {
    const html = await readText(publicFile(documentPath));
    for (const imagePath of getMarkupImagePaths(html)) {
      if (!precachedPaths.has(normalizePublicPath(imagePath))) {
        uncoveredReferences.add(`${documentPath} -> ${imagePath}`);
      }
    }
  }
  assert(
    uncoveredReferences.size === 0,
    `Precached documents reference images outside the offline precache: ${[...uncoveredReferences].join(", ")}`,
  );

  return documentPaths.length;
};

const getCssFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await getCssFiles(entryPath)));
    if (entry.isFile() && entry.name.endsWith(".css")) files.push(entryPath);
  }
  return files;
};

const verifyFontLicenseCoverage = async () => {
  const fontDirectory = resolve(ROOT, "assets/fonts");
  const distributedFontFiles = (
    await readdir(fontDirectory, {
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isFile() && extname(entry.name) === ".woff2")
    .map(({ name }) => name)
    .sort();
  const mappedFontFiles = Object.keys(DISTRIBUTED_FONT_LICENSES).sort();
  const unmappedFontFiles = distributedFontFiles.filter(
    (name) => !DISTRIBUTED_FONT_LICENSES[name],
  );
  const missingFontFiles = mappedFontFiles.filter(
    (name) => !distributedFontFiles.includes(name),
  );

  assert(
    unmappedFontFiles.length === 0,
    `Distributed font assets lack license evidence: ${unmappedFontFiles.join(", ")}`,
  );
  assert(
    missingFontFiles.length === 0,
    `Font-license mapping references missing assets: ${missingFontFiles.join(", ")}`,
  );

  const mappedLicenseFiles = [
    ...new Set(Object.values(DISTRIBUTED_FONT_LICENSES)),
  ].sort();
  assert(
    mappedLicenseFiles.join(",") ===
      Object.keys(PINNED_FONT_LICENSES).sort().join(","),
    "Pinned font-license artifacts must exactly match distributed font evidence",
  );

  for (const licenseFile of mappedLicenseFiles) {
    const coveredFontFiles = mappedFontFiles.filter(
      (fontFile) => DISTRIBUTED_FONT_LICENSES[fontFile] === licenseFile,
    );
    let licenseBuffer;
    try {
      licenseBuffer = await readFile(resolve(fontDirectory, licenseFile));
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(
          `${licenseFile} is required by font-license mapping for ${coveredFontFiles.join(", ")}`,
        );
      }
      throw error;
    }
    assert(
      sha256(canonicalLicenseBytes(licenseBuffer)) ===
        PINNED_FONT_LICENSES[licenseFile],
      `${licenseFile} must match the pinned official upstream license`,
    );
  }
};

const resolveRuntimeImport = (importer, specifier, label) => {
  assert(
    !/^(?:[a-z]+:|\/\/|\/)/i.test(specifier),
    `${label} must use a relative local import: ${specifier}`,
  );
  return new URL(specifier, `https://runtime.local${importer}`).pathname;
};

const collectRuntimeGraph = async (entryPath, type) => {
  const visited = new Set();

  const visit = async (publicPath) => {
    if (visited.has(publicPath)) return;
    visited.add(publicPath);
    const source = await readText(publicFile(publicPath));
    const specifiers =
      type === "css"
        ? [
            ...source.matchAll(
              /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/g,
            ),
          ].map((match) => match[1])
        : [
            ...source.matchAll(
              /(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g,
            ),
          ].map((match) => match[1]);

    for (const specifier of specifiers) {
      const importedPath = resolveRuntimeImport(
        publicPath,
        specifier,
        `${publicPath} ${type} import`,
      );
      assert(
        importedPath.endsWith(type === "css" ? ".css" : ".js"),
        `${publicPath} imports an unexpected runtime file: ${specifier}`,
      );
      await visit(importedPath);
    }
  };

  await visit(entryPath);
  return [...visited];
};

const assertExactRuntimeGraph = (actual, expected, label) => {
  assertUniquePaths(expected, `${label} configuration`);
  assert(
    [...actual].sort().join(",") === [...expected].sort().join(","),
    `${label} configuration does not match the browser import graph`,
  );
};

const verifyRuntimeAssetGraphs = async () => {
  const [cssGraph, javascriptGraph] = await Promise.all([
    collectRuntimeGraph(CSS_ENTRY_PATH, "css"),
    collectRuntimeGraph(JAVASCRIPT_ENTRY_PATH, "javascript"),
  ]);
  assertExactRuntimeGraph(cssGraph, RUNTIME_CSS_PATHS, "CSS runtime");
  assertExactRuntimeGraph(
    javascriptGraph,
    RUNTIME_JAVASCRIPT_PATHS,
    "JavaScript runtime",
  );
  return { cssGraph, javascriptGraph };
};

const verifyServiceWorker = async () => {
  const [firstBuild, secondBuild, generatedSource, template, packageJson] =
    await Promise.all([
      validationTarget.createBuild(),
      validationTarget.createBuild(),
      readText(validationTarget.outputPath),
      readText(TEMPLATE_PATH),
      readText(resolve(ROOT, "package.json")).then(JSON.parse),
    ]);

  assert(
    firstBuild.revision === secondBuild.revision &&
      firstBuild.source === secondBuild.source,
    "Identical PWA inputs must produce an identical cache revision and worker",
  );
  assert(
    generatedSource === firstBuild.source,
    `Generated ${validationTarget.label} service-worker.js is stale; run ${validationTarget.rebuildCommand}`,
  );
  assert(
    !/__[A-Z0-9_]+__/.test(generatedSource),
    "Generated service-worker.js contains an unresolved placeholder",
  );
  assert(
    CACHE_PREFIX === "lauren-english-v",
    "The cache prefix must remain stable and project-specific",
  );
  assert(
    firstBuild.revision.startsWith(`${packageJson.version}-`),
    "Generated cache revision must begin with the package version",
  );

  const changedFiles = firstBuild.precacheFiles.map((file, index) =>
    index === 0
      ? {
          ...file,
          content: Buffer.concat([file.content, Buffer.from("changed")]),
        }
      : file,
  );
  const changedRevision = createCacheRevision({
    version: packageJson.version,
    template,
    precacheFiles: changedFiles,
    precachePaths: firstBuild.precachePaths,
    primaryDocumentPaths: firstBuild.primaryDocumentPaths,
  });
  assert(
    changedRevision !== firstBuild.revision,
    "Changed precache content must produce a new cache revision",
  );

  const lifecycleRequirements = [
    'request.method === "GET"',
    '["http:", "https:"].includes(url.protocol)',
    "url.origin === self.location.origin",
    "response.ok",
    "response.status === 200",
    'response.type === "basic"',
    "!response.redirected",
    '!response.headers.has("Content-Range")',
    "cache.addAll(PRECACHE_PATHS)",
    "await self.skipWaiting()",
    "await self.clients.claim()",
    "await caches.delete(CACHE_NAME)",
    "cacheName.startsWith(CACHE_PREFIX)",
    "cacheName !== CACHE_NAME",
    "const handleNavigation = async (request)",
    "const response = await fetch(request)",
    'request.mode === "navigate"',
    "const cachedPrimary = isPrimaryDocument",
    "await cache.match(normalizedPath)",
    "await cache.match(OFFLINE_PATH)",
  ];
  for (const requirement of lifecycleRequirements) {
    assert(
      template.includes(requirement),
      `Service-worker lifecycle contract is missing: ${requirement}`,
    );
  }
  assert(
    !template.includes("keys.filter((key) => key !== CACHE_NAME)"),
    "Activation cleanup must not delete every unrelated cache",
  );
  assert(
    !template.includes('cache.match("/index.html")'),
    "The homepage must not be used as a generic offline fallback",
  );

  return firstBuild;
};

const verifyManifestAndIcons = async () => {
  const manifest = JSON.parse(await readText(publicFile(MANIFEST_PATH)));
  const requiredFields = [
    "name",
    "short_name",
    "description",
    "id",
    "start_url",
    "scope",
    "display",
    "theme_color",
    "background_color",
    "lang",
    "icons",
    "shortcuts",
    "screenshots",
  ];
  for (const field of requiredFields) {
    assert(manifest[field], `Manifest field is missing: ${field}`);
  }
  assert(manifest.name === SITE.name, "Manifest name must match the site name");
  assert(
    manifest.short_name === "Lauren English",
    "Manifest short_name must match the visible short brand name",
  );
  assert(
    typeof manifest.description === "string" && manifest.description.length > 0,
    "Manifest description must be useful and non-empty",
  );
  assert(manifest.id === "/", "Manifest id must identify the root application");
  assert(
    manifest.start_url === PRIMARY_DOCUMENT_PATHS[0],
    "Manifest start_url must use the production homepage path",
  );
  assert(manifest.scope === "/", "Manifest scope must cover public routes");
  assert(
    manifest.display === "standalone",
    "Manifest display must be standalone",
  );
  assert(manifest.lang === "pl", "Manifest language must be Polish");
  assert(
    manifest.theme_color === "#1b7f6c" &&
      manifest.background_color === "#f6f7f9",
    "Manifest colors must match the light-theme brand and page background",
  );

  const declaredSizes = new Set();
  for (const icon of manifest.icons) {
    assert(
      MANIFEST_ICON_PATHS.includes(icon.src),
      `Unexpected manifest icon path: ${icon.src}`,
    );
    assert(
      !icon.purpose?.split(/\s+/).includes("maskable"),
      `Maskable purpose requires a separately verified safe-zone icon: ${icon.src}`,
    );
    const dimensions = await verifyPngAsset(icon, "Manifest icon");
    declaredSizes.add(`${dimensions.width}x${dimensions.height}`);
  }
  assert(
    declaredSizes.has("192x192") && declaredSizes.has("512x512"),
    "Manifest requires verified 192x192 and 512x512 icons",
  );

  assert(
    manifest.shortcuts.length === 3,
    "Manifest must contain exactly three shortcuts",
  );
  const expectedShortcuts = [
    { key: "packages", name: "Pakiety nauki", shortName: "Pakiety" },
    {
      key: "materials",
      name: "Materiały do nauki",
      shortName: "Materiały",
    },
    {
      key: "progress",
      name: "Dziennik postępów",
      shortName: "Postępy",
    },
  ].map((expected) => ({
    ...expected,
    url: INDEXABLE_PAGES.find(({ key }) => key === expected.key)?.runtimePath,
  }));
  const shortcutIconPaths = [];
  const shortcutUrls = [];
  for (const shortcut of manifest.shortcuts) {
    const expected = expectedShortcuts.find(({ url }) => url === shortcut.url);
    assert(expected, `Unexpected manifest shortcut URL: ${shortcut.url}`);
    assert(
      shortcut.name === expected.name &&
        shortcut.short_name === expected.shortName,
      `Shortcut labels do not match ${shortcut.url}`,
    );
    assert(
      typeof shortcut.description === "string" &&
        shortcut.description.length > 0 &&
        shortcut.description.length <= 80,
      `Shortcut description must be concise and useful: ${shortcut.url}`,
    );
    assert(
      shortcut.icons?.length === 1,
      `Shortcut must declare one dedicated icon: ${shortcut.url}`,
    );
    const [icon] = shortcut.icons;
    const dimensions = await verifyPngAsset(icon, "Shortcut icon");
    assert(
      dimensions.width === dimensions.height && dimensions.width >= 192,
      `Shortcut icon must be square and at least 192px: ${icon.src}`,
    );
    await stat(publicFile(shortcut.url));
    shortcutIconPaths.push(icon.src);
    shortcutUrls.push(shortcut.url);
  }
  assertUniquePaths(shortcutUrls, "Manifest shortcuts");
  assert(
    shortcutIconPaths.sort().join(",") ===
      [...SHORTCUT_ICON_PATHS].sort().join(","),
    "Manifest shortcut icons must match the PWA asset contract",
  );

  assert(
    manifest.screenshots.length === 2,
    "Manifest must contain one wide and one narrow screenshot",
  );
  const screenshotPaths = [];
  const formFactors = new Set();
  for (const screenshot of manifest.screenshots) {
    const dimensions = await verifyPngAsset(screenshot, "Manifest screenshot");
    assert(
      typeof screenshot.label === "string" && screenshot.label.length > 0,
      `Manifest screenshot needs a concise label: ${screenshot.src}`,
    );
    assert(
      ["wide", "narrow"].includes(screenshot.form_factor),
      `Unexpected screenshot form_factor: ${screenshot.form_factor}`,
    );
    assert(
      screenshot.form_factor === "wide"
        ? dimensions.width > dimensions.height
        : dimensions.height > dimensions.width,
      `Screenshot orientation does not match ${screenshot.form_factor}: ${screenshot.src}`,
    );
    screenshotPaths.push(screenshot.src);
    formFactors.add(screenshot.form_factor);
  }
  assert(
    formFactors.size === 2 &&
      formFactors.has("wide") &&
      formFactors.has("narrow"),
    "Manifest screenshots require wide and narrow form factors",
  );
  assert(
    screenshotPaths.sort().join(",") ===
      [...MANIFEST_SCREENSHOT_PATHS].sort().join(","),
    "Manifest screenshots must match the PWA asset contract",
  );

  const manifestAssetPaths = [
    ...manifest.icons.map(({ src }) => src),
    ...shortcutIconPaths,
    ...screenshotPaths,
  ];
  assertUniquePaths(manifestAssetPaths, "Manifest assets");

  return manifest;
};

const verifyHeroAndFonts = async () => {
  const indexHtml = await readText(resolve(ROOT, "index.html"));
  const heroTags = indexHtml.match(
    /<img\b(?=[^>]*class="[^"]*\bhero__image\b)[^>]*>/gis,
  );
  assert(
    heroTags?.length === 1,
    "Homepage must contain one hero image element",
  );
  const heroTag = heroTags[0];
  const homepageHero = CONTENT_IMAGE_ASSETS.find(
    ({ key }) => key === "homepage-hero",
  );
  assert(homepageHero, "Homepage hero image configuration is missing");
  assert(
    getAttribute(heroTag, "src") === HERO_IMAGE_PATH,
    "Homepage hero must use the configured critical image",
  );
  assert(
    getAttribute(heroTag, "srcset") === getImageSrcset(homepageHero, "jpg") &&
      getAttribute(heroTag, "sizes") === homepageHero.sizes,
    "Homepage hero fallback candidates must match the configured responsive contract",
  );
  assert(
    getAttribute(heroTag, "loading") === "eager" &&
      getAttribute(heroTag, "loading") !== "lazy",
    "Homepage hero image must not be deferred",
  );
  assert(
    getAttribute(heroTag, "fetchpriority") === "high",
    "Homepage hero image must have high fetch priority",
  );
  assert(
    ["async", "sync"].includes(getAttribute(heroTag, "decoding")),
    "Homepage hero decoding behavior must be explicit",
  );

  const heroBuffer = await readFile(publicFile(HERO_IMAGE_PATH));
  const actualDimensions = getJpegDimensions(heroBuffer);
  const declaredDimensions = {
    width: Number(getAttribute(heroTag, "width")),
    height: Number(getAttribute(heroTag, "height")),
  };
  assert(
    declaredDimensions.width === actualDimensions.width &&
      declaredDimensions.height === actualDimensions.height,
    "Homepage hero width and height must match its intrinsic JPEG dimensions",
  );
  assert(
    heroBuffer.length <= CRITICAL_ASSET_BUDGET.maximumHeroImageBytes,
    `${HERO_IMAGE_PATH} is ${heroBuffer.length} bytes; maximum is ${CRITICAL_ASSET_BUDGET.maximumHeroImageBytes} bytes`,
  );

  await Promise.all([verifyModernImageAssets(), verifyPictureMarkup()]);

  const baseCss = await readText(resolve(ROOT, "css/base/base.css"));
  const fontFaces = baseCss.match(/@font-face\s*{[\s\S]*?}/g) ?? [];
  assert(
    fontFaces.length === FONT_ASSETS.length,
    `Expected ${FONT_ASSETS.length} justified local font faces`,
  );

  const expectedFonts = new Map(
    FONT_ASSETS.map((asset) => [fontAssetKey(asset), asset]),
  );
  const deliveredKeys = [];
  for (const fontFace of fontFaces) {
    const family = fontFace.match(/font-family:\s*"([^"]+)"/)?.[1];
    const weight = Number(fontFace.match(/font-weight:\s*(\d+)/)?.[1]);
    const style = fontFace.match(/font-style:\s*([\w-]+)/)?.[1];
    const source = fontFace.match(/url\("([^"]+)"\)/)?.[1];
    const unicodeRange = fontFace.match(/unicode-range:\s*([^;]+);/)?.[1];
    const key = fontAssetKey({ family, style, weight, unicodeRange });
    const expectedFont = expectedFonts.get(key);
    assert(
      expectedFont?.path === source,
      `Unexpected ${family} ${weight} ${style} source`,
    );
    assert(
      /font-display:\s*swap/.test(fontFace),
      `${family} ${weight} must use non-blocking font-display: swap`,
    );
    const fontBuffer = await readFile(publicFile(source));
    assert(
      fontBuffer.subarray(0, 4).toString("ascii") === "wOF2",
      `${source} must be a valid WOFF2 file`,
    );
    if (source === "/assets/fonts/literata-700.woff2") {
      assert(
        sha256(fontBuffer) === LITERATA_FONT_SHA256,
        "Literata 700 must match the pinned official upstream asset",
      );
    }
    deliveredKeys.push(key);
  }
  assert(
    deliveredKeys.sort().join(",") ===
      [...expectedFonts.keys()].sort().join(","),
    "Production typography must deliver exactly the configured local font faces",
  );
  assert(
    FONT_ASSETS.filter(({ family }) => family === "Inter")
      .map(({ weight }) => weight)
      .filter((weight, index, weights) => weights.indexOf(weight) === index)
      .sort((a, b) => a - b)
      .join(",") === "400,600,700",
    "Production typography must retain only Inter 400, 600, and 700",
  );
  assert(
    FONT_ASSETS.filter(({ family }) => family === "Literata")
      .map(({ weight }) => weight)
      .join(",") === "700",
    "Production typography must deliver only the justified Literata 700 face",
  );

  const cssFiles = await getCssFiles(resolve(ROOT, "css"));
  const sourceCss = (
    await Promise.all(cssFiles.map((file) => readText(file)))
  ).join("\n");
  const cssWithoutFontFaces = sourceCss.replace(/@font-face\s*{[\s\S]*?}/g, "");
  assert(
    !/font-weight:\s*500\b/.test(cssWithoutFontFaces),
    "Inter 500 is declared but not used by the production UI",
  );
  assert(
    /font-weight:\s*600\b/.test(cssWithoutFontFaces) &&
      /font-weight:\s*700\b/.test(cssWithoutFontFaces),
    "Inter 600 and 700 must remain justified by explicit production styles",
  );
  assert(
    sourceCss.includes('--font-family-heading: "Literata", serif;') &&
      sourceCss.includes('--font-family-body: "Inter", sans-serif;'),
    "Canonical heading and body font-family tokens are missing",
  );
  assert(
    /h1,\s*[\s\S]*?h6\s*{[\s\S]*?font-family:\s*var\(--font-family-heading\)/.test(
      sourceCss,
    ),
    "Semantic headings must use the heading font-family token",
  );
  assert(
    /body\s*{[\s\S]*?font-family:\s*var\(--font-family-body\)/.test(
      sourceCss,
    ) &&
      /button,\s*[\s\S]*?textarea\s*{[\s\S]*?font-family:\s*var\(--font-family-body\)/.test(
        sourceCss,
      ),
    "Body and interface controls must use the body font-family token",
  );
  assert(
    !/(?:fonts\.googleapis|fonts\.gstatic|https?:\/\/[^)'"\s]+\.(?:woff2?|ttf|otf))/i.test(
      sourceCss,
    ),
    "Production CSS must not request remote font assets",
  );

  const fontBytes = (
    await Promise.all(FONT_PATHS.map((path) => stat(publicFile(path))))
  ).reduce((total, fileStat) => total + fileStat.size, 0);
  assert(
    fontBytes <= CRITICAL_ASSET_BUDGET.maximumInitialFontBytes,
    `Initial font files exceed ${CRITICAL_ASSET_BUDGET.maximumInitialFontBytes} bytes`,
  );

  return { fontBytes, heroBytes: heroBuffer.length };
};

const verifyProductionAssetContract = async () => {
  const pageSources = await Promise.all(
    ALL_PAGES.map(async (page) => ({
      page,
      html: await readText(resolve(ROOT, page.file)),
    })),
  );
  const criticalHeadingFont = FONT_ASSETS.find(
    ({ family }) => family === "Literata",
  );
  assert(criticalHeadingFont, "A configured Literata heading font is required");
  for (const { page, html } of pageSources) {
    const manifestLinks =
      html.match(/<link\b(?=[^>]*\brel="manifest")[^>]*>/gi) ?? [];
    assert(
      manifestLinks.length === 1 &&
        getAttribute(manifestLinks[0], "href") === MANIFEST_PATH,
      `${page.file} must link exactly once to ${MANIFEST_PATH}`,
    );
    assert(
      countOccurrences(html, `href="${CSS_ENTRY_PATH}"`) === 1,
      `${page.file} must request the canonical CSS entry`,
    );
    assert(
      countOccurrences(
        html,
        `<script type="module" src="${JAVASCRIPT_ENTRY_PATH}"></script>`,
      ) === 1,
      `${page.file} must request the canonical JavaScript module entry`,
    );
    assert(
      !html.includes("/assets/build/"),
      `${page.file} must not request legacy assets/build files`,
    );
    const fontPreloads =
      html.match(
        /<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="font")[^>]*>/gi,
      ) ?? [];
    assert(
      fontPreloads.length === CRITICAL_ASSET_BUDGET.preloadedFontRequests,
      `${page.file} must preload exactly one justified critical heading font`,
    );
    const preload = fontPreloads[0];
    assert(
      getAttribute(preload, "href") === criticalHeadingFont.path &&
        getAttribute(preload, "type") === "font/woff2" &&
        /\bcrossorigin(?:\s|=|>)/i.test(preload),
      `${page.file} must preload only the local Literata 700 WOFF2 face with CORS`,
    );
  }
};

const verifyVitePrecacheContract = async (build) => {
  const runtimePaths = await discoverViteRuntimePaths(DIST_ROOT);
  const expectedPrecachePaths = [
    ...PUBLISHED_DOCUMENT_PATHS,
    ...runtimePaths,
    ...STATIC_PRECACHE_PATHS,
  ];

  assertUniquePaths(expectedPrecachePaths, "Vite precache contract");
  assert(
    PUBLISHED_DOCUMENT_PATHS.length === ALL_PAGES.length &&
      PUBLISHED_DOCUMENT_PATHS.every(
        (path, index) => path === `/${ALL_PAGES[index].file}`,
      ),
    "Vite published documents must match the complete site page registry",
  );
  assert(
    build.primaryDocumentPaths.join("\n") ===
      PUBLISHED_DOCUMENT_PATHS.join("\n"),
    "Vite known-document policy must contain all published HTML documents",
  );
  assert(
    build.precachePaths.join("\n") === expectedPrecachePaths.join("\n"),
    "Vite precache must exactly match published documents, discovered build assets, and canonical static assets",
  );
  assert(
    build.precacheFiles.map(({ publicPath }) => publicPath).join("\n") ===
      expectedPrecachePaths.join("\n"),
    "Vite precache entries must resolve to the exact generated publish files",
  );

  for (const path of build.precachePaths) {
    const url = new URL(path, "https://pwa.local");
    assert(
      path.startsWith("/") &&
        !path.startsWith("//") &&
        !path.includes("?") &&
        !path.includes("#") &&
        url.origin === "https://pwa.local" &&
        normalizePublicPath(path) === path,
      `Vite precache path must be normalized, root-relative, and same-origin compatible: ${path}`,
    );
  }

  assert(
    PUBLISHED_DOCUMENT_PATHS.includes(OFFLINE_PATH) &&
      PUBLISHED_DOCUMENT_PATHS.every((path) =>
        build.precachePaths.includes(path),
      ),
    "Vite precache must contain the offline page and all published documents",
  );
  assert(
    runtimePaths.every((path) => build.precachePaths.includes(path)),
    "Vite precache must contain every discovered hashed runtime asset",
  );
  assert(
    STATIC_PRECACHE_PATHS.every((path) => build.precachePaths.includes(path)),
    "Vite precache must contain every canonical static asset",
  );
  assert(
    MANIFEST_SCREENSHOT_PATHS.every(
      (path) => !build.precachePaths.includes(path),
    ),
    "Install screenshots must remain outside the Vite offline precache",
  );

  const forbiddenPaths = new Set([
    CSS_ENTRY_PATH,
    JAVASCRIPT_ENTRY_PATH,
    "/service-worker.js",
    "/service-worker.template.js",
    "/package.json",
  ]);
  const forbiddenPrefixes = [
    "/.vite-public/",
    "/assets/build/",
    "/assets/image-sources/",
    "/css/",
    "/js/",
    "/scripts/",
  ];
  const forbiddenEntries = build.precachePaths.filter(
    (path) =>
      forbiddenPaths.has(path) ||
      forbiddenPrefixes.some((prefix) => path.startsWith(prefix)) ||
      path.endsWith(".map"),
  );
  assert(
    forbiddenEntries.length === 0,
    `Vite precache contains source, generated-worker, or development-only paths: ${forbiddenEntries.join(", ")}`,
  );

  return runtimePaths;
};

const runRoot = async () => {
  const [build, manifest, criticalAssets, , runtimeGraphs] = await Promise.all([
    verifyServiceWorker(),
    verifyManifestAndIcons(),
    verifyHeroAndFonts(),
    verifyProductionAssetContract(),
    verifyRuntimeAssetGraphs(),
    verifyFontLicenseCoverage(),
  ]);

  assert(
    PRECACHE_PATHS.includes(OFFLINE_PATH) &&
      PRIMARY_DOCUMENT_PATHS.every((path) => PRECACHE_PATHS.includes(path)),
    "Precache must contain the offline page and every primary document",
  );
  assert(
    PRECACHE_PATHS.includes(BRAND_LOGO_PATH),
    "Precache must contain the shared brand logo",
  );
  assert(
    THEME_ICON_PATHS.every((path) => PRECACHE_PATHS.includes(path)),
    "Precache must contain the shared theme icons",
  );
  assert(
    PRECACHE_PATHS.includes(MANIFEST_PATH) &&
      MANIFEST_ICON_PATHS.every((path) => PRECACHE_PATHS.includes(path)) &&
      SHORTCUT_ICON_PATHS.every((path) => PRECACHE_PATHS.includes(path)),
    "Precache must contain the manifest and all install and shortcut icons",
  );
  assert(
    MANIFEST_SCREENSHOT_PATHS.every((path) => !PRECACHE_PATHS.includes(path)),
    "Install screenshots must remain outside the offline runtime precache",
  );
  assert(
    [...RUNTIME_CSS_PATHS, ...RUNTIME_JAVASCRIPT_PATHS].every((path) =>
      PRECACHE_PATHS.includes(path),
    ),
    "Precache must contain the complete direct CSS and JavaScript runtime graph",
  );
  assert(
    PRECACHE_PATHS.every((path) => !path.startsWith("/assets/build/")),
    "Legacy assets/build files must remain outside the runtime precache",
  );
  assert(
    INDEXABLE_PAGES.length === PRIMARY_DOCUMENT_PATHS.length,
    "PWA primary-document policy must match the site route registry",
  );
  await verifyOfflineDocumentImageCoverage(build);

  console.log(
    `Verified PWA cache ${build.cacheName}, ${PRECACHE_PATHS.length} precache entries, ${runtimeGraphs.cssGraph.length} CSS files, ${runtimeGraphs.javascriptGraph.length} JavaScript modules, ${manifest.icons.length} install icons, ${manifest.shortcuts.length} shortcuts, ${manifest.screenshots.length} screenshots, hero ${criticalAssets.heroBytes} bytes, and ${FONT_PATHS.length} fonts totaling ${criticalAssets.fontBytes} bytes.`,
  );
};

const runVite = async () => {
  const [build, manifest] = await Promise.all([
    verifyServiceWorker(),
    verifyManifestAndIcons(),
  ]);
  const runtimePaths = await verifyVitePrecacheContract(build);
  const offlineDocumentCount = await verifyOfflineDocumentImageCoverage(build);
  assert(
    offlineDocumentCount === PUBLISHED_DOCUMENT_PATHS.length,
    "Offline image coverage must be verified for every published document",
  );

  console.log(
    `Verified Vite PWA cache ${build.cacheName}, ${build.precachePaths.length} precache entries, ${build.primaryDocumentPaths.length} published documents, ${runtimePaths.length} hashed runtime assets, ${manifest.icons.length} install icons, ${manifest.shortcuts.length} shortcuts, and ${manifest.screenshots.length} screenshots.`,
  );
};

const run = isViteMode ? runVite : runRoot;

run().catch((error) => {
  console.error(`${validationTarget.label} check failed: ${error.message}`);
  process.exitCode = 1;
});
