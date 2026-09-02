import { SCROLL_TOP, SELECTORS } from "../core/config.js";
import { qs } from "../utils/dom.js";

export const initScrollTop = () => {
  const btn = qs(SELECTORS.scrollTopButton);
  if (!btn) return;
  const root = document.scrollingElement || document.documentElement;
  const getScrollTop = () => Math.max(0, typeof window.pageYOffset === "number" ? window.pageYOffset : root.scrollTop);
  const setVisible = (v) => {
    btn.classList.toggle("is-visible", v);
    btn.setAttribute("aria-hidden", String(!v));
    if (v) btn.removeAttribute("inert");
    else btn.setAttribute("inert", "");
  };
  const update = () => setVisible(getScrollTop() > SCROLL_TOP.threshold);
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };
  update();
  window.addEventListener("load", update, { once: true });
  window.addEventListener("pageshow", update, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") update();
  });
  window.addEventListener("resize", update, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!btn.classList.contains("is-visible")) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  });
};
