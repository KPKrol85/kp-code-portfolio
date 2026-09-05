import fs from "node:fs/promises";
import path from "node:path";

import {
  HEADERS_FILENAME,
  applyProductionHeaderRules,
  findHeaderPolicyViolations,
  readBundleManifest,
} from "./bundle-names.mjs";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

// Copied into dist/ file by file, each one keeping its path. The root entries
// are the deployment's own pages and metadata; the two js/ entries are the only
// canonical source files a production page still requests by name after the
// HTML rewrite below, so they are named here individually rather than reached
// by copying their directory.
const filesToCopy = [
  "index.html",
  "404.html",
  "offline.html",
  "success.html",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "_headers",
  "LICENSE",
  // Loaded synchronously by every maintained page before the application
  // bundle, so the stored theme is applied before the first paint.
  path.join("js", "theme-init.js"),
  // Loaded by offline.html for retry and online recovery, and precached by the
  // production service worker.
  path.join("js", "offline.js"),
];

// Copied recursively, whole. css/ and js/ are deliberately not here: the
// stylesheet layers and the js/main.js module graph reach production only as
// the content-addressed bundles build:hash named, so publishing either source
// tree would ship a second, unreferenced copy of the same code.
const dirsToCopy = ["assets", "services", "legal"];

const htmlFiles = [
  "index.html",
  "404.html",
  "offline.html",
  "success.html",
  path.join("services", "*.html"),
  path.join("legal", "*.html"),
];

const toPosix = (value) => value.split(path.sep).join("/");

const ensureDir = async (targetPath) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
};

const copyFile = async (from, to) => {
  await ensureDir(to);
  await fs.copyFile(from, to);
};

const copyDirRecursive = async (fromDir, toDir) => {
  const entries = await fs.readdir(fromDir, { withFileTypes: true });

  for (const entry of entries) {
    const from = path.join(fromDir, entry.name);
    const to = path.join(toDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(from, to);
      continue;
    }

    await copyFile(from, to);
  }
};

const collectHtmlFiles = async () => {
  const files = [];

  for (const pattern of htmlFiles) {
    if (!pattern.includes("*")) {
      files.push(pattern);
      continue;
    }

    const [dirName] = pattern.split(path.sep + "*");
    const absoluteDir = path.join(rootDir, dirName);
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });

    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
      .forEach((entry) => files.push(path.join(dirName, entry.name)));
  }

  return files;
};

// A production page must not keep pointing at a maintained source bundle or at
// a fixed production bundle name. None of these is a substring of a hashed
// production filename - `style.<hash>.min.css` does not contain
// "style.min.css" - and none matches `js/theme-init.js`, which production pages
// load directly and this build deliberately leaves alone.
const forbiddenProductionReferences = [
  "css/main.css",
  "js/main.js",
  "style.min.css",
  "script.min.js",
];

const rewriteHtmlForDist = async (bundles) => {
  const files = await collectHtmlFiles();

  for (const relativeFile of files) {
    const htmlPath = path.join(distDir, relativeFile);
    let html = await fs.readFile(htmlPath, "utf8");

    // Both path forms the maintained pages use: root-level for the pages at the
    // deployment root, `../`-prefixed for services/ and legal/. The bundles
    // themselves stay at the deployment root, which is what the @font-face URLs
    // inlined into the CSS bundle resolve against.
    html = html
      .replaceAll("href=\"css/main.css\"", `href="${bundles.css}"`)
      .replaceAll("href=\"../css/main.css\"", `href="../${bundles.css}"`)
      .replaceAll("src=\"js/main.js\" type=\"module\"", `src="${bundles.js}"`)
      .replaceAll("src=\"../js/main.js\" type=\"module\"", `src="../${bundles.js}"`);

    const stale = forbiddenProductionReferences.filter((reference) => html.includes(reference));

    if (stale.length > 0) {
      throw new Error(
        `dist/${toPosix(relativeFile)} still references ${stale.join(", ")} after the production rewrite.`,
      );
    }

    const missing = [bundles.css, bundles.js].filter((file) => !html.includes(file));

    if (missing.length > 0) {
      throw new Error(
        `dist/${toPosix(relativeFile)} does not reference ${missing.join(", ")} after the production rewrite.`,
      );
    }

    await fs.writeFile(htmlPath, html, "utf8");
  }
};

// Rewrites the copied deployment headers so the content-addressed bundles this
// build produced get long-lived immutable caching under their exact URLs. Only
// the marked block changes; every security header and every other cache rule in
// the canonical file is copied through untouched. The paths come from the
// validated manifest, so this script never constructs a hashed filename.
const writeProductionHeaders = async (bundles) => {
  const headersPath = path.join(distDir, HEADERS_FILENAME);
  const label = `dist/${HEADERS_FILENAME}`;
  const canonical = await fs.readFile(headersPath, "utf8");
  const generated = applyProductionHeaderRules(canonical, bundles, label);

  const problems = findHeaderPolicyViolations(generated, { label, bundles });

  if (problems.length > 0) {
    throw new Error(`Generated ${label} violates the cache policy:\n  ${problems.join("\n  ")}`);
  }

  await fs.writeFile(headersPath, generated, "utf8");
};

// Read before anything is copied, so a missing or invalid manifest stops the
// release build before it writes a dist/ tree whose HTML could not be rewritten.
const bundles = await readBundleManifest(distDir);

for (const file of filesToCopy) {
  await copyFile(path.join(rootDir, file), path.join(distDir, file));
}

for (const dir of dirsToCopy) {
  await copyDirRecursive(path.join(rootDir, dir), path.join(distDir, dir));
}

await rewriteHtmlForDist(bundles);
await writeProductionHeaders(bundles);

console.log(
  `Dist assets copied and HTML references rewritten to ${bundles.css} and ${bundles.js}.`,
);
console.log(`Generated immutable cache rules in dist/${HEADERS_FILENAME} for both bundles.`);
