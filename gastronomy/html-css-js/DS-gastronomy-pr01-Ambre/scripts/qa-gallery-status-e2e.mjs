import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const rootDir = process.cwd();
const host = "127.0.0.1";
const port = Number(process.env.QA_GALLERY_STATUS_PORT || 4182);
const baseUrl = `http://${host}:${port}`;
const galleryPage = "galeria.html";
const doneStatusText = "Wszystko załadowane";
const statusSelector = ".gallery__section [data-load-status]";

const filterCases = [
  { label: "Wszystko (stan początkowy)", filter: "all" },
  { label: "Wnętrza", filter: "wnetrza" },
  { label: "Dania", filter: "dania" },
  { label: "Imprezy", filter: "imprezy" },
  { label: "Wszystko (powrót)", filter: "all" }
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

const createFreshPage = async (browser) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(() => {
    localStorage.setItem("demoLegalAccepted", "true");
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/${galleryPage}`, { waitUntil: "domcontentloaded" });
  await page.locator(".gallery__grid .gallery__item").first().waitFor({ state: "visible" });
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.dataset.state === "done",
    statusSelector
  );
  return { context, page };
};

const readStatusState = (page) =>
  page.evaluate((selector) => {
    const status = document.querySelector(selector);
    const icons = Array.from(status.querySelectorAll("svg"));
    const [icon] = icons;

    return {
      state: status.dataset.state,
      ariaLive: status.getAttribute("aria-live"),
      isScreenReaderOnly: status.classList.contains("sr-only"),
      textContent: status.textContent,
      innerText: status.innerText,
      ownTextNodes: Array.from(status.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent),
      labelSpans: Array.from(status.querySelectorAll("span")).map((span) => span.textContent),
      iconCount: icons.length,
      iconClass: icon ? icon.getAttribute("class") : null,
      iconAriaHidden: icon ? icon.getAttribute("aria-hidden") : null,
      iconFocusable: icon ? icon.getAttribute("focusable") : null,
      iconTextContent: icon ? icon.textContent : null,
      iconPathCount: icon ? icon.querySelectorAll("path").length : 0
    };
  }, statusSelector);

const readGalleryState = (page) =>
  page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".gallery__section .gallery__item"));
    const category = (item) => item.dataset.cat || item.dataset.filter || "";

    return {
      totalCount: items.length,
      loadHiddenCount: items.filter((item) => item.dataset.loadHidden === "true").length,
      visibleCategories: items.filter((item) => !item.hidden).map(category),
      allCategories: items.map(category),
      hasLoadMoreButton: Boolean(document.querySelector(".gallery__section [data-load-more]")),
      pressedFilters: Array.from(document.querySelectorAll(".gallery__tabs .tabs__tab"))
        .filter((tab) => tab.getAttribute("aria-pressed") === "true")
        .map((tab) => tab.dataset.filter)
    };
  });

const axValue = (value) => (value && typeof value.value === "string" ? value.value : "");

// Reads the accessibility subtree of the status region straight from Chromium,
// so the decorative icon is judged by what assistive technology actually sees.
const readAssistiveNodes = async (session) => {
  const { root } = await session.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: statusSelector });
  assert.ok(nodeId, "The gallery status element must be resolvable in the accessibility tree");

  const { nodes } = await session.send("Accessibility.queryAXTree", { nodeId });
  return nodes
    .filter((node) => node.ignored !== true)
    .map((node) => ({ role: axValue(node.role), name: axValue(node.name) }));
};

const assertDoneStatus = async (page, session, label) => {
  const status = await readStatusState(page);

  assert.equal(status.state, "done", `${label}: the gallery status must report the completed state`);
  assert.equal(status.ariaLive, "polite", `${label}: the gallery status must stay a polite live region`);
  assert.equal(status.isScreenReaderOnly, false, `${label}: the completed status must become visible`);
  assert.equal(
    status.textContent,
    doneStatusText,
    `${label}: the rendered status text must be exactly the completed copy`
  );
  assert.equal(
    status.innerText.trim(),
    doneStatusText,
    `${label}: the visible status text must be exactly the completed copy`
  );
  assert.deepEqual(
    status.labelSpans,
    [doneStatusText],
    `${label}: the completed copy must live in a single label span`
  );
  assert.deepEqual(
    status.ownTextNodes.filter((text) => text.trim() !== ""),
    [],
    `${label}: the status must not render stray text nodes beside the icon and the label`
  );
  assert.ok(
    !/[<>]/u.test(status.textContent),
    `${label}: the status text must not leak markup punctuation, received ${JSON.stringify(status.textContent)}`
  );

  assert.equal(status.iconCount, 1, `${label}: the completed status must keep exactly one status icon`);
  assert.equal(status.iconClass, "menu-status__icon", `${label}: the status icon must keep its component class`);
  assert.equal(status.iconAriaHidden, "true", `${label}: the status icon must stay decorative`);
  assert.equal(status.iconFocusable, "false", `${label}: the status icon must stay out of the tab order`);
  assert.equal(status.iconTextContent, "", `${label}: the status icon must not contribute text`);
  assert.equal(status.iconPathCount, 3, `${label}: the status icon must keep its original paths`);

  const assistiveNodes = await readAssistiveNodes(session);
  const assistiveNames = assistiveNodes.map((node) => node.name).filter((name) => name.trim() !== "");

  assert.ok(
    assistiveNames.length > 0,
    `${label}: the completed status must expose its copy to assistive technology`
  );
  for (const name of assistiveNames) {
    assert.equal(
      name.trim(),
      doneStatusText,
      `${label}: assistive output must contain only the completed copy, received ${JSON.stringify(name)}`
    );
  }
  for (const node of assistiveNodes) {
    assert.ok(
      !/^(img|image|graphics-[a-z]+)$/u.test(node.role),
      `${label}: the decorative icon must stay out of assistive output, received role ${JSON.stringify(node.role)}`
    );
  }

  return status;
};

const assertFilterCase = async (page, session, testCase) => {
  const { label, filter } = testCase;
  await page.locator(`.gallery__tabs .tabs__tab[data-filter="${filter}"]`).click();
  await page.waitForFunction(
    (activeFilter) =>
      document
        .querySelector(`.gallery__tabs .tabs__tab[data-filter="${activeFilter}"]`)
        .getAttribute("aria-pressed") === "true",
    filter
  );

  const gallery = await readGalleryState(page);
  const expectedCategories = gallery.allCategories.filter(
    (category) => filter === "all" || category === filter
  );

  assert.deepEqual(gallery.pressedFilters, [filter], `${label}: exactly the clicked tab must stay pressed`);
  assert.deepEqual(
    gallery.visibleCategories,
    expectedCategories,
    `${label}: only the matching gallery items must stay visible`
  );
  assert.ok(gallery.visibleCategories.length > 0, `${label}: the filter must keep at least one item visible`);
  assert.equal(gallery.loadHiddenCount, 0, `${label}: every gallery item must stay loaded`);

  await assertDoneStatus(page, session, label);
};

const assertInitialMarkup = () => {
  const markup = fs.readFileSync(path.resolve(rootDir, galleryPage), "utf8");
  const statusMatch = markup.match(/<p class="([^"]*)"[^>]*data-load-status[^>]*>(.*?)<\/p>/u);

  assert.ok(statusMatch, "The gallery page must ship an empty load-status live region");
  assert.ok(
    statusMatch[1].split(/\s+/u).includes("sr-only"),
    "The unresolved gallery status must start screen-reader only"
  );
  assert.equal(statusMatch[2], "", "The gallery status copy must be rendered by the load-more module");
  assert.ok(
    !markup.includes(doneStatusText),
    "The completed status copy must not be duplicated in the gallery markup"
  );
};

const run = async () => {
  console.log("QA GALLERY STATUS E2E: verifying initial markup...");
  assertInitialMarkup();

  console.log("QA GALLERY STATUS E2E: starting static server...");
  const server = await createStaticServer();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const { context, page } = await createFreshPage(browser);
    const session = await context.newCDPSession(page);

    try {
      await session.send("DOM.enable");
      await session.send("Accessibility.enable");

      console.log("QA GALLERY STATUS E2E: completed status on initial load");
      const gallery = await readGalleryState(page);

      assert.ok(gallery.totalCount > 0, "The gallery must ship at least one item");
      assert.equal(gallery.loadHiddenCount, 0, "Every gallery item must be loaded on the first render");
      assert.equal(
        gallery.hasLoadMoreButton,
        false,
        "The gallery ships its full set, so no load-more button should remain"
      );
      assert.equal(
        gallery.visibleCategories.length,
        gallery.totalCount,
        "The default filter must keep every loaded item visible"
      );

      await assertDoneStatus(page, session, "initial load");

      for (const testCase of filterCases) {
        console.log(`QA GALLERY STATUS E2E: filter — ${testCase.label}`);
        await assertFilterCase(page, session, testCase);
      }

      console.log(`QA GALLERY STATUS E2E: PASS (${filterCases.length + 1}/${filterCases.length + 1} scenarios)`);
    } finally {
      await context.close();
    }
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
  console.error("QA GALLERY STATUS E2E: ERROR");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
