/* Service-gallery lightbox scenarios.

   oferta/lazienki.html is the representative gallery page the accessibility
   gate has scanned since before O-05, and all six service pages share the
   generated gallery structure, so one page covers the contract.

   The scenarios assert what PH6-01/PH6-02 established: one tab stop per item,
   keyboard activation that opens the dialog instead of following the anchor to
   the raw JPEG, and a dialog that owns its own controls and focus. */

import {
  DESKTOP_VIEWPORT,
  assert,
  assertEqual,
  assertFocusOn,
  assertFocusWithin,
  assertIncludes,
  hasClass,
  openPage,
  withPage,
} from "./harness.mjs";

const GALLERY_PAGE = "/oferta/lazienki.html";
const GALLERY_ITEM = ".gallery a.gallery-item";
const DIALOG = ".lb-wrap";
const ITEM_COUNT = 6;

const itemSelector = (n) =>
  `${GALLERY_ITEM}[href$="bathr-0${n}-2048x1536.jpg"]`;

async function currentLightboxImage(page) {
  return page.locator(`${DIALOG} img`).first().getAttribute("src");
}

async function assertDialogOpen(page, context) {
  assert(
    await hasClass(page, DIALOG, "is-open"),
    `${context} — the lightbox dialog should be open`,
  );
  assertEqual(
    await page.locator(DIALOG).getAttribute("aria-hidden"),
    "false",
    `${context} — the open dialog should not be hidden from assistive technology`,
  );
  assert(
    await hasClass(page, "html", "lb-no-scroll"),
    `${context} — the open dialog should lock page scrolling`,
  );
}

async function assertDialogClosed(page, context) {
  assert(
    !(await hasClass(page, DIALOG, "is-open")),
    `${context} — the lightbox dialog should be closed`,
  );
  assertEqual(
    await page.locator(DIALOG).getAttribute("aria-hidden"),
    "true",
    `${context} — the closed dialog should be hidden from assistive technology`,
  );
  assert(
    !(await hasClass(page, "html", "lb-no-scroll")),
    `${context} — closing the dialog should release the scroll lock`,
  );
}

