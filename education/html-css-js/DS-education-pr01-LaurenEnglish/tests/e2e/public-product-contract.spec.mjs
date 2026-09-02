import { expect, test } from "@playwright/test";

import { INDEXABLE_PAGES } from "../../scripts/site-config.mjs";
import {
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
} from "./helpers/runtime.mjs";

const prohibitedPublicMessaging = Object.freeze([
  /\b(?:portfolio|demo|mockup|simulation)\b/iu,
  /projekt koncepcyjny/iu,
  /aktywną ofertą handlową/iu,
]);

test("indexable pages open without blocking portfolio messaging", async ({
  page,
}) => {
  const diagnostics = collectRuntimeDiagnostics(page);

  for (const { runtimePath } of INDEXABLE_PAGES) {
    await page.goto(runtimePath, { waitUntil: "networkidle" });
    await expect(page.getByRole("main")).toBeVisible();
    // An acknowledged project disclosure stays closed and out of the page copy.
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    const publicText = await page.locator("body").innerText();
    for (const pattern of prohibitedPublicMessaging) {
      expect(publicText, `${runtimePath}: prohibited public messaging`).not.toMatch(
        pattern,
      );
    }
  }

  expectCleanDiagnostics(diagnostics);
});
