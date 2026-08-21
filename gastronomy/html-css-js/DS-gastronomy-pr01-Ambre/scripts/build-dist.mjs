import { mkdir, readFile, rm, writeFile, copyFile, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import postcss from "postcss";
import * as esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const require = createRequire(import.meta.url);
const postcssConfig = require(path.join(rootDir, "postcss.config.cjs"));

const htmlFiles = [
  "index.html",
  "menu.html",
  "galeria.html",
  "cookies.html",
  "polityka-prywatnosci.html",
  "regulamin.html",
  "404.html",
  "offline.html",
];

const staticFiles = [
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "_headers",
  "_redirects",
];

const runtimeFiles = [
  "js/sw-register.js",
  "js/pwa-install.js",
];

const staticDirectories = ["assets"];

function resolveFromRoot(...segments) {
  return path.join(rootDir, ...segments);
}

function resolveFromDist(...segments) {
  return path.join(distDir, ...segments);
}

async function ensureDirectory(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function copyRelativeFile(relativePath) {
  const sourcePath = resolveFromRoot(relativePath);
  const targetPath = resolveFromDist(relativePath);

  await ensureDirectory(path.dirname(targetPath));
  await copyFile(sourcePath, targetPath);
}

async function copyRelativeDirectory(relativePath) {
  const sourcePath = resolveFromRoot(relativePath);
  const targetPath = resolveFromDist(relativePath);

  await cp(sourcePath, targetPath, { recursive: true });
}

async function buildCss() {
  const sourcePath = resolveFromRoot("css", "style.css");
  const targetPath = resolveFromDist("css", "style.min.css");
  const sourceCss = await readFile(sourcePath, "utf8");

  const result = await postcss(postcssConfig.plugins).process(sourceCss, {
    from: sourcePath,
    to: targetPath,
    map: false,
  });

  if (/@import/i.test(result.css)) {
    throw new Error("Found @import in dist/css/style.min.css");
  }

  await writeFile(targetPath, result.css);
}

async function buildJs() {
  const sourcePath = resolveFromRoot("js", "script.js");
  const targetPath = resolveFromDist("js", "script.min.js");

  await esbuild.build({
    entryPoints: [sourcePath],
    bundle: true,
    minify: true,
    target: ["es2018"],
    outfile: targetPath,
    logLevel: "warning",
  });

  const bundledJs = await readFile(targetPath, "utf8");
  if (/\bimport\s|from\s+["']\.\/modules\//.test(bundledJs)) {
    throw new Error("Found import syntax in dist/js/script.min.js");
  }
}

async function buildServiceWorker() {
  const sourcePath = resolveFromRoot("sw.js");
  const targetPath = resolveFromDist("sw.js");
  const sourceSw = await readFile(sourcePath, "utf8");

  const builtSw = sourceSw
    .replace('"/css/style.css"', '"/css/style.min.css"')
    .replace('"/js/script.js"', '"/js/script.min.js"');

  if (builtSw.includes('"/css/style.css"') || builtSw.includes('"/js/script.js"')) {
    throw new Error("dist/sw.js still references source CSS or JS assets");
  }

  await writeFile(targetPath, builtSw);
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await Promise.all([
    ensureDirectory(distDir),
    ensureDirectory(resolveFromDist("css")),
    ensureDirectory(resolveFromDist("js")),
  ]);

  await buildCss();
  await buildJs();

  await Promise.all(htmlFiles.map(copyRelativeFile));
  await Promise.all(staticFiles.map(copyRelativeFile));
  await Promise.all(runtimeFiles.map(copyRelativeFile));
  await Promise.all(staticDirectories.map(copyRelativeDirectory));

  await buildServiceWorker();

  console.log("dist build complete");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
