import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_PAGES } from "./site-config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_ROOT = resolve(ROOT, "dist");
const BUILD_ROOT = resolve(DIST_ROOT, "build");

const REQUIRED_ROOT_FILES = ["site.webmanifest", "sitemap.xml", "robots.txt", "_redirects"];

const REQUIRED_ASSET_DIRECTORIES = ["favicon", "fonts", "icons", "img", "og", "pwa"];

const FORBIDDEN_OUTPUT_PATHS = ["css", "js", "assets/build", "assets/image-sources"];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const getSrcsetReferences = (html) =>
  [...html.matchAll(/\bsrcset=["']([^"']+)["']/g)].flatMap((match) =>
    match[1]
      .split(",")
      .map((candidate) => candidate.trim().split(/\s+/)[0])
      .filter(Boolean),
  );

const getStats = async (path) => {
  try {
    return await stat(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const assertFile = async (path, message) => {
  const stats = await getStats(path);
  assert(stats?.isFile(), message);
};

const assertDirectory = async (path, message) => {
  const stats = await getStats(path);
  assert(stats?.isDirectory(), message);
};

const getRuntimeReferences = (html) => [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map((match) => match[1]);

await assertDirectory(DIST_ROOT, "Vite publish directory is missing; run npm run build");

await assertDirectory(BUILD_ROOT, "Vite build asset directory is missing from dist/build");

const distEntries = await readdir(DIST_ROOT, {
  withFileTypes: true,
});

const builtPageFiles = distEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
  .map((entry) => entry.name)
  .sort();

const expectedPageFiles = ALL_PAGES.map((page) => page.file).sort();

assert(JSON.stringify(builtPageFiles) === JSON.stringify(expectedPageFiles), `Built HTML pages do not match ALL_PAGES. Expected: ${expectedPageFiles.join(", ")}. Found: ${builtPageFiles.join(", ")}`);

const buildEntries = await readdir(BUILD_ROOT, {
  withFileTypes: true,
});

const buildFiles = buildEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);

const cssBundles = buildFiles.filter((file) => /^main-[\w-]+\.css$/.test(file));

const javascriptBundles = buildFiles.filter((file) => /^main-[\w-]+\.js$/.test(file));

assert(cssBundles.length === 1, `Expected one hashed Vite CSS bundle, found ${cssBundles.length}`);

assert(javascriptBundles.length === 1, `Expected one hashed Vite JavaScript bundle, found ${javascriptBundles.length}`);

const cssRuntimePath = `/build/${cssBundles[0]}`;
const javascriptRuntimePath = `/build/${javascriptBundles[0]}`;

const builtPages = await Promise.all(
  ALL_PAGES.map(async (page) => ({
    file: page.file,
    html: await readFile(resolve(DIST_ROOT, page.file), "utf8"),
  })),
);

for (const page of builtPages) {
  const runtimeReferences = getRuntimeReferences(page.html);
  const srcsetReferences = getSrcsetReferences(page.html);

  assert(runtimeReferences.includes(cssRuntimePath), `${page.file}: Vite-generated CSS bundle is missing`);

  assert(runtimeReferences.includes(javascriptRuntimePath), `${page.file}: Vite-generated JavaScript bundle is missing`);

  assert(runtimeReferences.includes("/site.webmanifest"), `${page.file}: fixed site.webmanifest reference is missing`);

  assert(!runtimeReferences.includes("/css/style.css"), `${page.file}: direct canonical CSS reference remains active`);

  assert(!runtimeReferences.includes("/js/main.js"), `${page.file}: direct canonical JavaScript reference remains active`);

  assert(!runtimeReferences.some((path) => path.startsWith("/assets/build/")), `${page.file}: legacy assets/build reference remains active`);

  assert(!srcsetReferences.some((path) => path.startsWith("/assets/image-sources/")), `${page.file}: canonical image source appears in a responsive source set`);
}

for (const file of REQUIRED_ROOT_FILES) {
  await assertFile(resolve(DIST_ROOT, file), `Required publish file is missing: ${file}`);
}

for (const directory of REQUIRED_ASSET_DIRECTORIES) {
  await assertDirectory(resolve(DIST_ROOT, "assets", directory), `Required runtime asset directory is missing: assets/${directory}`);
}

for (const outputPath of FORBIDDEN_OUTPUT_PATHS) {
  const stats = await getStats(resolve(DIST_ROOT, ...outputPath.split("/")));

  assert(stats === null, `Forbidden production output remains active: ${outputPath}`);
}

assert(!buildFiles.some((file) => /^site-[\w-]+\.webmanifest$/.test(file)), "A hashed manifest remains inside dist/build");

console.log(
  `Verified Vite production asset graph for ${builtPageFiles.length} HTML pages: one hashed CSS bundle, one hashed JavaScript bundle, required publish assets present, and no direct-source or legacy production contracts.`,
);
