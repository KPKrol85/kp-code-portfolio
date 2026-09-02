"use strict";

/* === 13 - Home helpers === */

function initHomeHelpers() {
  // Reset previous listeners (if re-initialized)
  if (initHomeHelpers._abort) initHomeHelpers._abort.abort();

  const ac = new AbortController();
  const { signal } = ac;
  initHomeHelpers._abort = ac;

  const isHome =
    !!document.querySelector("#kontakt") ||
    !!document.querySelector("#oferta") ||
    !!document.querySelector("#strona-glowna");

  if (!isHome) {
    window.addEventListener("pagehide", () => ac.abort(), {
      once: true,
      signal,
    });
    return;
  }

  const isVisible = (el) =>
    !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const getFocusTarget = () => {
    const main =
      document.querySelector("#main") ||
      document.querySelector("main") ||
      document.querySelector(".main");
    if (main && main.getAttribute("aria-hidden") !== "true" && isVisible(main))
      return main;
    const heading = Array.from(document.querySelectorAll("h1")).find(
      (el) => el.getAttribute("aria-hidden") !== "true" && isVisible(el),
    );
    if (heading) return heading;
    const container =
      document.querySelector('[role="main"]') ||
      document.querySelector("[data-page]");
    if (container && container.getAttribute("aria-hidden") !== "true") {
      return container;
    }
    return document.body;
  };
  const focusTarget = () => {
    const target = getFocusTarget();
    if (!target || typeof target.focus !== "function") return;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    setTimeout(() => target.removeAttribute("tabindex"), 800);
  };

  const getScrollBehavior = () => {
    const prefersNoAnim = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    return prefersNoAnim ? "auto" : "smooth";
  };

  const cleanUrlKeepQuery = () => {
    history.replaceState(null, "", location.pathname + location.search);
  };

  const cleanUrlKeepHash = () => {
    history.replaceState(null, "", location.pathname + location.hash);
  };

  const scrollToTop = () => {
    const behavior = getScrollBehavior();
    const topEl = document.getElementById("top");

    if (topEl?.scrollIntoView) {
      topEl.scrollIntoView({ behavior });
      focusTarget();
      return;
    }

    window.scrollTo({ top: 0, behavior });
    focusTarget();
  };

  document.addEventListener(
    "click",
    (e) => {
      const link = e.target.closest('a.scroll-top, a[href="#top"]');
      if (!link) return;

      if (!e.defaultPrevented) {
        e.preventDefault();
        scrollToTop();
      } else {
        focusTarget();
      }

      cleanUrlKeepQuery();
    },
    { signal },
  );

  (function prefillService() {
    const form = document.querySelector("#kontakt form");
    if (!form) return;

    const params = new URLSearchParams(location.search);
    const service = params.get("usluga");
    if (!service) return;

    let input = form.querySelector('[name="usluga"]');

    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "usluga";
      form.appendChild(input);
    }

    input.value = service;
    cleanUrlKeepHash();
  })();

  window.addEventListener("pagehide", () => ac.abort(), { once: true, signal });
}

export { initHomeHelpers };
