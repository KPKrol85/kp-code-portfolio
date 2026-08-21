import { log } from "./utils.js";

export function initPageMenuPanel() {
  if (!document.body.classList.contains("page-menu")) return;

  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest(".dish-more")) return;
      const openPanels = document.querySelectorAll(".dish-more[open]");
      if (!openPanels.length) return;
      openPanels.forEach((panel) => panel.removeAttribute("open"));
    },
    { passive: true }
  );

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".dish-more[open]").forEach((panel) => panel.removeAttribute("open"));
  });

  document.addEventListener("toggle", (event) => {
    const target = event.target;
    if (!target.matches?.(".dish-more") || !target.open) return;
    document.querySelectorAll(".dish-more[open]").forEach((panel) => {
      if (panel !== target) panel.removeAttribute("open");
    });
  });

  log();
}