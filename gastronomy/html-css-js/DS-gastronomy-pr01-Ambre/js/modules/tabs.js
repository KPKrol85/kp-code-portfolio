import { $, $$, byTestId, log } from "./utils.js";

export function initTabs() {
  const grid = document.querySelector(".menu__grid, .menu-grid");
  if (!grid) return;

  const root = byTestId("menu-tabs") || grid.closest("section") || document;
  const tabs = $$(".tabs__tab", root);
  if (!tabs.length) return;

  const dishes = $$(".dish", grid);
  if (!dishes.length) return;

  const normalize = (value) =>
    (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const apply = (tab) => {
    tabs.forEach((btn) => {
      const isActive = btn === tab;
      btn.classList.toggle("tabs__tab--active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    const filter = normalize(tab?.dataset?.filter || "");
    const showAll = filter === "" || filter === "all";
    dishes.forEach((dish) => {
      const raw = dish.dataset.cat || dish.dataset.filter || "";
      const normalized = normalize(raw).split(/[\s,]+/).filter(Boolean);
      const matches = showAll || normalized.includes(filter);
      const loadVisible = dish.dataset.loadHidden !== "true";
      dish.hidden = !(matches && loadVisible);
    });
  };

  apply(
    $(".tabs__tab.tabs__tab--active", root) ||
      tabs.find((tab) => tab.getAttribute("aria-pressed") === "true") ||
      tabs[0]
  );

  root.addEventListener(
    "click",
    (event) => {
      const tab = event.target.closest(".tabs__tab");
      if (tab && tabs.includes(tab)) apply(tab);
    },
    { passive: true }
  );

  log(byTestId("menu-tabs"), tabs.length);
}

export function initGalleryFilter() {
  const page = document.querySelector("main.page-gallery");
  if (!page) return;

  const tabsRoot = page.querySelector(".gallery__tabs");
  if (!tabsRoot) return;

  const tabs = Array.from(tabsRoot.querySelectorAll(".tabs__tab"));
  const items = Array.from(page.querySelectorAll(".gallery__section .gallery__item"));

  const normalize = (value) =>
    (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const apply = (tab) => {
    tabs.forEach((btn) => {
      const isActive = btn === tab;
      btn.setAttribute("aria-pressed", String(isActive));
      btn.classList.toggle("tabs__tab--active", isActive);
    });

    const filter = normalize(tab.dataset.filter || "");
    const showAll = filter === "" || filter === "all";

    items.forEach((item) => {
      const raw = item.dataset.cat || item.dataset.filter || "";
      const normalized = normalize(raw).split(/[\s,]+/).filter(Boolean);
      const matches = showAll || normalized.includes(filter);
      const loadVisible = item.dataset.loadHidden !== "true";
      item.hidden = !(loadVisible && matches);
    });
  };

  tabs.forEach((tab) => tab.addEventListener("click", () => apply(tab)));

  tabs.forEach((tab, index) => {
    const pressed = tab.getAttribute("aria-pressed");
    const isActive = pressed ? pressed === "true" : index === 0;
    tab.setAttribute("aria-pressed", String(isActive));
  });

  const activeTab = tabs.find((tab) => tab.getAttribute("aria-pressed") === "true") || tabs[0];
  if (activeTab) apply(activeTab);

  log(tabs.length, items.length);
}
