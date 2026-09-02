import { expect, test } from "@playwright/test";

import {
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
} from "./helpers/runtime.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto("/materialy.html", { waitUntil: "domcontentloaded" });
});

test("enhances the canonical catalogue and resets combined filters", async ({
  page,
}) => {
  const diagnostics = collectRuntimeDiagnostics(page);
  const filters = page.getByRole("form", {
    name: "Filtry katalogu materiałów",
  });
  const cards = page.locator("[data-material-id]");
  const count = page.locator("[data-materials-count]");
  const emptyState = page.locator("[data-materials-empty]");
  const reset = page.getByRole("button", { name: "Wyczyść filtry" });

  await expect(filters).toBeVisible();
  await expect(cards).toHaveCount(15);
  await expect(count).toHaveText("Znaleziono 15 materiałów");
  await expect(emptyState).toBeHidden();
  await expect(reset).toBeDisabled();

  await page.getByLabel("Kategoria").selectOption("business");
  await page.getByLabel("Poziom").selectOption("B2");
  await page.getByLabel("Dostępność").selectOption("premium");
  await expect(cards).toHaveCount(1);
  await expect(cards).toHaveAttribute("data-material-id", "business-meetings");
  await expect(count).toHaveText("Znaleziono 1 materiał");
  await expect(reset).toBeEnabled();

  await page.getByLabel("Poziom").selectOption("C1");
  await page.getByLabel("Dostępność").selectOption("free");
  await expect(cards).toHaveCount(0);
  await expect(count).toHaveText("Znaleziono 0 materiałów");
  await expect(emptyState).toBeVisible();

  await reset.click();
  await expect(page.getByLabel("Kategoria")).toHaveValue("all");
  await expect(page.getByLabel("Poziom")).toHaveValue("all");
  await expect(page.getByLabel("Dostępność")).toHaveValue("all");
  await expect(cards).toHaveCount(15);
  await expect(count).toHaveText("Znaleziono 15 materiałów");
  await expect(emptyState).toBeHidden();
  await expect(reset).toBeDisabled();
  expectCleanDiagnostics(diagnostics);
});

test("keeps the fresh narrow catalogue visible without resizing", async ({
  page,
}) => {
  const diagnostics = collectRuntimeDiagnostics(page);
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto("/materialy.html", { waitUntil: "domcontentloaded" });

  const filters = page.getByRole("form", {
    name: "Filtry katalogu materiałów",
  });
  const list = page.locator("#materials-list");
  const cards = list.locator("[data-material-id]");
  const count = page.locator("[data-materials-count]");

  await expect(filters).toBeVisible();
  await expect(cards).toHaveCount(15);
  await expect(count).toHaveText("Znaleziono 15 materiałów");
  await list.scrollIntoViewIfNeeded();
  await expect(cards.first()).toBeVisible();

  const listState = await list.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      display: style.display,
      height: rect.height,
      opacity: style.opacity,
      pending: element.classList.contains("is-reveal-pending"),
      visibility: style.visibility,
      width: rect.width,
    };
  });
  const renderedCardCount = await cards.evaluateAll((elements) =>
    elements.filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }).length,
  );

  expect(listState.display).not.toBe("none");
  expect(listState.visibility).toBe("visible");
  expect(listState.opacity).toBe("1");
  expect(listState.width).toBeGreaterThan(0);
  expect(listState.height).toBeGreaterThan(0);
  expect(listState.pending).toBe(false);
  expect(renderedCardCount).toBe(15);
  expectCleanDiagnostics(diagnostics);
});

test("keeps meaningful canonical catalogue content without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/materialy.html", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Katalog materiałów" }),
  ).toBeVisible();
  await expect(page.locator("[data-materials-filters]")).toBeHidden();
  await expect(page.locator("[data-material-id]")).toHaveCount(15);
  await expect(
    page.getByRole("heading", {
      name: "Gramatyka bez chaosu – kluczowe czasy",
    }),
  ).toBeVisible();

  await context.close();
});
