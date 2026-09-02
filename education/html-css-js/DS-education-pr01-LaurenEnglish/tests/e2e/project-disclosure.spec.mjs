import { expect, test } from "@playwright/test";

import { PROJECT_DISCLOSURE } from "../../scripts/site-config.mjs";
import { PROJECT_DISCLOSURE_COPY } from "../../scripts/shared-shell.mjs";
import {
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
} from "./helpers/runtime.mjs";

const EMPTY_STORAGE_STATE = { cookies: [], origins: [] };

const getDialog = (page) =>
  page.getByRole("dialog", { name: PROJECT_DISCLOSURE_COPY.title });

test.describe("project disclosure modal", () => {
  test.use({ storageState: EMPTY_STORAGE_STATE });

  test("opens on a first visit with accessible content and focus", async ({
    page,
  }) => {
    const diagnostics = collectRuntimeDiagnostics(page);
    await page.goto("/index.html", { waitUntil: "networkidle" });

    const dialog = getDialog(page);
    const dismissButton = dialog.getByRole("button", {
      name: PROJECT_DISCLOSURE_COPY.dismissLabel,
    });

    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(PROJECT_DISCLOSURE_COPY.eyebrow);
    await expect(dialog).toContainText(PROJECT_DISCLOSURE_COPY.description);
    for (const { label, href } of PROJECT_DISCLOSURE_COPY.links) {
      await expect(dialog.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }

    const openState = await dialog.evaluate((element) => ({
      focusIsInside: element.contains(document.activeElement),
      isModal: element.matches(":modal"),
      rootIsLocked: document.documentElement.classList.contains(
        "has-project-disclosure",
      ),
    }));
    expect(openState).toEqual({
      focusIsInside: true,
      isModal: true,
      rootIsLocked: true,
    });

    await dismissButton.click();
    await expect(dialog).toBeHidden();
    expect(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        PROJECT_DISCLOSURE.storageKey,
      ),
    ).toBe(PROJECT_DISCLOSURE.version);
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("has-project-disclosure"),
      ),
    ).toBe(false);

    await page.reload({ waitUntil: "networkidle" });
    await expect(dialog).toBeHidden();
    expectCleanDiagnostics(diagnostics);
  });

  test("stays closed on excluded routes and reopens for a new version", async ({
    page,
  }) => {
    await page.goto("/regulamin.html", { waitUntil: "networkidle" });
    await expect(getDialog(page)).toBeHidden();

    await page.evaluate(
      (key) => localStorage.setItem(key, "acknowledged-older-version"),
      PROJECT_DISCLOSURE.storageKey,
    );
    await page.goto("/kontakt.html", { waitUntil: "networkidle" });
    await expect(getDialog(page)).toBeVisible();
  });
});
