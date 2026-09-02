import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const rootDir = process.cwd();
const host = "127.0.0.1";
const port = Number(process.env.QA_LEGAL_TABLES_PORT || 4179);
const baseUrl = `http://${host}:${port}`;
const viewportWidths = [320, 390];
const pageCases = [
  {
    pageName: "cookies.html",
    regionNames: ["Wykaz technologii stosowanych w Serwisie"]
  },
  {
    pageName: "polityka-prywatnosci.html",
    regionNames: ["4. Cele i podstawy prawne przetwarzania", "6. Odbiorcy danych"]
  }
];

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"]
]);

const createStaticServer = () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", baseUrl);
    const requestedPath = decodeURIComponent(url.pathname);
    const normalizedPath = requestedPath === "/" ? "/index.html" : requestedPath;
    const relativePath = normalizedPath.replace(/^\/+/, "");
    const filePath = path.resolve(rootDir, relativePath);
    const pathFromRoot = path.relative(rootDir, filePath);

    if (pathFromRoot.startsWith("..") || path.isAbsolute(pathFromRoot)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
};

const assertDocumentContainment = async (page, pageName, viewportWidth) => {
  const state = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
    bodyOverflowX: getComputedStyle(document.body).overflowX
  }));

  assert.equal(state.viewportWidth, viewportWidth);
  assert.ok(
    state.documentScrollWidth <= state.documentClientWidth,
    `${pageName} should not overflow the ${viewportWidth}px viewport (${state.documentScrollWidth}px document width)`
  );
  assert.ok(!["hidden", "clip"].includes(state.htmlOverflowX), "The document root must not hide horizontal overflow");
  assert.ok(!["hidden", "clip"].includes(state.bodyOverflowX), "The document body must not hide horizontal overflow");

  return state;
};

const assertTableRegion = async (page, regionName) => {
  const region = page.getByRole("region", { name: regionName, exact: true });
  assert.equal(await region.count(), 1, `Expected one scroll region named “${regionName}”`);

  const semanticState = await region.evaluate((element) => {
    const table = element.querySelector(":scope > table");
    const labelledBy = element.getAttribute("aria-labelledby");

    return {
      tabindex: element.getAttribute("tabindex"),
      labelledBy,
      labelText: labelledBy ? document.getElementById(labelledBy)?.textContent?.trim() : "",
      directTableCount: element.querySelectorAll(":scope > table").length,
      tableRole: table?.getAttribute("role") || null,
      headCount: table?.querySelectorAll("thead").length || 0,
      bodyCount: table?.querySelectorAll("tbody").length || 0,
      rowCount: table?.querySelectorAll("tr").length || 0,
      headerCount: table?.querySelectorAll('th[scope="col"]').length || 0,
      dataCellCount: table?.querySelectorAll("td").length || 0,
      overflowX: getComputedStyle(element).overflowX,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    };
  });

  assert.equal(semanticState.tabindex, "0");
  assert.ok(semanticState.labelledBy, "The scroll region should reference a visible heading");
  assert.equal(semanticState.labelText, regionName);
  assert.equal(semanticState.directTableCount, 1);
  assert.equal(semanticState.tableRole, null, "The native table role must not be overridden");
  assert.equal(semanticState.headCount, 1);
  assert.equal(semanticState.bodyCount, 1);
  assert.ok(semanticState.rowCount > 1);
  assert.ok(semanticState.headerCount > 0);
  assert.ok(semanticState.dataCellCount > 0);
  assert.equal(semanticState.overflowX, "auto");
  assert.ok(semanticState.scrollWidth > semanticState.clientWidth, `“${regionName}” should contain its wide table`);

  assert.equal(await region.getByRole("table").count(), 1, "Native table semantics should remain exposed");
  assert.ok((await region.getByRole("columnheader").count()) > 0, "Column headers should remain exposed");
  assert.ok((await region.getByRole("cell").count()) > 0, "Data cells should remain exposed");

  const edgeState = await region.evaluate((element) => {
    const table = element.querySelector(":scope > table");
    const firstCell = table.querySelector("tr > :first-child");
    const lastCell = table.querySelector("tr > :last-child");
    element.scrollLeft = 0;
    const startRegionRect = element.getBoundingClientRect();
    const startCellRect = firstCell.getBoundingClientRect();

    element.scrollLeft = element.scrollWidth - element.clientWidth;
    const endRegionRect = element.getBoundingClientRect();
    const endTableRect = table.getBoundingClientRect();
    const endCellRect = lastCell.getBoundingClientRect();

    return {
      startReached: startCellRect.left >= startRegionRect.left - 1 && startCellRect.left < startRegionRect.right,
      endReached: endTableRect.right <= endRegionRect.right + 1 && endCellRect.right <= endRegionRect.right + 1,
      maxScrollLeft: element.scrollWidth - element.clientWidth,
      reachedScrollLeft: element.scrollLeft
    };
  });

  assert.equal(edgeState.startReached, true, `The first column of “${regionName}” should remain reachable`);
  assert.equal(edgeState.endReached, true, `The last column of “${regionName}” should remain reachable`);
  assert.ok(Math.abs(edgeState.reachedScrollLeft - edgeState.maxScrollLeft) <= 1);

  return semanticState;
};

