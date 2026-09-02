"use strict";

const utils = (() => {
  const docEl = document.documentElement;
  const headerSel = '.site-header, header[role="banner"]';
  const qHeader = () => document.querySelector(headerSel);
  const readCssVarPx = (name) => {
    const raw = getComputedStyle(docEl).getPropertyValue(name);
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  };

  const measureHeaderPx = () => {
    const el = qHeader();
    return el ? Math.round(el.getBoundingClientRect().height) : 0;
  };

  const computeHeaderH = () => {
    const fromVar = readCssVarPx("--header-h");
    const val = fromVar > 0 ? fromVar : measureHeaderPx();
    return val > 0 ? val : 74;
  };

  let cached = null;
  let lastW = 0;

  const getHeaderH = () => {
    const w = window.innerWidth || 0;
    if (cached != null && w === lastW) return cached;
    cached = computeHeaderH();
    lastW = w;
    return cached;
  };

  const refreshHeaderH = () => {
    cached = null;
    return getHeaderH();
  };

  const syncHeaderCssVar = () => {
    const h = computeHeaderH();
    docEl.style.setProperty("--header-h", `${h}px`);
    cached = h;
    return h;
  };

  let rAF = 0;
  window.addEventListener(
    "resize",
    () => {
      if (rAF) return;
      rAF = requestAnimationFrame(() => {
        rAF = 0;
        cached = null;
      });
    },
    { passive: true },
  );

  return Object.freeze({ getHeaderH, refreshHeaderH, syncHeaderCssVar });
})();

export { utils };
