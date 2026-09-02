import { SELECTORS } from "../core/config.js";
import { qs, qsa } from "../utils/dom.js";
import { safeGetItem, safeSetItem } from "../utils/storage.js";

export const initThemeToggle = () => {
  const root = document.documentElement;
  const btnDesktop = qs(SELECTORS.themeToggleDesktop);
  const btnMobile = qs(SELECTORS.themeToggleMobile);

  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const setLogo = (isDark) => {
    qsa(".theme-logo[data-light][data-dark]").forEach((img) => {
      const next = isDark ? img.dataset.dark : img.dataset.light;
      if (!next) return;
      const absNext = new URL(next, document.baseURI).href;
      if (img.src !== absNext) img.setAttribute("src", next);
    });
  };

  const syncButtonsA11y = (isDark) => {
    const pressed = String(isDark);
    const label = isDark ? "Przełącz na jasny motyw" : "Przełącz na ciemny motyw";
    if (btnDesktop) {
      btnDesktop.setAttribute("aria-pressed", pressed);
      btnDesktop.setAttribute("aria-label", label);
    }
    if (btnMobile) {
      btnMobile.setAttribute("aria-pressed", pressed);
      btnMobile.setAttribute("aria-label", label);
    }
  };
  const setTheme = (mode, persist = true) => {
    const isDark = mode === "dark";
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    setLogo(isDark);

    syncButtonsA11y(isDark);
    if (persist) safeSetItem("theme", isDark ? "dark" : "light");
  };
  const saved = safeGetItem("theme");
  if (saved === "dark" || saved === "light") setTheme(saved, false);
  else setTheme(mq && mq.matches ? "dark" : "light", false);
  const onToggle = () => setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
  if (btnDesktop) btnDesktop.addEventListener("click", onToggle);
  if (btnMobile) btnMobile.addEventListener("click", onToggle);
  if (!saved && mq) {
    const onSystemChange = (e) => setTheme(e.matches ? "dark" : "light", false);
    if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }
};
