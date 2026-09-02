import { expect, test } from "@playwright/test";

import {
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
  expectNoDocumentOverflow,
} from "./helpers/runtime.mjs";

const LEGAL_PATHS = Object.freeze([
  "/polityka-prywatnosci.html",
  "/regulamin.html",
  "/cookies.html",
]);

const SOCIAL_LINKS = Object.freeze([
  { label: "GitHub", href: "https://github.com/KPKrol85" },
  { label: "Facebook", href: "https://www.facebook.com/kpkrol85" },
  { label: "X", href: "https://x.com/KP_Code_85" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/kp-code/" },
  { label: "Instagram", href: "https://www.instagram.com/kp_code_/" },
]);

const VIEWPORTS = Object.freeze([
  { name: "mobile", width: 390, height: 844, columns: 1 },
  { name: "tablet", width: 800, height: 900, columns: 2 },
  { name: "desktop", width: 1440, height: 900, columns: 4 },
]);

const getFooterContrastRatios = (page) =>
  page.evaluate(() => {
    const parseRgb = (value) =>
      value
        .match(/[\d.]+/gu)
        .slice(0, 3)
        .map(Number);
    const luminance = (value) => {
      const channels = parseRgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (foreground, background) => {
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    };
    const samples = [
      [".footer__title", ".footer"],
      [".footer__list a", ".footer"],
      [".footer__social-link", ".footer"],
      [".footer__bottom p", ".footer__bottom"],
    ];

    return samples.map(([textSelector, backgroundSelector]) => {
      const text = document.querySelector(textSelector);
      const background = document.querySelector(backgroundSelector);
      if (!text || !background) return 0;
      return contrast(
        getComputedStyle(text).color,
        getComputedStyle(background).backgroundColor,
      );
    });
  });

const getFooterThemeContrastPhases = (page, theme) =>
  page.evaluate(async (nextTheme) => {
    const parseRgb = (value) =>
      value
        .match(/[\d.]+/gu)
        .slice(0, 3)
        .map(Number);
    const luminance = (value) => {
      const channels = parseRgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (foreground, background) => {
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    };
    const snapshot = () => {
      const samples = [
        [".footer__title", ".footer"],
        [".footer__list a", ".footer"],
        [".footer__social-link", ".footer"],
        [".footer__bottom p", ".footer__bottom"],
      ];

      return samples.map(([textSelector, backgroundSelector]) => {
        const text = document.querySelector(textSelector);
        const background = document.querySelector(backgroundSelector);
        if (!text || !background) return 0;
        return contrast(
          getComputedStyle(text).color,
          getComputedStyle(background).backgroundColor,
        );
      });
    };
    const link = document.querySelector(".footer__list a");
    const transitionEnd = new Promise((resolve) => {
      link.addEventListener(
        "transitionend",
        (event) => {
          if (event.propertyName === "color") resolve();
        },
        { once: true },
      );
    });

    document.documentElement.dataset.theme = nextTheme;
    const immediate = snapshot();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const intermediate = snapshot();
    await transitionEnd;

    return { immediate, intermediate, settled: snapshot() };
  }, theme);

test("shared footer exposes the approved responsive, legal, and social contract", async ({
  page,
  request,
}) => {
  const diagnostics = collectRuntimeDiagnostics(page);

  for (const path of LEGAL_PATHS) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/index.html", { waitUntil: "networkidle" });

    const footer = page.locator(".footer");
    const columns = footer.locator(".footer__column");
    await expect(columns).toHaveCount(4);
    const columnOrder = await columns.evaluateAll((footerColumns) =>
      footerColumns.map((column) => {
        const headingId = column.getAttribute("aria-labelledby");
        return document.getElementById(headingId)?.textContent.trim();
      }),
    );
    expect(columnOrder).toEqual(["Marka", "Oferta", "Informacje", "Kontakt"]);
    const brandColumn = footer.locator(".footer__column--brand");
    const brandBlock = brandColumn.locator(".footer__brand-block");
    await expect(brandColumn.locator(".footer__brand-text")).toHaveText(
      "Lauren English",
    );
    await expect(brandColumn.locator(".footer__text")).toHaveText(
      "Indywidualna nauka angielskiego dopasowana do Twoich celów, poziomu i tempa. Spokojnie, konkretnie i bez chaosu.",
    );
    const brandLayout = await brandBlock.evaluate((block) => {
      const column = block.closest(".footer__column--brand");
      const logo = block.querySelector(".footer__logo-image");
      const name = block.querySelector(".footer__brand-text");
      const description = block.querySelector(".footer__text");
      const blockRect = block.getBoundingClientRect();
      const columnRect = column.getBoundingClientRect();
      const logoRect = logo.getBoundingClientRect();
      const nameRect = name.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();

      return {
        blockMaxWidth: getComputedStyle(block).maxWidth,
        blockWidth: blockRect.width,
        columnWidth: columnRect.width,
        descriptionTop: descriptionRect.top,
        logoBottom: logoRect.bottom,
        nameBottom: nameRect.bottom,
        nameTop: nameRect.top,
      };
    });
    expect(brandLayout.blockMaxWidth).not.toBe("none");
    expect(brandLayout.blockWidth).toBeLessThanOrEqual(brandLayout.columnWidth);
    expect(brandLayout.nameTop).toBeGreaterThanOrEqual(brandLayout.logoBottom);
    expect(brandLayout.descriptionTop).toBeGreaterThanOrEqual(
      brandLayout.nameBottom,
    );
    await expect(footer.locator('a[href="tel:+48533537091"]')).toHaveText(
      "+48 533 537 091",
    );
    await expect(
      footer.locator('a[href="mailto:kontakt@kp-code.pl"]'),
    ).toHaveText("kontakt@kp-code.pl");
    const contactLinks = await footer
      .locator(".footer__contact-link")
      .evaluateAll((links) =>
        links.map((link) => {
          const icon = link.querySelector(":scope > .footer__contact-icon");
          const text = link.querySelector(":scope > .footer__contact-text");
          const iconRect = icon?.getBoundingClientRect();
          const linkStyle = getComputedStyle(link);
          const iconStyle = icon ? getComputedStyle(icon) : null;

          return {
            alignItems: linkStyle.alignItems,
            display: linkStyle.display,
            gap: Number.parseFloat(linkStyle.columnGap),
            href: link.getAttribute("href"),
            icon: icon
              ? {
                  ariaHidden: icon.getAttribute("aria-hidden"),
                  fill: icon.getAttribute("fill"),
                  focusable: icon.getAttribute("focusable"),
                  flexShrink: iconStyle.flexShrink,
                  height: iconRect.height,
                  inheritedColor: iconStyle.fill === linkStyle.color,
                  pathCount: icon.querySelectorAll(":scope > path").length,
                  viewBox: icon.getAttribute("viewBox"),
                  width: iconRect.width,
                }
              : null,
            svgCount: link.querySelectorAll(":scope > svg").length,
            text: text?.textContent.trim(),
          };
        }),
      );
    expect(contactLinks).toHaveLength(2);
    for (const [index, expected] of [
      { href: "tel:+48533537091", text: "+48 533 537 091" },
      { href: "mailto:kontakt@kp-code.pl", text: "kontakt@kp-code.pl" },
    ].entries()) {
      expect(contactLinks[index]).toMatchObject({
        alignItems: "center",
        display: "inline-flex",
        href: expected.href,
        icon: {
          ariaHidden: "true",
          fill: "currentColor",
          focusable: "false",
          flexShrink: "0",
          inheritedColor: true,
          pathCount: 1,
          viewBox: "0 0 640 640",
        },
        svgCount: 1,
        text: expected.text,
      });
      expect(contactLinks[index].gap).toBeGreaterThan(0);
      expect(contactLinks[index].icon.width).toBe(20);
      expect(contactLinks[index].icon.height).toBe(20);
    }
    await expect(footer.locator("address")).toHaveText(
      "ul. Marynarki Wojennej 12/31, 33-100 Tarnów, Polska",
    );
    await expect(
      footer.getByRole("link", { name: "Przejdź do strony kontaktowej" }),
    ).toHaveCount(0);
    await expect(
      footer.getByRole("link", { name: "Kontakt", exact: true }),
    ).toHaveCount(1);

    const socialHeading = footer.getByRole("heading", {
      name: "SOCIAL MEDIA",
      exact: true,
    });
    await expect(socialHeading).toBeVisible();
    const headingTypography = await socialHeading.evaluate((heading) => {
      const columnHeading = document.querySelector(".footer__title");
      const columnStyle = getComputedStyle(columnHeading);
      const socialStyle = getComputedStyle(heading);
      return {
        columnSize: Number.parseFloat(columnStyle.fontSize),
        letterSpacing: Number.parseFloat(socialStyle.letterSpacing),
        socialSize: Number.parseFloat(socialStyle.fontSize),
      };
    });
    expect(headingTypography.socialSize).toBeLessThan(
      headingTypography.columnSize,
    );
    expect(headingTypography.letterSpacing).toBeGreaterThan(0);

    for (const path of LEGAL_PATHS) {
      await expect(footer.locator(`a[href="${path}"]`)).toHaveCount(1);
    }

    const socialLinks = await footer
      .locator(".footer__social-link")
      .evaluateAll((links) =>
        links.map((link) => {
          const icon = link.querySelector(":scope > svg.footer__social-icon");
          const linkRect = link.getBoundingClientRect();
          const iconRect = icon?.getBoundingClientRect();

          return {
            ariaLabel: link.getAttribute("aria-label"),
            href: link.getAttribute("href"),
            icon: icon
              ? {
                  ariaHidden: icon.getAttribute("aria-hidden"),
                  fill: icon.getAttribute("fill"),
                  focusable: icon.getAttribute("focusable"),
                  height: iconRect.height,
                  pathCount: icon.querySelectorAll(":scope > path").length,
                  viewBox: icon.getAttribute("viewBox"),
                  width: iconRect.width,
                }
              : null,
            linkHeight: linkRect.height,
            linkWidth: linkRect.width,
            rel: link.getAttribute("rel"),
            svgCount: link.querySelectorAll(":scope > svg").length,
            target: link.getAttribute("target"),
            text: link.textContent.trim(),
          };
        }),
      );
    expect(socialLinks).toHaveLength(5);
    for (const [index, { label, href }] of SOCIAL_LINKS.entries()) {
      expect(socialLinks[index]).toMatchObject({
        ariaLabel: `${label} — KP_Code Digital Studio`,
        href,
        icon: {
          ariaHidden: "true",
          fill: "currentColor",
          focusable: "false",
          height: 24,
          pathCount: 1,
          viewBox: "0 0 448 512",
          width: 24,
        },
        rel: "noopener noreferrer",
        svgCount: 1,
        target: "_blank",
        text: "",
      });
      expect(socialLinks[index].linkHeight).toBeGreaterThanOrEqual(44);
      expect(socialLinks[index].linkWidth).toBeGreaterThanOrEqual(44);
    }

    await expect(footer.locator(".footer__bottom p")).toHaveText(
      "© 2026 KP_Code Digital Studio | Wszelkie prawa zastrzeżone.",
    );
    const columnCount = await footer
      .locator(".footer__grid")
      .evaluate(
        (grid) =>
          getComputedStyle(grid).gridTemplateColumns.split(/\s+/u).length,
      );
    expect(columnCount, viewport.name).toBe(viewport.columns);
    if (viewport.name === "desktop") {
      const columnWidths = await footer
        .locator(".footer__column")
        .evaluateAll((columns) =>
          columns.map((column) => column.getBoundingClientRect().width),
        );
      expect(columnWidths[0]).toBeGreaterThan(columnWidths[1]);
      expect(columnWidths[1]).toBeCloseTo(columnWidths[2], 1);
      expect(columnWidths[2]).toBeCloseTo(columnWidths[3], 1);
      expect(brandLayout.blockWidth).toBeLessThan(brandLayout.columnWidth);
    }

    const lightContrastRatios = await getFooterContrastRatios(page);
    expect(
      Math.min(...lightContrastRatios),
      `${viewport.name} light footer contrast`,
    ).toBeGreaterThanOrEqual(4.5);

    const darkContrastPhases = await getFooterThemeContrastPhases(page, "dark");
    for (const [phase, contrastRatios] of Object.entries(darkContrastPhases)) {
      expect(
        Math.min(...contrastRatios),
        `${viewport.name} dark ${phase} footer contrast`,
      ).toBeGreaterThanOrEqual(4.5);
    }

    const iconColors = await footer
      .locator(".footer__social-link")
      .evaluateAll((links) =>
        links.map((link) => {
          const icon = link.querySelector(".footer__social-icon");
          return {
            icon: getComputedStyle(icon).fill,
            link: getComputedStyle(link).color,
          };
        }),
      );
    expect(iconColors.every(({ icon, link }) => icon === link)).toBe(true);

    const firstSocialLink = footer.locator(".footer__social-link").first();
    const defaultSocialColor = await firstSocialLink.evaluate(
      (link) => getComputedStyle(link).color,
    );
    await firstSocialLink.hover();
    expect(
      await firstSocialLink.evaluate((link) => getComputedStyle(link).color),
    ).not.toBe(defaultSocialColor);
    expect(
      await firstSocialLink.evaluate(
        (link) => getComputedStyle(link).transform !== "none",
      ),
    ).toBe(true);

    await firstSocialLink.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const focusState = await firstSocialLink.evaluate((link) => {
      const style = getComputedStyle(link);
      return {
        focusVisible: link.matches(":focus-visible"),
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focusState.focusVisible).toBe(true);
    expect(focusState.outlineStyle).not.toBe("none");
    expect(focusState.outlineWidth).toBeGreaterThan(0);

    await expectNoDocumentOverflow(page);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionLink = page.locator(".footer__social-link").first();
  await reducedMotionLink.hover();
  await expect(reducedMotionLink).toHaveCSS("transform", "none");

  expectCleanDiagnostics(diagnostics);
});
