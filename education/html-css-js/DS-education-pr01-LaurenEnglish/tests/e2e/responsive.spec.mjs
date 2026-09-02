import { expect, test } from "@playwright/test";

import { SITE } from "../../scripts/site-config.mjs";
import {
  PRIMARY_PAGES,
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
  expectElementsContained,
  expectFocusDoesNotMoveViewport,
  expectNoDocumentOverflow,
} from "./helpers/runtime.mjs";

const DESKTOP_NAV_MIN_WIDTH = 1280;
const POLISH_SAMPLE = "Zażółć gęślą jaźń — ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż";

const VIEWPORTS = Object.freeze([
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]);

const expectSharedLogoContract = async (page) => {
  const headerLogo = page.locator(".header__logo");
  const footerLogo = page.locator(".footer__brand");
  const logoImages = page.locator(".header__logo-image, .footer__logo-image");

  await expect(headerLogo).toHaveAttribute("aria-label", SITE.name);
  await expect(headerLogo).toContainText(SITE.name);
  await expect(footerLogo).toContainText(SITE.name);
  await expect(
    page.getByRole("link", { name: SITE.name, exact: true }),
  ).toHaveCount(2);
  await expect(logoImages).toHaveCount(2);
  await expect(page.locator(".header__logo-mark")).toHaveCount(0);

  const metrics = await logoImages.evaluateAll((images) =>
    images.map((image) => {
      const rect = image.getBoundingClientRect();
      const linkRect = image.closest("a").getBoundingClientRect();
      const style = getComputedStyle(image);
      return {
        alt: image.getAttribute("alt"),
        complete: image.complete,
        display: style.display,
        height: rect.height,
        heightAttribute: image.getAttribute("height"),
        insideLink:
          rect.left >= linkRect.left - 0.5 &&
          rect.right <= linkRect.right + 0.5 &&
          rect.top >= linkRect.top - 0.5 &&
          rect.bottom <= linkRect.bottom + 0.5,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        objectFit: style.objectFit,
        source: new URL(image.currentSrc).pathname,
        width: rect.width,
        widthAttribute: image.getAttribute("width"),
      };
    }),
  );

  for (const metric of metrics) {
    expect(metric).toMatchObject({
      alt: "",
      complete: true,
      display: "block",
      heightAttribute: String(SITE.brandLogo.height),
      insideLink: true,
      naturalHeight: SITE.brandLogo.height,
      naturalWidth: SITE.brandLogo.width,
      objectFit: "contain",
      source: SITE.brandLogo.path,
      widthAttribute: String(SITE.brandLogo.width),
    });
    expect(metric.width).toBeGreaterThan(0);
    expect(metric.height).toBeGreaterThan(0);
    expect(metric.width / metric.height).toBeCloseTo(
      SITE.brandLogo.width / SITE.brandLogo.height,
      5,
    );
  }

  const headerOverlaps = await page
    .locator(".header__inner")
    .evaluate((header) => {
      const visibleRects = [
        header.querySelector(".header__logo"),
        header.querySelector(".nav__toggle"),
        header.querySelector(".nav__drawer"),
        header.querySelector(".header__actions"),
      ]
        .filter((element) => {
          if (!element) return false;
          const style = getComputedStyle(element);
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            !element.closest("[inert]")
          );
        })
        .map((element) => ({
          className: element.className,
          rect: element.getBoundingClientRect(),
        }));

      return visibleRects.flatMap((first, index) =>
        visibleRects.slice(index + 1).flatMap((second) => {
          const overlaps =
            first.rect.left < second.rect.right - 0.5 &&
            first.rect.right > second.rect.left + 0.5 &&
            first.rect.top < second.rect.bottom - 0.5 &&
            first.rect.bottom > second.rect.top + 0.5;
          return overlaps ? [`${first.className} / ${second.className}`] : [];
        }),
      );
    });
  expect(headerOverlaps).toEqual([]);
  await expectElementsContained(logoImages);
};

const expectTypographyContract = async (page) => {
  const typography = await page.evaluate(async (polishSample) => {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('700 2rem "Literata"', polishSample),
      document.fonts.load('400 1rem "Inter"', polishSample),
    ]);

    const rootStyle = getComputedStyle(document.documentElement);
    const getMetrics = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        family: style.fontFamily,
        left: rect.left,
        right: rect.right,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    };
    const uiSelector = [
      ".nav__link",
      ".button",
      ".badge",
      ".accordion__trigger",
      "input",
      "select",
      "textarea",
      "label",
      "table",
    ].join(",");

    return {
      bodyFamily: getComputedStyle(document.body).fontFamily,
      headingFamilyToken: rootStyle
        .getPropertyValue("--font-family-heading")
        .trim(),
      bodyFamilyToken: rootStyle.getPropertyValue("--font-family-body").trim(),
      headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
        .filter((heading) => !heading.closest(".sr-only, [hidden]"))
        .map(getMetrics),
      interLoaded: document.fonts.check('400 1rem "Inter"', polishSample),
      layoutShift: window.__typographyLayoutShift ?? 0,
      literataLoaded: document.fonts.check('700 2rem "Literata"', polishSample),
      ui: [...document.querySelectorAll(uiSelector)].map(getMetrics),
      viewportWidth: document.documentElement.clientWidth,
    };
  }, POLISH_SAMPLE);

  expect(typography.headingFamilyToken.replaceAll(" ", "")).toBe(
    '"Literata",serif',
  );
  expect(typography.bodyFamilyToken.replaceAll(" ", "")).toBe(
    '"Inter",sans-serif',
  );
  expect(typography.bodyFamily).toContain("Inter");
  expect(typography.literataLoaded).toBe(true);
  expect(typography.interLoaded).toBe(true);
  expect(typography.layoutShift).toBeLessThanOrEqual(0.1);
  expect(typography.headings.length).toBeGreaterThan(0);
  expect(typography.ui.length).toBeGreaterThan(0);

  for (const heading of typography.headings) {
    expect(heading.family).toContain("Literata");
    expect(heading.left).toBeGreaterThanOrEqual(-0.5);
    expect(heading.right).toBeLessThanOrEqual(typography.viewportWidth + 0.5);
    expect(heading.scrollWidth).toBeLessThanOrEqual(heading.clientWidth + 1);
  }
  for (const element of typography.ui) {
    expect(element.family).toContain("Inter");
  }
};

