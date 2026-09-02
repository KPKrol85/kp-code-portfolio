import { expect, test } from "@playwright/test";

import {
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
  expectNoDocumentOverflow,
} from "./helpers/runtime.mjs";

const VIEWPORTS = Object.freeze([
  { name: "mobile", width: 390, height: 844, columns: 1 },
  { name: "tablet", width: 780, height: 1024, columns: 2 },
  { name: "desktop", width: 1440, height: 900, columns: 2 },
]);

test("O mnie portrait remains proportioned and aligned responsively", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  const diagnostics = collectRuntimeDiagnostics(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/index.html", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });

    const section = page.locator("#about");
    const image = section.locator(
      '.about__portrait picture > img[src="/assets/img/about/lauren.jpg"]',
    );
    await section.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await image.evaluate((element) => element.decode());
    await expect(section.locator(".about__eyebrow")).toHaveText(
      "POZNAJ LAUREN",
    );
    await expect(section.locator(".section__title")).toHaveText("O mnie");
    await expect(section.locator(".about__highlight")).toHaveCount(3);
    await expect(section.locator(".about__badges")).toHaveCount(0);
    await expect(section.locator(".about__card .card__title")).toHaveText(
      "Jak pracuję",
    );

    const metrics = await section.evaluate((aboutSection) => {
      const grid = aboutSection.querySelector(".about__grid");
      const visual = aboutSection.querySelector(".about__visual");
      const portraitWrapper = visual?.querySelector(".about__portrait");
      const portrait = visual?.querySelector("img");
      const card = visual?.querySelector(".about__card");
      if (!grid || !visual || !portraitWrapper || !portrait || !card) {
        return null;
      }

      const gridStyle = getComputedStyle(grid);
      const visualStyle = getComputedStyle(visual);
      const portraitWrapperStyle = getComputedStyle(portraitWrapper);
      const overlayStyle = getComputedStyle(portraitWrapper, "::after");
      const imageStyle = getComputedStyle(portrait);
      const rootStyle = getComputedStyle(document.documentElement);
      const visualBox = visual.getBoundingClientRect();
      const portraitWrapperBox = portraitWrapper.getBoundingClientRect();
      const imageBox = portrait.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();

      return {
        borderRadius: imageStyle.borderRadius,
        cardTop: cardBox.top,
        cardWidth: cardBox.width,
        columnCount: gridStyle.gridTemplateColumns.split(/\s+/u).length,
        display: imageStyle.display,
        imageBottom: imageBox.bottom,
        imageHeight: imageBox.height,
        imageLeft: imageBox.left,
        imageRight: imageBox.right,
        imageWidth: imageBox.width,
        intrinsicHeight: portrait.naturalHeight,
        intrinsicWidth: portrait.naturalWidth,
        objectFit: imageStyle.objectFit,
        objectPosition: imageStyle.objectPosition,
        overlayBackground: overlayStyle.backgroundImage,
        overlayPointerEvents: overlayStyle.pointerEvents,
        portraitWrapperBottom: portraitWrapperBox.bottom,
        portraitWrapperRadius: portraitWrapperStyle.borderRadius,
        radiusToken: rootStyle.getPropertyValue("--radius-lg").trim(),
        rowGap: Number.parseFloat(visualStyle.rowGap),
        sourceHeight: portrait.getAttribute("height"),
        sourceWidth: portrait.getAttribute("width"),
        viewportWidth: document.documentElement.clientWidth,
        visualWidth: visualBox.width,
      };
    });

    expect(metrics, viewport.name).not.toBeNull();
    expect(metrics.columnCount, viewport.name).toBe(viewport.columns);
    expect(metrics.display).toBe("block");
    expect(metrics.borderRadius).toBe(metrics.radiusToken);
    expect(metrics.portraitWrapperRadius).toBe(metrics.radiusToken);
    expect(metrics.objectFit).toBe("contain");
    expect(metrics.objectPosition).toBe("50% 50%");
    expect(metrics.overlayBackground).toContain("radial-gradient");
    expect(metrics.overlayPointerEvents).toBe("none");
    expect(metrics.intrinsicWidth).toBe(420);
    expect(metrics.intrinsicHeight).toBe(480);
    expect(metrics.sourceWidth).toBe("420");
    expect(metrics.sourceHeight).toBe("480");
    expect(metrics.imageWidth).toBeLessThanOrEqual(420.5);
    expect(metrics.imageWidth).toBeGreaterThan(0);
    expect(metrics.imageWidth / metrics.imageHeight).toBeCloseTo(420 / 480, 2);
    const expectedPortraitWidthDifference = viewport.width < 480 ? 32 : 0;
    expect(metrics.visualWidth - metrics.imageWidth, viewport.name).toBeCloseTo(
      expectedPortraitWidthDifference,
      1,
    );
    expect(
      Math.abs(metrics.cardWidth - metrics.visualWidth),
    ).toBeLessThanOrEqual(1);
    expect(metrics.cardTop - metrics.portraitWrapperBottom).toBeCloseTo(
      metrics.rowGap,
      1,
    );
    expect(metrics.imageLeft).toBeGreaterThanOrEqual(-0.5);
    expect(metrics.imageRight).toBeLessThanOrEqual(metrics.viewportWidth + 0.5);
    await expectNoDocumentOverflow(page);

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect
      .poll(() =>
        section
          .locator(".about__portrait")
          .evaluate(
            (element) => getComputedStyle(element, "::after").backgroundImage,
          ),
      )
      .toContain("radial-gradient");
    await expectNoDocumentOverflow(page);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/uslugi.html", { waitUntil: "networkidle" });
  const aboutLink = page.locator('.nav__link[href="/index.html#about"]');
  await expect(aboutLink).toHaveText("O mnie");
  await aboutLink.click();
  await expect(page).toHaveURL(/\/index\.html#about$/);
  const aboutHeading = page.locator("#about .section__title");
  await expect
    .poll(() =>
      aboutHeading.evaluate((element) => document.activeElement === element),
    )
    .toBe(true);
  await expect(aboutHeading).toHaveAttribute("tabindex", "-1");
  await expect(aboutHeading).toHaveAttribute("data-anchor-focus-target", "");
  await expect(page.locator("#about")).not.toHaveAttribute("tabindex", "-1");

  expectCleanDiagnostics(diagnostics);
});