const lightboxScenarios = [
  {
    name: "lightbox-gallery-item-is-one-tab-stop",
    async run({ browser, baseURL }) {
      await withPage(
        browser,
        { baseURL, viewport: DESKTOP_VIEWPORT },
        async ({ page }) => {
          await openPage(page, GALLERY_PAGE);

          const items = page.locator(GALLERY_ITEM);
          assertEqual(
            await items.count(),
            ITEM_COUNT,
            "the gallery should expose one anchor per item",
          );

          const structure = await page.evaluate((selector) => {
            const anchors = [...document.querySelectorAll(selector)];
            return {
              rawImageHrefs: anchors.filter((a) =>
                (a.getAttribute("href") || "").endsWith(".jpg"),
              ).length,
              nestedFocusables: anchors.reduce(
                (total, anchor) =>
                  total +
                  anchor.querySelectorAll(
                    'a, button, input, select, textarea, [tabindex], [role="button"]',
                  ).length,
                0,
              ),
            };
          }, GALLERY_ITEM);

          assertEqual(
            structure.rawImageHrefs,
            ITEM_COUNT,
            "every item should keep its raw-image href as the no-JavaScript fallback",
          );
          assertEqual(
            structure.nestedFocusables,
            0,
            "an item's image must not add a second control inside the anchor",
          );

          await page.locator(itemSelector(1)).focus();
          await assertFocusOn(
            page,
            itemSelector(1),
            "the first gallery anchor should be focusable",
          );

          await page.keyboard.press("Tab");
          await assertFocusOn(
            page,
            itemSelector(2),
            "Tab should move straight to the next item, so each item is a single tab stop",
          );
        },
      );
    },
  },

  {
    name: "lightbox-enter-opens-dialog-and-escape-restores-focus",
    async run({ browser, baseURL }) {
      await withPage(
        browser,
        { baseURL, viewport: DESKTOP_VIEWPORT },
        async ({ page }) => {
          await openPage(page, GALLERY_PAGE);

          const pageUrl = page.url();
          const opener = page.locator(itemSelector(1));

          await opener.focus();
          await page.keyboard.press("Enter");

          await assertDialogOpen(page, "after Enter on a gallery anchor");
          assertEqual(
            page.url(),
            pageUrl,
            "Enter should open the lightbox instead of following the anchor to the raw image",
          );

          const dialog = page.locator(DIALOG);
          assertEqual(
            await dialog.getAttribute("role"),
            "dialog",
            "the lightbox should expose a dialog role",
          );
          assertEqual(
            await dialog.getAttribute("aria-modal"),
            "true",
            "the lightbox should expose a modal dialog",
          );

          const controls = await page.evaluate((selector) => {
            const scope = document.querySelector(selector);
            const owned = (control) =>
              document.querySelectorAll(`${selector} ${control}`).length;
            return {
              close: owned(".lb-btn.lb-close"),
              prev: owned(".lb-btn.lb-prev"),
              next: owned(".lb-btn.lb-next"),
              strayControls: [...document.querySelectorAll(".lb-btn")].filter(
                (button) => !scope?.contains(button),
              ).length,
            };
          }, DIALOG);

          assertEqual(
            controls.close,
            1,
            "the close control should be a descendant of the dialog",
          );
          assertEqual(
            controls.prev,
            1,
            "the previous control should be a descendant of the dialog",
          );
          assertEqual(
            controls.next,
            1,
            "the next control should be a descendant of the dialog",
          );
          assertEqual(
            controls.strayControls,
            0,
            "no lightbox control should live outside the dialog it operates",
          );

          await assertFocusOn(
            page,
            `${DIALOG} .lb-close`,
            "opening the dialog should move focus into it",
          );
          assertIncludes(
            await currentLightboxImage(page),
            "bathr-01",
            "the dialog should display the item that opened it",
          );

          await page.keyboard.press("Escape");

          await assertDialogClosed(page, "after Escape");
          await assertFocusOn(
            page,
            itemSelector(1),
            "closing the dialog should restore focus to the originating gallery anchor",
          );
        },
      );
    },
  },

  {
    name: "lightbox-space-opens-and-arrows-change-item",
    async run({ browser, baseURL }) {
      await withPage(
        browser,
        { baseURL, viewport: DESKTOP_VIEWPORT },
        async ({ page }) => {
          await openPage(page, GALLERY_PAGE);

          await page.locator(itemSelector(2)).focus();
          const scrollBeforeSpace = await page.evaluate(() => window.scrollY);

          await page.keyboard.press("Space");

          await assertDialogOpen(page, "after Space on a gallery anchor");
          assertEqual(
            await page.evaluate(() => window.scrollY),
            scrollBeforeSpace,
            "Space should activate the item rather than scroll the page",
          );
          assertIncludes(
            await currentLightboxImage(page),
            "bathr-02",
            "the dialog should display the item that opened it",
          );

          await page.keyboard.press("ArrowRight");
          assertIncludes(
            await currentLightboxImage(page),
            "bathr-03",
            "ArrowRight should advance to the next item",
          );

          await page.locator(`${DIALOG} .lb-next`).click();
          assertIncludes(
            await currentLightboxImage(page),
            "bathr-04",
            "the next control should advance to the next item",
          );

          await page.locator(`${DIALOG} .lb-prev`).click();
          assertIncludes(
            await currentLightboxImage(page),
            "bathr-03",
            "the previous control should step back one item",
          );

          await page.keyboard.press("ArrowLeft");
          assertIncludes(
            await currentLightboxImage(page),
            "bathr-02",
            "ArrowLeft should step back one item",
          );

          for (let step = 0; step < 4; step += 1) {
            await page.keyboard.press("Tab");
            await assertFocusWithin(
              page,
              DIALOG,
              `Tab step ${step + 1} should keep focus inside the open dialog`,
            );
          }

          await page.keyboard.press("Escape");

          await assertDialogClosed(page, "after Escape");
          await assertFocusOn(
            page,
            itemSelector(2),
            "closing the dialog should restore focus to the originating gallery anchor",
          );
        },
      );
    },
  },
];

export { lightboxScenarios };
