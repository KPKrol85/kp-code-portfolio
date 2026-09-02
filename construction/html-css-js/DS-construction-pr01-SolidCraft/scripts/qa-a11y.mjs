#!/usr/bin/env node

import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveContentType } from "./utils/mime-types.mjs";
import partials from "./utils/partials.js";

const { renderHtmlFile } = partials;

const projectRoot = process.cwd();
const thresholds = {
  failOnImpacts: new Set(["serious", "critical"]),
};

// Required routes: the entry and error pages plus every maintained oferta/
// service page and root-level legal page, so each shipped page variant is
// scanned. A missing entry fails the run instead of silently shrinking the
// gate.
const basePages = [
  "/index.html",
  "/404.html",
  "/oferta/elektryka.html",
  "/oferta/hydraulika.html",
  "/oferta/kafelkowanie.html",
  "/oferta/lazienki.html",
  "/oferta/malowanie.html",
  "/oferta/remonty.html",
  "/cookies.html",
  "/polityka-prywatnosci.html",
  "/regulamin.html",
];

const optionalPages = ["/offline.html"];

const { chromium } = await loadDependency("playwright");
const axeCoreModule = await loadDependency("axe-core");
const axeCore = axeCoreModule.default ?? axeCoreModule;

const pages = await resolvePages();
const server = await startStaticServer();
const browser = await chromium.launch({ headless: true });
const failures = [];
const scannedPages = [];

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const route of pages) {
    const url = `http://127.0.0.1:${server.port}${route}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.addScriptTag({ content: axeCore.source });

    const result = await page.evaluate(async () => window.axe.run());
    scannedPages.push(route);

    for (const violation of result.violations) {
      const impact = violation.impact || "unknown";
      if (!thresholds.failOnImpacts.has(impact)) continue;
      const selectors = violation.nodes
        .flatMap((node) => node.target)
        .slice(0, 3)
        .join(", ");

      failures.push({
        page: route,
        id: violation.id,
        impact,
        selectors: selectors || "n/a",
      });
    }
  }

  await context.close();
} finally {
  await browser.close();
  await stopServer(server.server);
}

if (failures.length > 0) {
  console.error(
    `FAIL qa:a11y (${failures.length} serious/critical issue${failures.length === 1 ? "" : "s"} across ${scannedPages.length} page${scannedPages.length === 1 ? "" : "s"})`,
  );
  for (const failure of failures) {
    console.error(
      `- ${failure.page} | ${failure.id} | ${failure.impact} | ${failure.selectors}`,
    );
  }
  process.exit(1);
}

console.log(
  `PASS qa:a11y (${scannedPages.length} pages scanned, 0 serious/critical violations)`,
);

async function resolvePages() {
  const existing = [];
  for (const pageRoute of basePages) {
    const target = path.join(projectRoot, pageRoute.replace(/^\//, ""));
    if (!(await pathExists(target))) {
      throw new Error(`Required page not found: ${pageRoute}`);
    }
    existing.push(pageRoute);
  }

  for (const pageRoute of optionalPages) {
    const target = path.join(projectRoot, pageRoute.replace(/^\//, ""));
    if (await pathExists(target)) existing.push(pageRoute);
  }

  return existing;
}

async function pathExists(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function resolveServerPath(urlPath) {
  const withoutQuery = urlPath.split("?")[0].split("#")[0];
  const relative =
    decodeURIComponent(withoutQuery).replace(/^\/+/, "") || "index.html";
  return path.join(projectRoot, relative);
}

async function startStaticServer() {
  const server = createServer(async (req, res) => {
    const reqUrl = req.url || "/";
    let filePath = resolveServerPath(reqUrl);

    const stat = await safeStat(filePath);
    if (stat?.isDirectory()) filePath = path.join(filePath, "index.html");

    const exists = await safeStat(filePath);
    if (!exists?.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    // Serve pages with their shared header/footer expanded, so axe audits the
    // same document a browser receives from dist/.
    const data =
      ext === ".html"
        ? Buffer.from(
            (await renderHtmlFile(filePath, { rootDir: projectRoot })).html,
            "utf8",
          )
        : await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": resolveContentType(ext) });
    res.end(data);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    port: typeof address === "object" && address ? address.port : 0,
  };
}

async function stopServer(server) {
  await new Promise((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
}

async function safeStat(file) {
  try {
    return await fs.stat(file);
  } catch {
    return null;
  }
}

async function loadDependency(name) {
  try {
    return await import(name);
  } catch {
    console.error(
      `Missing dependency: ${name}. Run \"npm install\" to install local QA tooling.`,
    );
    process.exit(1);
  }
}
