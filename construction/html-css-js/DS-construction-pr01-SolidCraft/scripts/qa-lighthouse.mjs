/* Lighthouse QA gate for SolidCraft.

   Runs the Lighthouse engine directly instead of through LHCI orchestration:
   the project only ever needed "audit these URLs from dist/ and fail if a
   category drops below its threshold", which is small enough to own here and
   carries none of LHCI's server-upload, build-comparison or assertion
   machinery.

   The audited URLs, run count and thresholds live in lighthouse.config.json
   so this file stays implementation, not policy.

   dist/ is served over an ephemeral loopback port with gzip for text
   responses, matching the express+compression static server LHCI used — a
   plain uncompressed server would depress the performance score through the
   scored `uses-text-compression` audit and make the thresholds mean something
   different than they did before. */

import { createServer } from "node:http";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { resolveContentType } from "./utils/mime-types.mjs";
import loggerUtils from "./utils/logger.js";

const gzip = promisify(zlib.gzip);
const { createLogger } = loggerUtils;
const logger = createLogger();

const rootDir = path.resolve(process.cwd());
const CONFIG_FILE = "lighthouse.config.json";
const HOST = "127.0.0.1";
/* express's compression() skips small bodies; mirror it so tiny files are not
   gzipped here but served raw there. */
const GZIP_MIN_BYTES = 1024;
const CATEGORY_ORDER = [
  "performance",
  "accessibility",
  "seo",
  "best-practices",
];

