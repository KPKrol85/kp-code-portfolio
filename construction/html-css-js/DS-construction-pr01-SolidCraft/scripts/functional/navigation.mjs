/* Navigation scenarios — the responsive drawer and the Oferta submenu.

   Both run below the 1024 px navigation breakpoint that js/modules/nav.js and
   css/modules/layout.css share, because that is the only viewport where the
   drawer and the mobile submenu exist. The assertions target the interaction
   contract — rendered state, ARIA state and keyboard reachability agreeing
   with each other — not the markup, which the static checks already cover. */

import {
  MOBILE_VIEWPORT,
  NAVIGATION_BREAKPOINT,
  assert,
  assertDeepEqual,
  assertEqual,
  assertFocusOn,
  assertFocusWithin,
  hasClass,
  openPage,
  withPage,
} from "./harness.mjs";

const SERVICE_LINKS = [
  "oferta/lazienki.html",
  "oferta/malowanie.html",
  "oferta/kafelkowanie.html",
  "oferta/elektryka.html",
  "oferta/hydraulika.html",
  "oferta/remonty.html",
];

async function assertBelowBreakpoint(page) {
  const isMobileLayout = await page.evaluate(
    (breakpoint) => !window.matchMedia(`(min-width: ${breakpoint}px)`).matches,
    NAVIGATION_BREAKPOINT,
  );
  assert(
    isMobileLayout,
    `viewport should sit below the ${NAVIGATION_BREAKPOINT} px navigation breakpoint`,
  );
}

const navigationScenarios = [
  {
    name: "nav-drawer-open-and-close",
    async run({ browser, baseURL }) {
      await withPage(
        browser,
        { baseURL, viewport: MOBILE_VIEWPORT },
        async ({ page }) => {
          await openPage(page, "/index.html");
          await assertBelowBreakpoint(page);

          const toggle = page.locator(".nav-toggle");
          const menu = page.locator("#navMenu");

          assert(
            await toggle.isVisible(),
            "the menu button should be the drawer's control below the breakpoint",
          );
          assert(!(await menu.isVisible()), "the drawer should start closed");
          assert(
            !(await hasClass(page, "#navMenu", "open")),
            "the drawer should start without its open state class",
          );
          assertEqual(
            await toggle.getAttribute("aria-expanded"),
            "false",
            "the closed drawer should report aria-expanded=false",
          );

          await toggle.click();

          assert(
            await menu.isVisible(),
            "activating the menu button should open the drawer",
          );
          assert(
            await hasClass(page, "#navMenu", "open"),
            "the open drawer should carry its open state class",
          );
          assertEqual(
            await toggle.getAttribute("aria-expanded"),
            "true",
            "the open drawer should report aria-expanded=true",
          );
          assertEqual(
            await toggle.getAttribute("aria-label"),
            "Zamknij menu",
            "the menu button label should describe the close action while open",
          );
          assert(
            await hasClass(page, "html", "is-nav-open"),
            "the document should carry the open-navigation state class",
          );
          await assertFocusWithin(
            page,
            "#navMenu",
            "opening the drawer should move focus into it",
          );

          await toggle.click();

          assert(
            !(await menu.isVisible()),
            "activating the menu button again should close the drawer",
          );
          assert(
            !(await hasClass(page, "#navMenu", "open")),
            "the closed drawer should drop its open state class",
          );
          assertEqual(
            await toggle.getAttribute("aria-expanded"),
            "false",
            "the closed drawer should report aria-expanded=false again",
          );
          assertEqual(
            await toggle.getAttribute("aria-label"),
            "Otwórz menu",
            "the menu button label should describe the open action once closed",
          );
          assert(
            !(await hasClass(page, "html", "is-nav-open")),
            "closing the drawer should clear the open-navigation state class",
          );
          await assertFocusOn(
            page,
            ".nav-toggle",
            "closing the drawer should restore focus to its control",
          );
        },
      );
    },
  },

  {
    name: "nav-oferta-submenu-in-drawer",
    async run({ browser, baseURL }) {
      await withPage(
        browser,
        { baseURL, viewport: MOBILE_VIEWPORT },
        async ({ page }) => {
          await openPage(page, "/index.html");
          await assertBelowBreakpoint(page);

          const urlBeforeSubmenu = page.url();
          const trigger = page.locator("#dd-oferta-trigger");
          const submenu = page.locator("#dd-oferta");

          await page.locator(".nav-toggle").click();

          assert(
            !(await submenu.isVisible()),
            "the Oferta submenu should start closed inside the drawer",
          );
          assertEqual(
            await trigger.getAttribute("aria-expanded"),
            "false",
            "the closed submenu should report aria-expanded=false",
          );

          await trigger.click();

          assert(
            await hasClass(page, "#dd-oferta", "open"),
            "the submenu's open class is its authoritative state",
          );
          assert(
            await submenu.isVisible(),
            "the open submenu should be rendered",
          );
          assertEqual(
            await trigger.getAttribute("aria-expanded"),
            "true",
            "aria-expanded should match the rendered submenu state",
          );
          assertEqual(
            page.url(),
            urlBeforeSubmenu,
            "opening the submenu should not navigate away from the page",
          );

          const links = submenu.locator("a");
          assertEqual(
            await links.count(),
            SERVICE_LINKS.length,
            "the mobile submenu should list every service page",
          );
          assertDeepEqual(
            await links.evaluateAll((nodes) =>
              nodes.map((node) => node.getAttribute("href")),
            ),
            SERVICE_LINKS,
            "the submenu should link to the six maintained service pages",
          );

          /* Reachability is checked the way a keyboard visitor experiences it:
             opening the submenu focuses its first item, and Tab must walk the
             remaining five without leaving the list. */
          await assertFocusOn(
            page,
            `#dd-oferta a[href="${SERVICE_LINKS[0]}"]`,
            "opening the submenu should focus its first service link",
          );

          for (const href of SERVICE_LINKS.slice(1)) {
            await page.keyboard.press("Tab");
            await assertFocusOn(
              page,
              `#dd-oferta a[href="${href}"]`,
              `Tab should reach the ${href} link`,
            );
          }

          await page.keyboard.press("Escape");

          assert(
            !(await hasClass(page, "#dd-oferta", "open")),
            "Escape inside the submenu should close it",
          );
          assert(
            !(await submenu.isVisible()),
            "the closed submenu should no longer be rendered",
          );
          assertEqual(
            await trigger.getAttribute("aria-expanded"),
            "false",
            "aria-expanded should follow the submenu back to closed",
          );
          await assertFocusOn(
            page,
            "#dd-oferta-trigger",
            "closing the submenu should restore focus to its trigger",
          );
          assert(
            await hasClass(page, "#navMenu", "open"),
            "closing the submenu should leave the drawer itself open",
          );
        },
      );
    },
  },
];

export { navigationScenarios };
