import { INTERSECTION, SELECTORS } from "../core/config.js";
import { qsa } from "../utils/dom.js";

export const initHeroReveal = () => {
  const hiddenElements = qsa(SELECTORS.hidden);
  if (!hiddenElements.length) return;
  if (!("IntersectionObserver" in window)) {
    hiddenElements.forEach((el) => el.classList.add("u-show"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= INTERSECTION.enterRatio) {
          requestAnimationFrame(() => entry.target.classList.add("u-show"));
          return;
        }
        if (entry.intersectionRatio === 0) {
          entry.target.classList.remove("u-show");
        }
      });
    },
    { root: null, rootMargin: INTERSECTION.rootMargin, threshold: INTERSECTION.thresholds }
  );
  hiddenElements.forEach((el) => observer.observe(el));

  const isInViewport = (el, ratio = INTERSECTION.enterRatio) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    if (r.width === 0 || r.height === 0) return false;
    const visibleVert = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    const visibleHorz = Math.min(r.right, vw) - Math.max(r.left, 0);
    if (visibleVert <= 0 || visibleHorz <= 0) return false;
    const visibleArea = visibleVert * visibleHorz;
    const totalArea = r.width * r.height;
    return visibleArea / totalArea >= ratio;
  };
  const initialReveal = () => {
    hiddenElements.forEach((el) => {
      if (isInViewport(el)) el.classList.add("u-show");
    });
  };
  requestAnimationFrame(() => requestAnimationFrame(initialReveal));
  window.addEventListener("load", () => setTimeout(initialReveal, 0), { once: true });
  window.addEventListener("pageshow", () => setTimeout(initialReveal, 0), { once: true });
};
