const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

const ROUTES = [
  {
    name: "homepage",
    path: "/",
    waitFor(page) {
      return page.locator("main .hero").waitFor();
    },
  },
  {
    name: "category",
    path: "/kategoria.html",
    async waitFor(page) {
      await page.locator("[data-listing-grid]").waitFor();
      await page.waitForFunction(() => {
        const grid = document.querySelector("[data-listing-grid]");
        const state = document.querySelector("[data-listing-state]");
        return Boolean(
          grid && (grid.children.length > 0 || (state && !state.hasAttribute("hidden"))),
        );
      });
    },
  },
  {
    name: "product",
    path: "/produkt/outland-thermal-core-075l/",
    async waitFor(page) {
      await page.locator("[data-product-root]").waitFor();
      await expect(page.locator("[data-product-title]")).toHaveText(
        /Outland Thermal Core 0\.75L/i,
      );
    },
  },
  {
    name: "cart",
    path: "/koszyk.html",
    async beforeVisit(page) {
      await page.addInitScript(() => {
        localStorage.setItem(
          "outlandGearCart",
          JSON.stringify({
            version: 1,
            items: [{ id: 105, qty: 1 }],
          }),
        );
      });
    },
    async waitFor(page) {
      await page.locator("main.cart-page").waitFor();
      await page.waitForFunction(() => {
        const container = document.querySelector("[data-cart-container]");
        const summary = document.querySelector("[data-cart-summary]");
        return Boolean(
          container &&
          summary &&
          (container.children.length > 0 || summary.textContent.trim()),
        );
      });
    },
  },
  {
    name: "checkout",
    path: "/checkout.html",
    waitFor(page) {
      return page.locator("[data-checkout-form]").waitFor();
    },
  },
  {
    name: "contact",
    path: "/kontakt.html",
    waitFor(page) {
      return page.locator("[data-contact-form]").waitFor();
    },
  },
  {
    name: "travel kits",
    path: "/komplety/weekend-w-gorach/",
    async waitFor(page) {
      await page.locator("[data-kit-root]").waitFor();
      await page.locator("[data-kit-content]").waitFor();
      await expect(page.locator("[data-kit-title]")).not.toHaveText(/Komplety podróżne/i);
    },
  },
  {
    name: "about",
    path: "/o-nas.html",
    waitFor(page) {
      return page.locator("main.about-page").waitFor();
    },
  },
  {
    name: "terms",
    path: "/regulamin.html",
    waitFor(page) {
      return page.locator("#legal-page-title").waitFor();
    },
  },
  {
    name: "privacy policy",
    path: "/polityka-prywatnosci.html",
    waitFor(page) {
      return page.locator("#legal-page-title").waitFor();
    },
  },
  {
    name: "cookies policy",
    path: "/cookies.html",
    waitFor(page) {
      return page.locator("#legal-page-title").waitFor();
    },
  },
];

const formatViolations = (pageName, violations) => {
  if (!violations.length) return "";

  return [
    `Accessibility violations found on ${pageName}:`,
    ...violations.map((violation, index) => {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join(" | ");
      return [
        `${index + 1}. [${violation.impact || "unknown"}] ${violation.id}`,
        `   Help: ${violation.help}`,
        `   Help URL: ${violation.helpUrl}`,
        `   Targets: ${targets}`,
      ].join("\n");
    }),
  ].join("\n");
};

const THEMES = ["light", "dark"];

test.describe("rendered accessibility audit", () => {
  for (const theme of THEMES) {
    for (const route of ROUTES) {
      test(`${route.name} has no axe violations (${theme} theme)`, async ({ page }) => {
        await page.addInitScript((themeName) => {
          window.localStorage.setItem("outlandgear-theme", themeName);
        }, theme);

        // Suppresses the legal modal's 700ms auto-open (legal-modal.js:124-131)
        // so it doesn't overlay the page during these resting-state scans.
        // Written the same way acceptAndClose itself does, and the same way
        // a11y-interactive.spec.js seeds it for its own non-modal states.
        await page.addInitScript(() => {
          window.localStorage.setItem(
            "outlandGearLegalAcceptedAt",
            new Date().toISOString(),
          );
        });

        if (route.beforeVisit) {
          await route.beforeVisit(page);
        }

        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle");
        await route.waitFor(page);

        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        // Confirms the acceptance-flag seeding above suppressed the legal
        // modal's auto-open (P2-07), so this scan analyses the route's
        // resting content only. An absent modal element counts as closed —
        // there is nothing open for axe to encounter either way.
        const legalModalIsClosed = await page.evaluate(() => {
          const modal = document.querySelector("#outland-legal-modal");
          if (!modal) return true;
          return (
            modal.getAttribute("aria-hidden") === "true" || modal.hasAttribute("hidden")
          );
        });
        expect(
          legalModalIsClosed,
          `Legal modal was open during the ${route.name} scan (${theme} theme); acceptance-flag seeding did not suppress auto-open.`,
        ).toBe(true);

        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

        expect(
          accessibilityScanResults.violations,
          formatViolations(
            `${route.name} (${theme} theme)`,
            accessibilityScanResults.violations,
          ),
        ).toEqual([]);
      });
    }
  }
});
