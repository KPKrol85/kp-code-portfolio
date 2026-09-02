import { HEADER_COMPACT, SELECTORS } from "../core/config.js";
import { qs } from "../utils/dom.js";

export const initCompactHeader = () => {
  let compactOn = false;
  let ticking = false;
  const shouldCompact = () => (window.scrollY || window.pageYOffset || 0) > HEADER_COMPACT.threshold;
  const apply = (on) => {
    if (on === compactOn) return;
    compactOn = on;
    document.body.classList.toggle("header-compact", compactOn);
  };
  const update = () => apply(shouldCompact());
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };
  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  window.addEventListener("pageshow", update, { once: true });
  const btn = qs(SELECTORS.navToggle);
  if (btn) {
    btn.addEventListener("click", () => {
      setTimeout(update, 0);
    });
  }
  const mo = new MutationObserver(update);
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
};