test.describe("responsive production contracts", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop");
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}px contains pages, controls, CTAs, and cards`, async ({
      page,
    }) => {
      await page.addInitScript(() => {
        window.__typographyLayoutShift = 0;
        if (!("PerformanceObserver" in window)) return;
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const affectsHeading = entry.sources?.some(
                ({ node }) =>
                  node instanceof Element &&
                  (node.matches("h1,h2,h3,h4,h5,h6") ||
                    Boolean(node.closest("h1,h2,h3,h4,h5,h6"))),
              );
              if (!entry.hadRecentInput && affectsHeading) {
                window.__typographyLayoutShift += entry.value;
              }
            }
          }).observe({ buffered: true, type: "layout-shift" });
        } catch {
          // Layout Instability API support is verified where the browser exposes it.
        }
      });
      await page.setViewportSize(viewport);
      const diagnostics = collectRuntimeDiagnostics(page);

      for (const publicPage of PRIMARY_PAGES) {
        const response = await page.goto(publicPage.path, {
          waitUntil: "networkidle",
        });
        expect(response?.ok()).toBe(true);
        await expectNoDocumentOverflow(page);
        await expectElementsContained(
          page.locator(".button:visible, .card:visible"),
        );
        await expectFocusDoesNotMoveViewport(page);
      }

      await page.goto("/index.html", { waitUntil: "networkidle" });
      await expectSharedLogoContract(page);
      await expectTypographyContract(page);
      expect(
        await page.evaluate(
          (path) =>
            performance
              .getEntriesByType("resource")
              .filter((entry) => new URL(entry.name).pathname === path).length,
          SITE.brandLogo.path,
        ),
      ).toBe(1);

      await page.locator("html").evaluate((element) => {
        element.dataset.theme = "dark";
      });
      await expectSharedLogoContract(page);
      await page.locator("html").evaluate((element) => {
        element.dataset.theme = "light";
      });
      const usesMobileNavigation = viewport.width < DESKTOP_NAV_MIN_WIDTH;
      const navToggle = page.getByRole("button", { name: "Otwórz menu" });
      const desktopTheme = page.locator(".header__actions [data-theme-toggle]");

      await expectElementsContained(
        page.locator(
          ".header__logo, .nav__toggle:visible, .header__actions:visible",
        ),
      );

      if (usesMobileNavigation) {
        await expect(navToggle).toBeVisible();
        await expect(desktopTheme).toBeHidden();
        if (viewport.width === 320) {
          await page.locator("html").evaluate((element) => {
            element.style.fontSize = "125%";
          });
          await expectNoDocumentOverflow(page);
        }
        await navToggle.click();
        const drawer = page.locator("[data-drawer]");
        await expect(drawer).toBeVisible();
        const box = await drawer.boundingBox();
        expect(box).not.toBeNull();
        expect(box.x).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
        expect(box.y).toBeGreaterThanOrEqual(-0.5);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
        await page.keyboard.press("Escape");
        expect(await drawer.evaluate((element) => element.inert)).toBe(true);
      } else {
        await expect(navToggle).toBeHidden();
        await expect(desktopTheme).toBeVisible();
        const navigationMetrics = await page
          .locator(".header__inner")
          .evaluate((header) => {
            const links = [...header.querySelectorAll(".nav__link")];
            return {
              fits: header.scrollWidth <= header.clientWidth,
              links: links.map((link) => {
                const rect = link.getBoundingClientRect();
                const style = getComputedStyle(link);
                return {
                  height: rect.height,
                  lineHeight: Number.parseFloat(style.lineHeight),
                  paddingBlock:
                    Number.parseFloat(style.paddingTop) +
                    Number.parseFloat(style.paddingBottom),
                  whiteSpace: style.whiteSpace,
                  width: rect.width,
                };
              }),
            };
          });
        expect(navigationMetrics.fits).toBe(true);
        for (const link of navigationMetrics.links) {
          expect(link.width).toBeGreaterThan(0);
          expect(link.whiteSpace).toBe("nowrap");
          expect(link.height).toBeLessThanOrEqual(
            link.lineHeight + link.paddingBlock + 1,
          );
        }
      }

      await expectElementsContained(
        page.locator(
          ".hero__actions .button, .grid--pricing .card",
        ),
      );

      await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
        localStorage.setItem("theme", "dark");
      });
      await page.goto("/pakiety.html", { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expectNoDocumentOverflow(page);
      await expectElementsContained(
        page.locator(".button:visible, .card:visible"),
      );
      await expectFocusDoesNotMoveViewport(page);
      await page.evaluate(() => localStorage.removeItem("theme"));
      await expectNoDocumentOverflow(page);
      expectCleanDiagnostics(diagnostics);
    });
  }
});
