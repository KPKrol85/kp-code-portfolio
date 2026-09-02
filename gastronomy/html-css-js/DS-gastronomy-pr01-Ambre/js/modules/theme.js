import { $, byTestId, log } from "./utils.js";

export function initThemeSwitcher() {
  const toggle = byTestId("site-header__theme-toggle") || $(".site-header__theme-toggle");
  if (!toggle) return;

  const storageKey = "theme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const prefersDark = media.matches;
  const stored = localStorage.getItem(storageKey);

  const apply = (mode) => {
    if (mode === "light" || mode === "dark") {
      root.setAttribute("data-theme", mode);
      toggle.setAttribute("aria-pressed", String(mode === "dark"));
      return;
    }

    root.removeAttribute("data-theme");
    toggle.setAttribute("aria-pressed", "false");
  };

  apply(stored ?? (prefersDark ? "dark" : "light"));

  // The sun/moon control snaps to its state until the document is flagged ready,
  // so a stored theme applied during boot does not animate on every page load.
  requestAnimationFrame(() => requestAnimationFrame(() => root.setAttribute("data-theme-ready", "")));

  toggle.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || (prefersDark ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(storageKey, next);
    apply(next);
  });

  media.addEventListener("change", (event) => {
    if (!localStorage.getItem(storageKey)) {
      apply(event.matches ? "dark" : "light");
    }
  });

  log();
}