const assertKeyboardAccess = async (page, expectedRegionNames) => {
  await page.locator(".legal__table-scroll").evaluateAll((regions) => {
    for (const region of regions) region.scrollLeft = 0;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  const reachedRegionNames = [];
  for (let tabPresses = 0; tabPresses < 100 && reachedRegionNames.length < expectedRegionNames.length; tabPresses += 1) {
    await page.keyboard.press("Tab");
    const focusState = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || !element.classList.contains("legal__table-scroll")) return null;

      const styles = getComputedStyle(element);
      const labelledBy = element.getAttribute("aria-labelledby");
      return {
        name: labelledBy ? document.getElementById(labelledBy)?.textContent?.trim() : "",
        focusVisible: element.matches(":focus-visible"),
        outlineStyle: styles.outlineStyle,
        outlineWidth: Number.parseFloat(styles.outlineWidth),
        outlineColor: styles.outlineColor,
        scrollLeft: element.scrollLeft
      };
    });

    if (!focusState) continue;

    assert.equal(focusState.name, expectedRegionNames[reachedRegionNames.length], "Scroll regions should follow document tab order");
    assert.equal(focusState.focusVisible, true);
    assert.notEqual(focusState.outlineStyle, "none");
    assert.ok(focusState.outlineWidth >= 2);
    assert.notEqual(focusState.outlineColor, "rgba(0, 0, 0, 0)");
    assert.equal(focusState.scrollLeft, 0);

    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement?.classList.contains("legal__table-scroll") && document.activeElement.scrollLeft > 0);
    reachedRegionNames.push(focusState.name);
  }

  assert.deepEqual(reachedRegionNames, expectedRegionNames, "Every table scroll region should be reachable and operable from the keyboard");
};

const runScenario = async (browser, viewportWidth, pageCase) => {
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: 900 },
    serviceWorkers: "block"
  });
  await context.addInitScript(() => localStorage.setItem("demoLegalAccepted", "true"));
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/${pageCase.pageName}`, { waitUntil: "domcontentloaded" });
    const documentState = await assertDocumentContainment(page, pageCase.pageName, viewportWidth);
    assert.equal(await page.locator(".legal__table-scroll").count(), pageCase.regionNames.length);

    const regionStates = [];
    for (const regionName of pageCase.regionNames) regionStates.push(await assertTableRegion(page, regionName));
    await assertKeyboardAccess(page, pageCase.regionNames);

    console.log(
      `QA LEGAL TABLES E2E: ${pageCase.pageName} @ ${viewportWidth}px — document ${documentState.documentScrollWidth}px, regions ${regionStates
        .map((state) => `${state.clientWidth}/${state.scrollWidth}px`)
        .join(", ")}`
    );
  } finally {
    await context.close();
  }
};

const run = async () => {
  console.log("QA LEGAL TABLES E2E: starting static server...");
  const server = await createStaticServer();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    for (const viewportWidth of viewportWidths) {
      for (const pageCase of pageCases) await runScenario(browser, viewportWidth, pageCase);
    }

    console.log("QA LEGAL TABLES E2E: PASS (4/4 page/viewport scenarios)");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
};

run().catch((error) => {
  console.error("QA LEGAL TABLES E2E: ERROR");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
