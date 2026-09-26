const fs = require("node:fs");
const path = require("node:path");

const {
  rootDir, distDir, htmlPages, rootFiles, assetEntries,
  composePage, productionHtml, productionWorker,
} = require("./build-config.js");

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
  // Check the complete copy inventory and compose every page before replacing the previous package.
  [...htmlPages, ...rootFiles, ...assetEntries].forEach(assertSourceExists);
  const pages = htmlPages.map((page) => [page, productionHtml(composePage(page))]);
  fs.rmSync(distDir, { recursive: true, force: true });
  ["css", "js"].forEach((directory) =>
    fs.mkdirSync(path.join(distDir, directory), { recursive: true }),
  );

  [...rootFiles, ...assetEntries].forEach(copyEntry);
  pages.forEach(([page, html]) => fs.writeFileSync(path.join(distDir, page), html));
  const worker = fs.readFileSync(path.join(rootDir, "sw.js"), "utf8");
  fs.writeFileSync(path.join(distDir, "sw.js"), productionWorker(worker));

  console.log("Production structure with composed pages prepared in dist/; CSS and JS builds follow.");
}

buildDist();
