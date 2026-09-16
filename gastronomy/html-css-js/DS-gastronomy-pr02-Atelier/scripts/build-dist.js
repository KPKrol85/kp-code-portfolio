const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

const htmlPages = [
  "index.html",
  "about.html",
  "menu.html",
  "gallery.html",
  "contact.html",
  "cookies.html",
  "polityka-prywatnosci.html",
  "regulamin.html",
  "offline.html",
  "thank-you.html",
  "404.html",
];

const rootFiles = [
  ...htmlPages,
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "sw.js",
  "_headers",
  "_redirects",
];

const assetEntries = [
  "css/style.min.css",
  "js/script.min.js",
  "js/core.min.js",
  "data/menu.json",
  "assets/docs",
  "assets/fonts",
  "assets/icons",
  "assets/img-optimized",
];

function assertSourceExists(relativePath) {
  const sourcePath = path.join(rootDir, relativePath);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required production file: ${relativePath}`);
  }

  return sourcePath;
}

function copyEntry(relativePath) {
  const sourcePath = assertSourceExists(relativePath);
  const targetPath = path.join(distDir, relativePath);
  const sourceStats = fs.statSync(sourcePath);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  if (sourceStats.isDirectory()) {
    fs.cpSync(sourcePath, targetPath, { recursive: true });
    return;
  }

  fs.copyFileSync(sourcePath, targetPath);
}

function buildDist() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  [...rootFiles, ...assetEntries].forEach(copyEntry);

  console.log(`Dist build complete: ${path.relative(rootDir, distDir)}`);
}

buildDist();