async function safeStat(target) {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

async function loadConfig() {
  const configPath = path.resolve(rootDir, CONFIG_FILE);
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${CONFIG_FILE}: ${error.message}`);
  }

  const { distDir, urls, numberOfRuns, reportDir, thresholds } = parsed;

  if (typeof distDir !== "string" || !distDir) {
    throw new Error(`${CONFIG_FILE}: "distDir" must be a non-empty string.`);
  }
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error(`${CONFIG_FILE}: "urls" must be a non-empty array.`);
  }
  if (!Number.isInteger(numberOfRuns) || numberOfRuns < 1) {
    throw new Error(`${CONFIG_FILE}: "numberOfRuns" must be a positive integer.`);
  }
  if (typeof reportDir !== "string" || !reportDir) {
    throw new Error(`${CONFIG_FILE}: "reportDir" must be a non-empty string.`);
  }
  if (!thresholds || typeof thresholds !== "object") {
    throw new Error(`${CONFIG_FILE}: "thresholds" must be an object.`);
  }
  for (const [category, minScore] of Object.entries(thresholds)) {
    if (typeof minScore !== "number" || minScore < 0 || minScore > 1) {
      throw new Error(
        `${CONFIG_FILE}: threshold for "${category}" must be a number between 0 and 1.`,
      );
    }
  }

  return { distDir, urls, numberOfRuns, reportDir, thresholds };
}

/* Text formats benefit from gzip; media and fonts are already compressed. */
function isCompressible(contentType) {
  return (
    contentType.startsWith("text/") ||
    contentType.startsWith("application/json") ||
    contentType.startsWith("application/manifest+json") ||
    contentType.startsWith("application/xml") ||
    contentType.startsWith("image/svg+xml")
  );
}

/* Maps a request path onto a file inside distRoot, or null when it would
   escape it or cannot be decoded. */
function resolveRequestPath(distRoot, requestUrl) {
  const raw = (requestUrl || "/").split("?")[0].split("#")[0];

  let pathname;
  try {
    pathname = decodeURIComponent(raw);
  } catch {
    return null;
  }

  const relative = pathname.replace(/^\/+/, "") || "index.html";
  const absPath = path.resolve(distRoot, relative);
  const contained =
    absPath === distRoot || absPath.startsWith(distRoot + path.sep);

  return contained ? absPath : null;
}

async function startDistServer(distDir) {
  const distRoot = path.resolve(rootDir, distDir);

  const distStat = await safeStat(distRoot);
  if (!distStat?.isDirectory()) {
    throw new Error(
      `Build output "${distDir}" not found. Run "npm run build:dist" first.`,
    );
  }

  const server = createServer(async (req, res) => {
    try {
      const resolved = resolveRequestPath(distRoot, req.url);
      if (!resolved) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const resolvedStat = await safeStat(resolved);
      const target = resolvedStat?.isDirectory()
        ? path.join(resolved, "index.html")
        : resolved;
      const targetStat = resolvedStat?.isDirectory()
        ? await safeStat(target)
        : resolvedStat;

      if (!targetStat?.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const contentType = resolveContentType(path.extname(target).toLowerCase());
      let body = await fs.readFile(target);

      const headers = { "Content-Type": contentType, Vary: "Accept-Encoding" };
      const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
      if (
        acceptsGzip &&
        isCompressible(contentType) &&
        body.length >= GZIP_MIN_BYTES
      ) {
        body = await gzip(body);
        headers["Content-Encoding"] = "gzip";
      }
      headers["Content-Length"] = body.length;

      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Server error: ${error.message}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, resolve);
  });

  const { port } = server.address();
  return {
    origin: `http://${HOST}:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

/* Prefer the Chromium that Playwright already pins for the accessibility and
   functional harnesses: it is project-local and version-stable, so the audit
   does not depend on whatever Chrome happens to be installed. Falls back to
   chrome-launcher's own detection, and reports which binary was used either
   way so the choice is never silent. */
async function resolveChromePath() {
  try {
    const playwright = await import("playwright");
    const chromium = playwright.chromium ?? playwright.default?.chromium;
    const executablePath = chromium?.executablePath?.();
    if (executablePath && existsSync(executablePath)) {
      return { chromePath: executablePath, source: "playwright chromium" };
    }
  } catch {
    /* fall through to chrome-launcher detection */
  }
  return { chromePath: undefined, source: "chrome-launcher auto-detection" };
}

function reportFileName(urlPath) {
  const slug = urlPath
    .replace(/^\//, "")
    .replace(/\.html$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "index"}.report.html`;
}

/* With numberOfRuns > 1 the median run by performance is reported, so a single
   noisy run cannot decide the gate. */
function selectRepresentative(runs) {
  if (runs.length === 1) return runs[0];
  const sorted = [...runs].sort(
    (a, b) => a.scores.performance - b.scores.performance,
  );
  return sorted[Math.floor(sorted.length / 2)];
}

function formatScore(score) {
  return score === null || score === undefined
    ? "n/a"
    : score.toFixed(2).padStart(4);
}

async function auditUrl({ url, origin, port, numberOfRuns }) {
  const runs = [];

  for (let run = 1; run <= numberOfRuns; run += 1) {
    const result = await lighthouse(`${origin}${url}`, {
      port,
      output: "html",
      logLevel: "error",
    });

    if (!result?.lhr) {
      throw new Error(`Lighthouse returned no result for ${url}.`);
    }

    const scores = {};
    for (const category of CATEGORY_ORDER) {
      scores[category] = result.lhr.categories[category]?.score ?? null;
    }
    runs.push({ scores, report: result.report, lhr: result.lhr });
  }

  return selectRepresentative(runs);
}

async function main() {
  const config = await loadConfig();
  const reportRoot = path.resolve(rootDir, config.reportDir);
  await fs.mkdir(reportRoot, { recursive: true });

  const server = await startDistServer(config.distDir);
  const { chromePath, source } = await resolveChromePath();

  let chrome;
  const failures = [];
  const summaries = [];

  try {
    try {
      chrome = await launch({
        chromePath,
        chromeFlags: ["--headless=new"],
      });
    } catch (error) {
      throw new Error(
        `Could not launch Chrome via ${source}: ${error.message}. ` +
          `Install a local Chrome/Chromium (for example "npx playwright install chromium") and retry.`,
      );
    }

    logger.log(`Browser: ${source}${chromePath ? ` (${chromePath})` : ""}`);
    logger.log(`Serving ${config.distDir}/ at ${server.origin}`);
    logger.log("");

    for (const url of config.urls) {
      const representative = await auditUrl({
        url,
        origin: server.origin,
        port: chrome.port,
        numberOfRuns: config.numberOfRuns,
      });

      const reportPath = path.join(reportRoot, reportFileName(url));
      await fs.writeFile(reportPath, representative.report, "utf8");

      const line = CATEGORY_ORDER.map(
        (category) =>
          `${category} ${formatScore(representative.scores[category])}`,
      ).join("  ");
      logger.log(`${url}\n  ${line}`);

      for (const [category, minScore] of Object.entries(config.thresholds)) {
        const score = representative.scores[category];
        if (score === null || score === undefined) {
          failures.push({ url, category, score, minScore, missing: true });
          continue;
        }
        if (score < minScore) {
          failures.push({ url, category, score, minScore, missing: false });
        }
      }

      summaries.push({
        url,
        reportPath: path.relative(rootDir, reportPath),
        scores: representative.scores,
      });
    }
  } finally {
    /* Both cleanups have to run even when one of them throws: chrome-launcher's
       kill() is synchronous and returns void (so it must not be awaited or
       .catch()-ed), and a server left listening would keep the process alive
       after a failed audit instead of letting it exit with a status. */
    try {
      chrome?.kill();
    } catch {
      /* Chrome already exited. */
    }
    await server.close();
  }

  logger.log("");
  for (const summary of summaries) {
    logger.log(`Report: ${summary.reportPath}`);
  }
  logger.log("");

  if (failures.length > 0) {
    for (const failure of failures) {
      logger.error(
        failure.missing
          ? `FAIL: ${failure.url} — category "${failure.category}" was not produced by Lighthouse (threshold ${failure.minScore}).`
          : `FAIL: ${failure.url} — ${failure.category} ${failure.score.toFixed(2)} is below the required ${failure.minScore}.`,
      );
    }
    logger.error(
      `FAIL: Lighthouse QA failed ${failures.length} threshold check(s) across ${config.urls.length} URL(s).`,
    );
    process.exitCode = 1;
    return;
  }

  logger.summary(
    `OK: Lighthouse QA passed for ${config.urls.length} URL(s) against ${Object.keys(config.thresholds).length} category thresholds.`,
  );
}

main().catch((error) => {
  logger.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
