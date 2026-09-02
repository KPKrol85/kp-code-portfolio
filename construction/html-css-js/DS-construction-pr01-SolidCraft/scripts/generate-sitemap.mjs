import { promises as fs } from "node:fs";
import path from "node:path";

import partials from "./utils/partials.js";

const { PARTIALS_DIR_NAME } = partials;

const rootDir = process.cwd();
const publishDir = path.join(rootDir, "dist");

const EXCLUDED_DIRS = new Set([".git", ".claude", ".codex", ".lighthouse-reports", "node_modules", "dist", "build", PARTIALS_DIR_NAME]);
const EXCLUDED_FILES = new Set(["404.html", "offline.html", "thank-you.html"]);
const EXCLUDED_PREFIXES = [];

function normalizeSlashes(value) {
  return value.split(path.sep).join("/");
}

function shouldExclude(relativePath) {
  const normalized = normalizeSlashes(relativePath);
  const filename = path.posix.basename(normalized);

  if (EXCLUDED_FILES.has(filename)) {
    return true;
  }

  return EXCLUDED_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

async function listHtmlFiles(dir, collector = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, absPath);

    if (entry.isDirectory()) {
      const topLevel = relPath.split(path.sep)[0];
      if (EXCLUDED_DIRS.has(topLevel)) {
        continue;
      }

      await listHtmlFiles(absPath, collector);
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".html") {
      continue;
    }

    if (shouldExclude(relPath)) {
      continue;
    }

    collector.push(normalizeSlashes(relPath));
  }

  return collector;
}

function buildPageUrl(siteUrl, relHtmlPath) {
  if (relHtmlPath === "index.html") {
    return new URL("/", siteUrl).toString();
  }

  return new URL(`/${relHtmlPath}`, siteUrl).toString();
}

function renderSitemap(urls) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

  for (const url of urls) {
    lines.push("  <url>");
    lines.push(`    <loc>${url}</loc>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>", "");
  return lines.join("\n");
}

function getOutputPath() {
  return path.join(publishDir, "sitemap.xml");
}

async function main() {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    console.error("FAIL: SITE_URL is required. Example: SITE_URL=https://example.com npm run build:sitemap");
    process.exit(1);
  }

  const htmlFiles = await listHtmlFiles(rootDir);
  const uniqueFiles = [...new Set(htmlFiles)].sort((a, b) => a.localeCompare(b));

  const urls = uniqueFiles.map((file) => buildPageUrl(siteUrl, file));
  const sitemap = renderSitemap(urls);

  const outputPath = getOutputPath();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, sitemap, "utf8");

  const outRelPath = normalizeSlashes(path.relative(rootDir, outputPath));
  console.log(`OK: sitemap generated with ${urls.length} URL(s) -> ${outRelPath}`);
}

main().catch((error) => {
  console.error("FAIL: sitemap generation failed.");
  console.error(error.stack || String(error));
  process.exit(1);
});
