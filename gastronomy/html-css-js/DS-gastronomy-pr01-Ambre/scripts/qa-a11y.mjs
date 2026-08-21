
import fs from "fs";
import http from "http";
import path from "path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const rootDir = process.cwd();
const host = "127.0.0.1";
const port = Number(process.env.QA_A11Y_PORT || 4173);
const pages = [
  "/index.html",
  "/menu.html",
  "/galeria.html",
  "/cookies.html",
  "/polityka-prywatnosci.html",
  "/regulamin.html",
  "/offline.html",
  "/404.html"
];

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"]
]);

const createStaticServer = () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${host}:${port}`);
    const requestedPath = decodeURIComponent(url.pathname);
    const normalizedPath = requestedPath === "/" ? "/index.html" : requestedPath;
    const relativePath = normalizedPath.replace(/^\/+/, "");
    const filePath = path.resolve(rootDir, relativePath);

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes.get(ext) || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      resolve(server);
    });
  });
};

const formatNodeTargets = (nodes) => {
  const targets = [];
  for (const node of nodes) {
    const selector = Array.isArray(node.target) ? node.target.join(" | ") : "(unknown selector)";
    targets.push(selector || "(unknown selector)");
    if (targets.length >= 3) break;
  }
  return targets;
};

const run = async () => {
  console.log("QA A11Y: starting static server...");
  const server = await createStaticServer();

  let browser;
  let context;
  const allViolations = [];

  try {
    console.log(`QA A11Y: scanning ${pages.length} page(s) at http://${host}:${port}`);
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ bypassCSP: true });

    for (const pagePath of pages) {
      const pageUrl = `http://${host}:${port}${pagePath}`;
      const page = await context.newPage();

      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        const scanResult = await new AxeBuilder({ page }).analyze();

        if (scanResult.violations.length > 0) {
          allViolations.push({ pagePath, violations: scanResult.violations });
        }
      } finally {
        await page.close();
      }
    }

    if (allViolations.length > 0) {
      console.log("QA A11Y: FAIL\n");
      for (const entry of allViolations) {
        console.log(`Page: ${entry.pagePath}`);
        for (const violation of entry.violations) {
          const impact = violation.impact || "unknown";
          console.log(`  - [${violation.id}] impact=${impact}`);
          console.log(`    ${violation.description}`);
          const targets = formatNodeTargets(violation.nodes);
          console.log(`    nodes: ${targets.join(", ")}`);
        }
        console.log("");
      }

      const totalViolations = allViolations.reduce((sum, entry) => sum + entry.violations.length, 0);
      console.log(`Total pages with violations: ${allViolations.length}`);
      console.log(`Total violations: ${totalViolations}`);
      process.exitCode = 1;
      return;
    }

    console.log("QA A11Y: PASS");
  } finally {
    if (context) {
      await context.close();
    }

    if (browser) {
      await browser.close();
    }

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error("QA A11Y: ERROR");
  console.error(message);
  process.exit(1);
});
