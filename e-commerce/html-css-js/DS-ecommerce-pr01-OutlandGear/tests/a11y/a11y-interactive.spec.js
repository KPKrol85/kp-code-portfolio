const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

const MOBILE_NAV_VIEWPORT = { width: 768, height: 1024 };

const PRODUCT_PATH = "/produkt/outland-thermal-core-075l/";

const waitForProductRoot = async (page) => {
  await page.locator("[data-product-root]").waitFor();
  await expect(page.locator("[data-product-title]")).toHaveText(
    /Outland Thermal Core 0\.75L/i,
  );
};

const waitForHero = (page) => page.locator("main .hero").waitFor();

// Each entry describes one interaction-only accessible state: the route to
// visit, how to reach a settled starting point, an optional setup step that
// must run before the page loads, the interaction (or wait) that produces the
// state, and how to confirm the state is actually present before scanning it.
const STATES = [
  {
    name: "toast — success variant",
    path: PRODUCT_PATH,
    waitFor: waitForProductRoot,
    async trigger(page) {
      await page.locator("[data-add-product]").click();
    },
    async assertPresent(page) {
      const toast = page.locator("[data-toast]");
      await expect(toast).toHaveClass(/toast--visible/);
      await expect(toast).toHaveAttribute("data-feedback-type", "success");
    },
    scope: "[data-toast]",
  },
  {
    name: "toast — warning variant",
    path: PRODUCT_PATH,
    waitFor: waitForProductRoot,
    async trigger(page) {
      await page.locator("[data-qty-input]").fill("50");
      await page.locator("[data-add-product]").click();
    },
    async assertPresent(page) {
      const toast = page.locator("[data-toast]");
      await expect(toast).toHaveClass(/toast--visible/);
      await expect(toast).toHaveAttribute("data-feedback-type", "warning");
    },
    scope: "[data-toast]",
  },
  {
    name: "toast — error variant",
    path: PRODUCT_PATH,
    // The error variant only fires when saving the cart to localStorage
    // fails. There is no UI control that forces this, so the storage write
    // is broken for the one key the cart uses, and the rest of the flow
    // (clicking "add to cart") runs exactly as it does in production.
    async beforeVisit(page) {
      await page.addInitScript(() => {
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function setItem(key, value) {
          if (key === "outlandGearCart") {
            throw new DOMException(
              "Simulated storage failure for accessibility testing",
              "QuotaExceededError",
            );
          }
          return originalSetItem.call(this, key, value);
        };
      });
    },
    waitFor: waitForProductRoot,
    async trigger(page) {
      await page.locator("[data-add-product]").click();
    },
    async assertPresent(page) {
      const toast = page.locator("[data-toast]");
      await expect(toast).toHaveClass(/toast--visible/);
      await expect(toast).toHaveAttribute("data-feedback-type", "error");
    },
    scope: "[data-toast]",
  },
  {
    name: "toast — info variant (fallback; constructed, not reachable through normal interaction)",
    path: "/",
    waitFor: waitForHero,
    // No current call site passes no type or an unrecognized type, so the
    // info fallback is never reached through the UI. This reproduces exactly
    // what showToast (js/modules/toast.js) does for that fallback path,
    // directly on the resting toast markup, without importing or calling
    // application code.
    async trigger(page) {
      await page.evaluate(() => {
        const toast = document.querySelector("[data-toast]");
        if (!toast) return;

        toast.innerHTML = "";
        toast.dataset.feedbackType = "info";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.setAttribute("aria-atomic", "true");

        const label = document.createElement("span");
        label.className = "toast__label";
        label.textContent = "Informacja:";

        const content = document.createElement("span");
        content.className = "toast__message";
        content.textContent = "Stan testowy wariantu informacyjnego.";

        toast.append(label, content);
        toast.classList.add("toast--visible");
      });
    },
    async assertPresent(page) {
      const toast = page.locator("[data-toast]");
      await expect(toast).toHaveClass(/toast--visible/);
      await expect(toast).toHaveAttribute("data-feedback-type", "info");
    },
    scope: "[data-toast]",
  },
  {
    name: "navigation drawer open",
    path: "/",
    viewport: MOBILE_NAV_VIEWPORT,
    waitFor: waitForHero,
    async trigger(page) {
      await page.locator("[data-nav-toggle]").click();
    },
    async assertPresent(page) {
      await expect(page.locator("[data-nav-drawer]")).toHaveAttribute(
        "aria-hidden",
        "false",
      );
    },
    scope: "[data-nav-drawer]",
  },
  {
    name: "header search panel open",
    path: "/",
    viewport: MOBILE_NAV_VIEWPORT,
    waitFor: waitForHero,
    async trigger(page) {
      await page.locator("[data-search-toggle]").click();
    },
    async assertPresent(page) {
      await expect(page.locator("[data-search-toggle]")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    },
    scope: "[data-search-panel]",
  },
  {
    name: "legal information modal auto-open",
    path: "/",
    waitFor: waitForHero,
    // Auto-opens on its own after 700ms when no prior acceptance is recorded
    // in localStorage or sessionStorage. A fresh Playwright context has
    // neither, so no click is needed; the wait below is bounded by the
    // component's own timer rather than a fixed sleep before an assertion.
    // Every other state seeds the acceptance flag so the modal doesn't cover
    // the page during its own click; this is the one state whose trigger
    // depends on that flag being absent, so it opts out of the seeding below.
    skipLegalAcceptanceSeed: true,
    async assertPresent(page) {
      await expect(page.locator("#outland-legal-modal")).toHaveAttribute(
        "aria-hidden",
        "false",
        { timeout: 5_000 },
      );
    },
    scope: "#outland-legal-modal",
  },
  {
    name: "cart empty state banner",
    path: "/koszyk.html",
    // No cart data is seeded, so the page's own default (empty) state is
    // what renders — this is the natural resting state of a fresh visit,
    // not a constructed one.
    waitFor(page) {
      return page.locator("main.cart-page").waitFor();
    },
    async assertPresent(page) {
      const state = page.locator("[data-cart-state]");
      await expect(state).toBeVisible();
      await expect(state).toHaveClass(/ui-state--empty/);
    },
    scope: "[data-cart-state]",
  },
  {
    name: "checkout form validation error state banner",
    path: "/checkout.html",
    waitFor(page) {
      return page.locator("[data-checkout-form]").waitFor();
    },
    async trigger(page) {
      await page.locator('[data-checkout-form] button[type="submit"]').click();
    },
    async assertPresent(page) {
      const state = page.locator("[data-checkout-status]");
      await expect(state).toBeVisible();
      await expect(state).toHaveClass(/ui-state--error/);
    },
    scope: "[data-checkout-status]",
  },
  {
    name: "travel kit loading state banner",
    // Deliberately the template route, not the prerendered /komplety/<slug>/
    // one. Prerendered pages are marked data-prerendered="true" by the build,
    // and travel-kits.js skips the loading state on them so the already-served
    // content is never hidden and rebuilt (see routes.js isPrerenderedRoot).
    // The loading state is therefore reachable only where it is still correct:
    // the unprerendered template, which really does start empty. Do not point
    // this back at the prerendered route — it would assert the flash that the
    // guard exists to remove.
    path: "/komplety.html?slug=weekend-w-gorach",
    // The loading state clears as soon as the kit and product data resolve,
    // which is too fast on a local/static server to observe reliably. The
    // travel-kits.json request is held open briefly so the loading state
    // stays rendered long enough to assert on and scan; this is a bounded
    // wait driven by the component's own loading condition, not a fixed
    // sleep before an assertion, and no application module is touched.
    async beforeVisit(page) {
      await page.route("**/data/travel-kits.json*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        await route.continue();
      });
    },
    // networkidle would wait out the delayed request above before resolving,
    // by which point the loading state would already have cleared — so this
    // state alone skips that wait and checks the DOM directly instead.
    waitUntilNetworkIdle: false,
    async waitFor(page) {
      await page.locator("[data-kit-root]").waitFor({ state: "attached" });
    },
    async assertPresent(page) {
      const state = page.locator("[data-kit-state]");
      await expect(state).toBeVisible();
      await expect(state).toHaveClass(/ui-state--loading/);
    },
    scope: "[data-kit-state]",
  },
];

