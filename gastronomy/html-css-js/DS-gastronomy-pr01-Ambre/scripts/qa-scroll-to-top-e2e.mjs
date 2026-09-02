import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const rootDir = process.cwd();
const host = "127.0.0.1";
const port = Number(process.env.QA_SCROLL_TO_TOP_PORT || 4178);
const baseUrl = `http://${host}:${port}`;
const intendedPages = [
  "index.html",
  "menu.html",
  "galeria.html",
  "cookies.html",
  "polityka-prywatnosci.html",
  "regulamin.html"
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

const assertSharedMarkupContract = () => {
  const discoveredPages = fs
    .readdirSync(rootDir)
    .filter((file) => file.endsWith(".html"))
    .filter((file) => fs.readFileSync(path.join(rootDir, file), "utf8").includes('data-testid="scroll-up"'))
    .sort();

  assert.deepEqual(discoveredPages, [...intendedPages].sort(), "The intended-page list should match every page that exposes the shared control");

  for (const pageName of intendedPages) {
    const html = fs.readFileSync(path.join(rootDir, pageName), "utf8");
    const buttons = [...html.matchAll(/<button\b[^>]*\bdata-testid="scroll-up"[^>]*>/g)].map((match) => match[0]);

    assert.equal(buttons.length, 1, `${pageName} should contain exactly one shared scroll-to-top button`);
    const markup = buttons[0];
    assert.match(markup, /\bclass="[^"]*\bscroll-btn\b[^"]*\bscroll-up\b[^"]*"/);
    assert.match(markup, /\btype="button"/);
    assert.match(markup, /\baria-label="Przewiń na górę"/);
    assert.match(markup, /\baria-hidden="true"/);
    assert.match(markup, /\btabindex="-1"/);
    assert.match(markup, /\shidden(?:\s|>)/);
  }
};

const installScrollRecorder = async (context) => {
  await context.addInitScript(() => {
    localStorage.setItem("demoLegalAccepted", "true");

    const nativeScrollTo = window.scrollTo.bind(window);
    window.__qaScrollToCalls = [];
    window.scrollTo = (...args) => {
      window.__qaScrollToCalls.push(args);
      const options = typeof args[0] === "object" ? args[0] : { left: args[0], top: args[1] };
      nativeScrollTo({ left: options.left || 0, top: options.top || 0, behavior: "auto" });
    };
  });
};

const readControlState = (page) =>
  page.locator('[data-testid="scroll-up"]').evaluate((button) => {
    const styles = getComputedStyle(button);
    const rect = button.getBoundingClientRect();

    return {
      hidden: button.hidden,
      ariaHidden: button.getAttribute("aria-hidden"),
      tabindex: button.getAttribute("tabindex"),
      isVisibleClass: button.classList.contains("is-visible"),
      display: styles.display,
      visibility: styles.visibility,
      pointerEvents: styles.pointerEvents,
      active: document.activeElement === button,
      inViewport: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth
    };
  });

const assertHiddenState = async (page) => {
  const button = page.locator('[data-testid="scroll-up"]');
  assert.deepEqual(await readControlState(page), {
    hidden: true,
    ariaHidden: "true",
    tabindex: "-1",
    isVisibleClass: false,
    display: "none",
    visibility: "hidden",
    pointerEvents: "none",
    active: false,
    inViewport: false
  });
  assert.equal(await button.isVisible(), false);

  const footerControl = page.locator("footer a[href], footer button:not([disabled])").last();
  assert.equal(await footerControl.count(), 1, "The representative page should expose a focusable control before the scroll button");
  await footerControl.evaluate((element) => element.focus({ preventScroll: true }));
  await page.keyboard.press("Tab");
  assert.equal((await readControlState(page)).active, false, "Tab should skip the hidden control");

  await button.focus();
  assert.equal((await readControlState(page)).active, false, "The hidden control should reject programmatic keyboard focus");
};

const assertVisibleState = async (page) => {
  const button = page.locator('[data-testid="scroll-up"]');
  const state = await readControlState(page);

  assert.equal(state.hidden, false);
  assert.equal(state.ariaHidden, "false");
  assert.equal(state.tabindex, null, "A visible native button should use its native tab order");
  assert.equal(state.isVisibleClass, true);
  assert.notEqual(state.display, "none");
  assert.equal(state.visibility, "visible");
  assert.equal(state.pointerEvents, "auto");
  assert.equal(state.inViewport, true, "The visible control should be rendered inside the viewport");
  assert.equal(await button.isVisible(), true);

  await button.focus();
  assert.equal((await readControlState(page)).active, true, "The visible control should accept keyboard focus");
};

const scrollTo = async (page, top) => {
  await page.evaluate((nextTop) => window.scrollTo({ top: nextTop, behavior: "auto" }), top);
  await page.waitForFunction((expectedTop) => window.scrollY === expectedTop, top);
};

const runVisibilityAndKeyboardTest = async (browser) => {
  const context = await browser.newContext({ reducedMotion: "no-preference", serviceWorkers: "block" });
  await installScrollRecorder(context);
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/menu.html`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="scroll-up"]').waitFor({ state: "attached" });
    await assertHiddenState(page);

    await scrollTo(page, 301);
    await page.waitForFunction(() => document.querySelector('[data-testid="scroll-up"]')?.classList.contains("is-visible"));
    await assertVisibleState(page);

    await page.evaluate(() => {
      window.__qaScrollToCalls = [];
    });
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.scrollY === 0);
    await page.waitForFunction(() => document.querySelector('[data-testid="scroll-up"]')?.hidden === true);

    const activationCall = await page.evaluate(() => window.__qaScrollToCalls.at(-1)?.[0]);
    assert.deepEqual(activationCall, { top: 0, behavior: "smooth" }, "Keyboard activation should preserve smooth scrolling without a reduced-motion preference");
    await assertHiddenState(page);

    await scrollTo(page, 301);
    await page.waitForFunction(() => document.querySelector('[data-testid="scroll-up"]')?.hidden === false);
    await scrollTo(page, 300);
    await page.waitForFunction(() => document.querySelector('[data-testid="scroll-up"]')?.hidden === true);
    await assertHiddenState(page);
  } finally {
    await context.close();
  }
};

const runReducedMotionTest = async (browser) => {
  const context = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block" });
  await installScrollRecorder(context);
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/menu.html`, { waitUntil: "domcontentloaded" });
    await scrollTo(page, 301);
    await page.waitForFunction(() => document.querySelector('[data-testid="scroll-up"]')?.hidden === false);
    await page.locator('[data-testid="scroll-up"]').focus();
    await page.evaluate(() => {
      window.__qaScrollToCalls = [];
    });
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.scrollY === 0);

    const activationCall = await page.evaluate(() => window.__qaScrollToCalls.at(-1)?.[0]);
    assert.deepEqual(activationCall, { top: 0, behavior: "auto" }, "Reduced motion should keep instant scroll-to-top behavior");
  } finally {
    await context.close();
  }
};

const run = async () => {
  console.log("QA SCROLL TO TOP E2E: shared markup contract");
  assertSharedMarkupContract();

  console.log("QA SCROLL TO TOP E2E: starting static server...");
  const server = await createStaticServer();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    console.log("QA SCROLL TO TOP E2E: threshold visibility and keyboard activation");
    await runVisibilityAndKeyboardTest(browser);

    console.log("QA SCROLL TO TOP E2E: reduced-motion activation");
    await runReducedMotionTest(browser);

    console.log("QA SCROLL TO TOP E2E: PASS (3/3 scenarios)");
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
  console.error("QA SCROLL TO TOP E2E: ERROR");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
