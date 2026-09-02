import { $ } from "./utils.js";

export function initFooterYear() {
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
}

export function initFooterMap() {
  document.querySelectorAll("[data-map-load]").forEach((button) => {
    const container = button.closest(".site-footer__map");
    const iframe = container?.querySelector("iframe[data-map-src]");
    if (!iframe?.dataset.mapSrc) return;

    button.hidden = false;
    button.addEventListener(
      "click",
      () => {
        iframe.addEventListener("load", () => iframe.focus(), { once: true });
        iframe.hidden = false;
        iframe.src = iframe.dataset.mapSrc;
        button.hidden = true;
      },
      { once: true },
    );
  });
}
