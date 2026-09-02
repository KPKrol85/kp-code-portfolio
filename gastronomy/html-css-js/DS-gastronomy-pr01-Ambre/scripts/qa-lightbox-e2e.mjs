import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const rootDir = process.cwd();
const host = "127.0.0.1";
const port = Number(process.env.QA_LIGHTBOX_PORT || 4181);
const baseUrl = `http://${host}:${port}`;
const galleryPage = "galeria.html";
const homePage = "index.html";
const menuPage = "menu.html";

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

const createPageAt = async (browser, pagePath, readySelector, reducedMotion = "no-preference") => {
  const context = await browser.newContext({ reducedMotion, serviceWorkers: "block" });
  await context.addInitScript(() => {
    localStorage.setItem("demoLegalAccepted", "true");
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/${pagePath}`, { waitUntil: "domcontentloaded" });
  await page.locator(readySelector).first().waitFor({ state: "visible" });
  return { context, page };
};

const createFreshPage = (browser, reducedMotion = "no-preference") =>
  createPageAt(browser, galleryPage, ".gallery__grid .gallery__item", reducedMotion);

const galleryItem = (page, index) => page.locator(".gallery__grid .gallery__item").nth(index);

const readState = (page, itemIndex) =>
  page.evaluate((index) => {
    const dialog = document.getElementById("lb");
    const items = Array.from(document.querySelectorAll(".gallery__grid .gallery__item")).filter(
      (item) => !item.hidden && item.offsetParent !== null
    );

    return {
      inlineScrollBehavior: document.documentElement.style.scrollBehavior,
      computedScrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      rootStyleAttribute: document.documentElement.getAttribute("style") || "",
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      dialogOpen: dialog.open,
      scrollY: window.scrollY,
      counterText: document.getElementById("lb-counter")?.textContent || "",
      visibleItemCount: items.length,
      focusOnItem: document.activeElement === items[index],
      focusOnCloseButton: document.activeElement === dialog.querySelector(".site-lightbox__close")
    };
  }, itemIndex);

const setInlineScrollBehavior = (page, value) =>
  page.evaluate((nextValue) => {
    document.documentElement.style.scrollBehavior = nextValue;
  }, value);

const scrollItemIntoView = async (page, index) => {
  const target = await page.evaluate((itemIndex) => {
    const item = document.querySelectorAll(".gallery__grid .gallery__item")[itemIndex];
    const rect = item.getBoundingClientRect();
    const maxScroll = Math.max(0, Math.round(document.documentElement.scrollHeight - window.innerHeight));
    const desired = Math.round(window.scrollY + rect.top - (window.innerHeight - rect.height) / 2);
    const clamped = Math.min(Math.max(desired, 0), maxScroll);
    window.scrollTo({ top: clamped, behavior: "auto" });
    return clamped;
  }, index);

  await page.waitForFunction((expected) => Math.round(window.scrollY) === expected, target);
  return page.evaluate(() => window.scrollY);
};

const openLightbox = async (page, index) => {
  await galleryItem(page, index).click();
  await page.waitForFunction(() => document.getElementById("lb").open === true);
};

const waitForClosed = (page, expectedScrollY) =>
  page.waitForFunction(
    (expected) =>
      document.getElementById("lb").open === false &&
      document.body.style.position !== "fixed" &&
      Math.round(window.scrollY) === Math.round(expected),
    expectedScrollY
  );

const closePaths = [
  {
    name: "close button",
    run: (page) => page.locator("#lb .site-lightbox__close").click()
  },
  {
    name: "Escape key",
    run: (page) => page.keyboard.press("Escape")
  },
  {
    name: "backdrop click",
    run: async (page) => {
      await page.waitForFunction(() => {
        const rect = document.getElementById("lb").getBoundingClientRect();
        return rect.width > 100 && rect.left > 8 && rect.top > 8;
      });
      await page.mouse.click(4, 4);
    }
  },
  {
    name: "native dialog close",
    run: (page) => page.evaluate(() => document.getElementById("lb").close())
  }
];

const assertOpenState = async (page, itemIndex, scrollTop) => {
  const state = await readState(page, itemIndex);

  assert.equal(state.dialogOpen, true, "The gallery item should open the lightbox dialog");
  assert.equal(state.inlineScrollBehavior, "auto", "The lightbox should apply its temporary root override while open");
  assert.equal(state.computedScrollBehavior, "auto", "The temporary override should win over the stylesheet while open");
  assert.equal(state.bodyPosition, "fixed", "Opening should lock body scrolling");
  assert.equal(state.bodyTop, `-${scrollTop}px`, "The locked body should preserve the current scroll offset");
  assert.equal(state.bodyWidth, "100%");
  assert.equal(state.focusOnCloseButton, true, "Opening should move focus into the dialog");
  assert.equal(
    state.counterText,
    `${itemIndex + 1} / ${state.visibleItemCount}`,
    "The counter should report the selected gallery item"
  );

  return state;
};

const assertRestoredState = async (page, options) => {
  const { itemIndex, scrollTop, priorInlineValue, priorStyleAttribute, expectedComputed, label } = options;
  const state = await readState(page, itemIndex);

  assert.equal(state.dialogOpen, false, `${label}: the dialog should be closed`);
  assert.equal(
    state.inlineScrollBehavior,
    priorInlineValue,
    `${label}: the previous inline root scroll-behavior must be restored exactly`
  );
  assert.equal(
    state.rootStyleAttribute,
    priorStyleAttribute,
    `${label}: the root style attribute must match its pre-open value`
  );
  assert.equal(
    state.computedScrollBehavior,
    expectedComputed,
    `${label}: the effective scroll behavior must fall back to the stylesheet or the restored inline value`
  );
  assert.equal(state.bodyPosition, "", `${label}: body scroll locking must be released`);
  assert.equal(state.bodyTop, "", `${label}: the locked body offset must be released`);
  assert.equal(state.bodyWidth, "", `${label}: the locked body width must be released`);
  assert.equal(state.scrollY, scrollTop, `${label}: the saved scroll position must be restored`);
  assert.equal(state.focusOnItem, true, `${label}: focus must return to the triggering gallery item`);
  assert.equal(state.counterText, "", `${label}: the counter must be cleared`);

  return state;
};

const runCloseScenario = async (browser, scenario) => {
  const { label, priorInlineValue, itemIndex, closePath, reducedMotion = "no-preference" } = scenario;
  const { context, page } = await createFreshPage(browser, reducedMotion);
  const expectedComputed = priorInlineValue || (reducedMotion === "reduce" ? "auto" : "smooth");

  try {
    if (priorInlineValue) await setInlineScrollBehavior(page, priorInlineValue);

    const beforeOpen = await readState(page, itemIndex);
    assert.equal(beforeOpen.inlineScrollBehavior, priorInlineValue, `${label}: unexpected inline value before opening`);
    assert.equal(beforeOpen.computedScrollBehavior, expectedComputed, `${label}: unexpected effective value before opening`);
    assert.equal(beforeOpen.dialogOpen, false);

    const scrollTop = await scrollItemIntoView(page, itemIndex);
    assert.ok(scrollTop > 0, `${label}: the scenario should start from a non-zero scroll position`);

    await openLightbox(page, itemIndex);
    await assertOpenState(page, itemIndex, scrollTop);

    await closePath.run(page);
    await waitForClosed(page, scrollTop);

    await assertRestoredState(page, {
      itemIndex,
      scrollTop,
      priorInlineValue,
      priorStyleAttribute: beforeOpen.rootStyleAttribute,
      expectedComputed,
      label
    });
  } finally {
    await context.close();
  }
};

const runRepeatedSessionsTest = async (browser) => {
  const { context, page } = await createFreshPage(browser);

  try {
    await setInlineScrollBehavior(page, "smooth");
    const beforeOpen = await readState(page, 0);

    for (const [step, closePath] of closePaths.entries()) {
      const itemIndex = step + 1;
      const label = `repeated sessions — item ${itemIndex + 1} closed by ${closePath.name}`;
      const scrollTop = await scrollItemIntoView(page, itemIndex);
      assert.ok(scrollTop > 0, `${label}: the session should start from a non-zero scroll position`);

      await openLightbox(page, itemIndex);
      await assertOpenState(page, itemIndex, scrollTop);

      await closePath.run(page);
      await waitForClosed(page, scrollTop);

      await assertRestoredState(page, {
        itemIndex,
        scrollTop,
        priorInlineValue: "smooth",
        priorStyleAttribute: beforeOpen.rootStyleAttribute,
        expectedComputed: "smooth",
        label
      });
    }
  } finally {
    await context.close();
  }
};

const GALLERY_ITEM = ".gallery__grid .gallery__item";
const DISH_THUMB = ".menu__grid .dish__thumb";

const waitForDialogOpen = (page) => page.waitForFunction(() => document.getElementById("lb").open === true);

const waitForDialogClosed = (page) => page.waitForFunction(() => document.getElementById("lb").open === false);

const waitForCounterText = (page, expected) =>
  page.waitForFunction(
    (value) => (document.querySelector("#lb .site-lightbox__counter")?.textContent || "") === value,
    expected
  );

const readModeState = (page) =>
  page.evaluate(() => {
    const dialog = document.getElementById("lb");
    const image = dialog.querySelector(".site-lightbox__image");
    const counter = dialog.querySelector(".site-lightbox__counter");
    const navButtons = Array.from(dialog.querySelectorAll(".site-lightbox__nav-button"));

    return {
      dialogOpen: dialog.open,
      mode: dialog.dataset.lightboxMode || "",
      imageSrc: image?.getAttribute("src") || "",
      imageAlt: image?.getAttribute("alt") || "",
      navCount: navButtons.length,
      navExposed: navButtons.filter((button) => !button.hidden).length,
      navFocusable: navButtons.filter((button) => !button.hidden && !button.disabled).length,
      navRendered: navButtons.filter((button) => getComputedStyle(button).display !== "none").length,
      counterHidden: counter ? counter.hidden : true,
      counterText: counter?.textContent || "",
      focusOnCloseButton: document.activeElement === dialog.querySelector(".site-lightbox__close")
    };
  });

const assertSingleMode = async (page, label) => {
  const state = await readModeState(page);

  assert.equal(state.dialogOpen, true, `${label}: the dish image should open the lightbox`);
  assert.equal(state.navCount, 2, `${label}: the shared navigation controls should still exist`);
  assert.equal(state.navExposed, 0, `${label}: previous/next must not be exposed to assistive technology`);
  assert.equal(state.navFocusable, 0, `${label}: previous/next must not stay keyboard focusable`);
  assert.equal(state.navRendered, 0, `${label}: previous/next must not render`);
  assert.equal(state.counterHidden, true, `${label}: the collection counter must be hidden`);
  assert.equal(state.counterText, "", `${label}: the collection counter must carry no stale value`);
  assert.equal(state.focusOnCloseButton, true, `${label}: opening should move focus into the dialog`);
  assert.equal(state.mode, "single", `${label}: the session should report single-image mode`);

  return state;
};

const assertGalleryMode = async (page, label, expectedCounter) => {
  const state = await readModeState(page);

  assert.equal(state.dialogOpen, true, `${label}: the gallery image should open the lightbox`);
  assert.equal(state.navExposed, 2, `${label}: previous/next must stay available`);
  assert.equal(state.navRendered, 2, `${label}: previous/next must stay visible`);
  assert.equal(state.counterHidden, false, `${label}: the collection counter must stay visible`);
  assert.equal(state.counterText, expectedCounter, `${label}: the counter should report the selected image`);
  assert.equal(state.mode, "gallery", `${label}: the session should report grouped gallery mode`);

  return state;
};

const runSingleModeTest = async (browser, pagePath, label) => {
  const { context, page } = await createPageAt(browser, pagePath, DISH_THUMB);

  try {
    const thumbs = page.locator(DISH_THUMB);
    assert.ok((await thumbs.count()) > 1, `${label}: the fixture needs more than one dish image`);

    const trigger = thumbs.nth(1);
    const expectedSrc = `${baseUrl}${await trigger.getAttribute("data-full")}.jpg`;
    const expectedAlt = await trigger.locator("img").getAttribute("alt");

    await trigger.click();
    await waitForDialogOpen(page);

    const opened = await assertSingleMode(page, label);
    assert.equal(opened.imageSrc, expectedSrc, `${label}: the selected dish image must open`);
    assert.equal(opened.imageAlt, expectedAlt, `${label}: the dish image metadata must be preserved`);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");

    const afterArrows = await readModeState(page);
    assert.equal(afterArrows.imageSrc, expectedSrc, `${label}: arrow keys must not switch dishes`);
    assert.equal(afterArrows.counterText, "", `${label}: arrow keys must not surface a collection counter`);

    await page.keyboard.press("Escape");
    await waitForDialogClosed(page);

    const focusReturned = await page.evaluate(
      (selector) => document.activeElement === document.querySelectorAll(selector)[1],
      DISH_THUMB
    );
    assert.equal(focusReturned, true, `${label}: focus must return to the dish trigger`);
  } finally {
    await context.close();
  }
};

const runGalleryModeTest = async (browser, pagePath, label) => {
  const { context, page } = await createPageAt(browser, pagePath, GALLERY_ITEM);

  try {
    const galleryItems = page.locator(GALLERY_ITEM);
    const total = await galleryItems.count();
    assert.ok(total > 1, `${label}: the fixture needs a grouped collection`);

    await galleryItems.first().click();
    await waitForDialogOpen(page);

    const opened = await assertGalleryMode(page, label, `1 / ${total}`);

    await page.keyboard.press("ArrowRight");
    await waitForCounterText(page, `2 / ${total}`);
    const afterRight = await readModeState(page);
    assert.notEqual(afterRight.imageSrc, opened.imageSrc, `${label}: Right must move to the next image`);

    await page.locator("#lb .site-lightbox__nav-button--prev").click();
    await waitForCounterText(page, `1 / ${total}`);
    const afterPrev = await readModeState(page);
    assert.equal(afterPrev.imageSrc, opened.imageSrc, `${label}: the previous control must step back`);

    await page.keyboard.press("Escape");
    await waitForDialogClosed(page);

    const focusReturned = await page.evaluate(
      (selector) => document.activeElement === document.querySelector(selector),
      GALLERY_ITEM
    );
    assert.equal(focusReturned, true, `${label}: focus must return to the gallery trigger`);
  } finally {
    await context.close();
  }
};

const runModeSwitchTest = async (browser) => {
  const label = "mode switching in one session";
  const { context, page } = await createPageAt(browser, homePage, GALLERY_ITEM);

  try {
    const galleryItems = page.locator(GALLERY_ITEM);
    const thumbs = page.locator(DISH_THUMB);
    const total = await galleryItems.count();

    await galleryItems.first().click();
    await waitForDialogOpen(page);
    await assertGalleryMode(page, `${label} — first gallery session`, `1 / ${total}`);
    await page.keyboard.press("Escape");
    await waitForDialogClosed(page);

    await thumbs.first().click();
    await waitForDialogOpen(page);
    const single = await assertSingleMode(page, `${label} — menu session`);
    await page.keyboard.press("ArrowRight");
    const afterArrow = await readModeState(page);
    assert.equal(
      afterArrow.imageSrc,
      single.imageSrc,
      `${label}: a stale gallery collection must not survive into the menu session`
    );
    await page.keyboard.press("Escape");
    await waitForDialogClosed(page);

    await galleryItems.nth(1).click();
    await waitForDialogOpen(page);
    await assertGalleryMode(page, `${label} — second gallery session`, `2 / ${total}`);
    await page.keyboard.press("ArrowRight");
    await waitForCounterText(page, `3 / ${total}`);
    await page.keyboard.press("Escape");
    await waitForDialogClosed(page);
  } finally {
    await context.close();
  }
};

const modeScenarios = [
  {
    label: "menu dishes open as single-image previews on menu.html",
    run: (browser) => runSingleModeTest(browser, menuPage, "menu.html dish")
  },
  {
    label: "menu dishes open as single-image previews on the homepage preview",
    run: (browser) => runSingleModeTest(browser, homePage, "homepage menu preview dish")
  },
  {
    label: "gallery images keep grouped navigation on the homepage preview",
    run: (browser) => runGalleryModeTest(browser, homePage, "homepage gallery preview")
  },
  {
    label: "gallery images keep grouped navigation on galeria.html",
    run: (browser) => runGalleryModeTest(browser, galleryPage, "galeria.html gallery")
  },
  {
    label: "gallery -> menu -> gallery leaves no stale mode state",
    run: (browser) => runModeSwitchTest(browser)
  }
];

const run = async () => {
  console.log("QA LIGHTBOX E2E: starting static server...");
  const server = await createStaticServer();
  let browser;

  const scenarios = [
    { label: "empty prior inline value — close button", priorInlineValue: "", itemIndex: 0, closePath: closePaths[0] },
    { label: "pre-existing smooth inline value — Escape key", priorInlineValue: "smooth", itemIndex: 1, closePath: closePaths[1] },
    { label: "empty prior inline value — backdrop click", priorInlineValue: "", itemIndex: 2, closePath: closePaths[2] },
    { label: "empty prior inline value — native dialog close", priorInlineValue: "", itemIndex: 3, closePath: closePaths[3] },
    {
      label: "reduced motion, empty prior inline value — close button",
      priorInlineValue: "",
      itemIndex: 4,
      closePath: closePaths[0],
      reducedMotion: "reduce"
    }
  ];

  try {
    browser = await chromium.launch({ headless: true });

    for (const scenario of scenarios) {
      console.log(`QA LIGHTBOX E2E: ${scenario.label}`);
      await runCloseScenario(browser, scenario);
    }

    console.log("QA LIGHTBOX E2E: repeated sessions across every close path");
    await runRepeatedSessionsTest(browser);

    for (const modeScenario of modeScenarios) {
      console.log(`QA LIGHTBOX E2E: ${modeScenario.label}`);
      await modeScenario.run(browser);
    }

    const total = scenarios.length + 1 + modeScenarios.length;
    console.log(`QA LIGHTBOX E2E: PASS (${total}/${total} scenarios)`);
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
  console.error("QA LIGHTBOX E2E: ERROR");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
