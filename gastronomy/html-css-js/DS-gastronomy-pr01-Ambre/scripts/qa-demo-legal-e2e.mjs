import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const rootDir = process.cwd();
const host = "127.0.0.1";
const port = Number(process.env.QA_DEMO_LEGAL_PORT || 4177);
const baseUrl = `http://${host}:${port}`;

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
  [".ico", "image/x-icon"]
]);

const createStaticServer = () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", baseUrl);
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

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
};

const createFreshPage = async (browser) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(() => {
    const initializedKey = "qaDemoLegalInitialized";
    if (sessionStorage.getItem(initializedKey) === "true") return;
    localStorage.removeItem("demoLegalAccepted");
    sessionStorage.setItem(initializedKey, "true");
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#demo-legal-modal:not([hidden])").waitFor();
  return { context, page };
};

const readActiveElement = (page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    return {
      id: active?.id || "",
      className: typeof active?.className === "string" ? active.className : "",
      text: active?.textContent?.trim() || ""
    };
  });

const readDialogFocusableLabels = (page) =>
  page.locator("#demo-legal-modal a[href], #demo-legal-modal button:not([disabled])").evaluateAll((elements) => elements.map((element) => element.textContent.trim()));

const runKeyboardModalTest = async (browser) => {
  const { context, page } = await createFreshPage(browser);
  const modal = page.locator("#demo-legal-modal");
  const panel = page.locator(".demo-legal-modal__panel");

  try {
    assert.equal(await panel.evaluate((element) => document.activeElement === element), true, "Initial focus should be on the dialog panel");

    const focusableLabels = await readDialogFocusableLabels(page);
    assert.ok(focusableLabels.length > 1, "The fixture should expose multiple dialog controls");

    await page.keyboard.press("Tab");
    assert.equal((await readActiveElement(page)).text, focusableLabels[0], "Tab from the panel should enter the first dialog control");

    await page.locator("#demo-legal-modal a[href], #demo-legal-modal button:not([disabled])").last().focus();
    await page.keyboard.press("Tab");
    assert.equal((await readActiveElement(page)).text, focusableLabels[0], "Tab should wrap from the last to the first dialog control");

    await page.locator("#demo-legal-modal a[href], #demo-legal-modal button:not([disabled])").first().focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal((await readActiveElement(page)).text, focusableLabels.at(-1), "Shift+Tab should wrap from the first to the last dialog control");

    const isolation = await page.evaluate(() => {
      const modalElement = document.getElementById("demo-legal-modal");
      const siblings = Array.from(document.body.children).filter((element) => element !== modalElement);
      const backgroundControl = document.querySelector(".site-header__theme-toggle");
      const dialogControl = modalElement.querySelector("[data-demo-legal-accept]");
      dialogControl.focus();
      backgroundControl.focus();
      const hitTarget = document.elementFromPoint(10, 10);

      return {
        allSiblingsInert: siblings.every((element) => element.hasAttribute("inert")),
        focusStayedInside: modalElement.contains(document.activeElement),
        pointerHitStayedInside: modalElement.contains(hitTarget)
      };
    });
    assert.deepEqual(isolation, {
      allSiblingsInert: true,
      focusStayedInside: true,
      pointerHitStayedInside: true
    });

    const links = page.locator("#demo-legal-modal a[href]");
    await links.evaluateAll((elements) => elements.forEach((element) => element.setAttribute("tabindex", "-1")));
    const acceptButton = page.locator("[data-demo-legal-accept]");
    await acceptButton.focus();
    await page.keyboard.press("Tab");
    assert.equal(await acceptButton.evaluate((element) => document.activeElement === element), true, "A single dialog control should retain focus on Tab");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await acceptButton.evaluate((element) => document.activeElement === element), true, "A single dialog control should retain focus on Shift+Tab");

    await page.keyboard.press("Escape");
    assert.equal(await modal.getAttribute("hidden"), "", "Escape should close the dialog");
    assert.equal((await readActiveElement(page)).id, "main", "Escape dismissal should focus the existing main content target");
    assert.equal(await page.evaluate(() => localStorage.getItem("demoLegalAccepted")), null, "Escape should not persist acceptance");
    assert.equal(await page.evaluate(() => Array.from(document.body.children).some((element) => element.id !== "demo-legal-modal" && element.hasAttribute("inert"))), false);
  } finally {
    await context.close();
  }
};

const runPersistenceTest = async (browser) => {
  const { context, page } = await createFreshPage(browser);
  const modal = page.locator("#demo-legal-modal");

  try {
    await page.locator("[data-demo-legal-accept]").click();
    assert.equal(await modal.getAttribute("hidden"), "", "Acceptance should close the dialog");
    assert.equal(await page.evaluate(() => localStorage.getItem("demoLegalAccepted")), "true");
    assert.equal((await readActiveElement(page)).id, "main", "Acceptance should focus the existing main content target");

    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await modal.getAttribute("hidden"), "", "Persisted acceptance should keep the dialog closed on reload");
    assert.equal(await modal.getAttribute("aria-hidden"), "true");
  } finally {
    await context.close();
  }
};

const run = async () => {
  console.log("QA DEMO LEGAL E2E: starting static server...");
  const server = await createStaticServer();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    console.log("QA DEMO LEGAL E2E: keyboard modal behavior");
    await runKeyboardModalTest(browser);

    console.log("QA DEMO LEGAL E2E: acceptance persistence");
    await runPersistenceTest(browser);

    console.log("QA DEMO LEGAL E2E: PASS (2/2 scenarios)");
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
  console.error("QA DEMO LEGAL E2E: ERROR");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
