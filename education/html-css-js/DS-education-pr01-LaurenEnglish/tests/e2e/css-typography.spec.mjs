import { expect, test } from "@playwright/test";

import {
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
} from "./helpers/runtime.mjs";

const THEME_NAMES = Object.freeze(["light", "dark"]);
const RELAXED_TEXT_SELECTORS = Object.freeze([
  ".cta-panel__description",
  ".materials-access__description",
]);

test("relaxed descriptions resolve the canonical line-height in both themes", async ({
  page,
}) => {
  const diagnostics = collectRuntimeDiagnostics(page);
  await page.goto("/materialy.html", { waitUntil: "networkidle" });

  for (const theme of THEME_NAMES) {
    await page.evaluate(
      (selectedTheme) => localStorage.setItem("theme", selectedTheme),
      theme,
    );
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

    const contract = await page.evaluate((selectors) => {
      const rootStyle = getComputedStyle(document.documentElement);
      const token = Number.parseFloat(
        rootStyle.getPropertyValue("--line-height-relaxed"),
      );
      const elements = selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return { selector };
        const style = getComputedStyle(element);
        return {
          fontSize: Number.parseFloat(style.fontSize),
          lineHeight: Number.parseFloat(style.lineHeight),
          selector,
        };
      });
      return { elements, token };
    }, RELAXED_TEXT_SELECTORS);

    expect(contract.token).toBe(1.6);
    expect(contract.elements).toHaveLength(RELAXED_TEXT_SELECTORS.length);
    for (const element of contract.elements) {
      expect(element.fontSize, `${theme}: ${element.selector}`).toBeGreaterThan(
        0,
      );
      expect(element.lineHeight, `${theme}: ${element.selector}`).toBeCloseTo(
        element.fontSize * contract.token,
        5,
      );
    }
  }

  expectCleanDiagnostics(diagnostics);
});
