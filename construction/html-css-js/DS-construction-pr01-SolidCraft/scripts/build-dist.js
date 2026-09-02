const fs = require("fs/promises");
const path = require("path");
const { createLogger } = require("./utils/logger");
const { PARTIALS_DIR_NAME, renderHtmlFile } = require("./utils/partials");

const logger = createLogger();

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

const EXCLUDED_TOP_LEVEL_DIRS = new Set([
  ".git",
  ".claude",
  ".codex",
  ".lighthouse-reports",
  "node_modules",
  "dist",
  PARTIALS_DIR_NAME,
]);

/* sitemap.xml and sw.js are deliberately absent: dist/sitemap.xml is produced
   by scripts/generate-sitemap.mjs in the build:sitemap step and dist/sw.js by
   scripts/generate-sw.js in the build:sw step, both of which follow, so
   staging a copy here would only be overwritten. js/sw-register.js is not
   generated and is still copied verbatim. */
const OPTIONAL_FILES = [
  "_headers",
  "_redirects",
  "netlify.toml",
  "robots.txt",
  "manifest.webmanifest",
  "js/sw-register.js",
];
const OPTIONAL_DIRS = ["assets"];

async function pathExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function copyFileByRelativePath(relPath) {
  const src = path.join(rootDir, relPath);
  const dest = path.join(distDir, relPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

/* Stages one maintained page with its shared header/footer already expanded,
   so dist/ only ever contains complete standalone HTML documents. */
async function renderHtmlFileToDist(relPath) {
  const src = path.join(rootDir, relPath);
  const dest = path.join(distDir, relPath);
  const { html, partials } = await renderHtmlFile(src, { rootDir });
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, html, "utf8");
  return partials;
}

async function listHtmlFilesRecursively(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const results = [];
  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, absPath);
    const topLevel = relPath.split(path.sep)[0];

    if (entry.isDirectory()) {
      if (EXCLUDED_TOP_LEVEL_DIRS.has(topLevel)) continue;
      const nested = await listHtmlFilesRecursively(absPath);
      results.push(...nested);
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".html") {
      results.push(relPath);
    }
  }

  return results;
}

async function copyDirRecursive(
  srcDir,
  destDir,
  { skipRelDirNames = new Set() } = {},
) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    const relPath = path.relative(rootDir, srcPath);

    if (entry.isDirectory()) {
      const relNorm = relPath.split(path.sep).join("/");
      const dirName = path.basename(srcPath);
      if (skipRelDirNames.has(relNorm) || skipRelDirNames.has(dirName))
        continue;

      await fs.mkdir(destPath, { recursive: true });
      await copyDirRecursive(srcPath, destPath, { skipRelDirNames });
      continue;
    }

    if (entry.isFile()) {
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function copyRuntimeFilesToDist() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  const htmlFiles = await listHtmlFilesRecursively(rootDir);
  logger.debug(`build-dist: discovered ${htmlFiles.length} HTML file(s)`);

  const usedPartials = new Set();
  for (const relPath of htmlFiles) {
    for (const partial of await renderHtmlFileToDist(relPath)) {
      usedPartials.add(partial);
    }
  }
  logger.debug(
    `build-dist: rendered ${usedPartials.size} shared partial(s): ${[...usedPartials].sort().join(", ") || "none"}`,
  );

  for (const relPath of OPTIONAL_FILES) {
    const absPath = path.join(rootDir, relPath);
    if (await pathExists(absPath)) {
      await copyFileByRelativePath(relPath);
    }
  }

  for (const relDir of OPTIONAL_DIRS) {
    const srcDir = path.join(rootDir, relDir);
    if (!(await pathExists(srcDir))) continue;

    const destDir = path.join(distDir, relDir);
    await fs.mkdir(destDir, { recursive: true });
    await copyDirRecursive(srcDir, destDir, {
      skipRelDirNames: new Set(["img-src"]),
    });
  }

  return htmlFiles.length;
}

async function rewriteHtmlReferencesInDist(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  let rewrittenCount = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      rewrittenCount += await rewriteHtmlReferencesInDist(fullPath);
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".html") {
      continue;
    }

    const html = await fs.readFile(fullPath, "utf8");
    const updatedHtml = html
      .replaceAll("css/style.css", "css/style.min.css")
      .replaceAll("js/script.js", "js/script.min.js")
      .replaceAll("js/theme-init.js", "js/theme-init.min.js");

    if (updatedHtml !== html) {
      await fs.writeFile(fullPath, updatedHtml, "utf8");
      rewrittenCount += 1;
    }
  }

  return rewrittenCount;
}

async function build() {
  logger.debug("build-dist: start");
  const renderedCount = await copyRuntimeFilesToDist();
  const rewrittenCount = await rewriteHtmlReferencesInDist(distDir);
  logger.summary(
    `OK: dist staged (rendered ${renderedCount} HTML file(s) from source + ${PARTIALS_DIR_NAME}/, rewrote ${rewrittenCount}); production CSS/JS are generated into dist/ by "npm run build".`,
  );
}

build().catch((error) => {
  logger.error("FAIL: dist staging failed.");
  logger.error(error.stack || String(error));
  process.exit(1);
});
