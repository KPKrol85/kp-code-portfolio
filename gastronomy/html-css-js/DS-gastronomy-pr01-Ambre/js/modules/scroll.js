import { $, byTestId, log } from "./utils.js";

export function initScrollButtons() {
  const down = byTestId("scroll-down") || $(".scroll-down");
  const up = byTestId("scroll-up") || $(".scroll-up");
  if (!down && !up) return;

  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";

  const docHeight = () =>
    Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );

  down?.addEventListener("click", () => {
    const target = Math.max(0, docHeight() - window.innerHeight);
    window.scrollTo({ top: target, behavior });
  });

  up?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior });
  });

  let ticking = false;
  const update = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const offset = window.scrollY || window.pageYOffset;
      if (down) {
        const atBottom = window.innerHeight + offset >= docHeight() - 100;
        down.classList.toggle("is-hidden", atBottom);
      }
      if (up) up.classList.toggle("is-visible", offset > 300);
      ticking = false;
    });
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  log();
}

export function initScrollToTop() {
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a.site-header__brand");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#")) return;

    if (href.includes("#top")) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReduce ? "auto" : "smooth" });
    }
  });

  log();
}

export function initScrollTargets() {
  const triggers = document.querySelectorAll("[data-target]");
  if (!triggers.length) return;

  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const target = document.querySelector(trigger.dataset.target);
      target?.scrollIntoView({ behavior });
    });
  });

  log(triggers.length);
}