const formatViolations = (label, violations) => {
  if (!violations.length) return "";

  return [
    `Accessibility violations found on ${label}:`,
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

test.describe("interaction-only state accessibility audit", () => {
  for (const theme of THEMES) {
    for (const state of STATES) {
      test(`${state.name} has no axe violations (${theme} theme)`, async ({ page }) => {
        if (state.viewport) {
          await page.setViewportSize(state.viewport);
        }

        await page.addInitScript((themeName) => {
          window.localStorage.setItem("outlandgear-theme", themeName);
        }, theme);

        if (!state.skipLegalAcceptanceSeed) {
          // Suppresses the legal modal's 700ms auto-open (legal-modal.js:124-131)
          // so it doesn't overlay the page and swallow clicks meant for the
          // element under test. Written the same way acceptAndClose itself does.
          await page.addInitScript(() => {
            window.localStorage.setItem(
              "outlandGearLegalAcceptedAt",
              new Date().toISOString(),
            );
          });
        }

        if (state.beforeVisit) {
          await state.beforeVisit(page);
        }

        await page.goto(state.path, { waitUntil: "domcontentloaded" });

        if (state.waitUntilNetworkIdle !== false) {
          await page.waitForLoadState("networkidle");
        }

        await state.waitFor(page);

        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        if (state.trigger) {
          await state.trigger(page);
        }

        await state.assertPresent(page);

        const accessibilityScanResults = await new AxeBuilder({ page })
          .include(state.scope)
          .analyze();

        expect(
          accessibilityScanResults.violations,
          formatViolations(
            `${state.name} (${theme} theme)`,
            accessibilityScanResults.violations,
          ),
        ).toEqual([]);
      });
    }
  }
});
