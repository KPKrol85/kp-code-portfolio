import { log } from "./utils.js";

const DEFAULT_STEP = 12;
const DONE_STATUS_TEXT = "Wszystko załadowane";
const DONE_STATUS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="menu-status__icon" aria-hidden="true" focusable="false">><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path><path d="M9 12l2 2l4 -4"></path></svg>`;

const updateStatus = (status, visible, total) => {
  if (!status) return;
  if (status.dataset.state === "done") return;
  status.textContent = `Załadowano ${visible} z ${total}`;
};

const finalizeLoadMore = (button, status) => {
  if (button) {
    button.disabled = true;
    button.hidden = true;
  }

  if (!status) return;
  status.dataset.state = "done";
  status.classList.remove("sr-only");
  status.innerHTML = `${DONE_STATUS_ICON}<span>${DONE_STATUS_TEXT}</span>`;
};

const ensureLoadMore = (button, status) => {
  if (button) {
    button.disabled = false;
    button.hidden = false;
  }

  if (!status) return;
  status.dataset.state = "progress";
  status.classList.add("sr-only");
};

export function initLoadMoreMenu() {
  const grid = document.querySelector(".menu__grid, .menu-grid");
  if (!grid) return;

  const items = Array.from(grid.querySelectorAll(".dish"));
  if (!items.length) return;

  const container = grid.closest("section") || grid.parentElement || document;
  const button = container.querySelector("[data-load-more]");
  const status = container.querySelector("[data-load-status]");
  const hasButton = Boolean(button);
  let visibleCount = hasButton ? Math.min(DEFAULT_STEP, items.length) : items.length;

  const getActiveFilter = () => {
    const active = container.querySelector(".tabs__tab.tabs__tab--active") ||
      container.querySelector(".tabs__tab[aria-pressed='true']");
    return active?.dataset.filter || "all";
  };

  const apply = () => {
    const filter = getActiveFilter();
    items.forEach((item, index) => {
      const loaded = index < visibleCount;
      item.dataset.loadHidden = loaded ? "false" : "true";
      const matches = filter === "all" || item.dataset.cat === filter;
      item.hidden = !(loaded && matches);
    });

    updateStatus(status, Math.min(visibleCount, items.length), items.length);

    if (visibleCount >= items.length) {
      finalizeLoadMore(button, status);
    } else {
      ensureLoadMore(button, status);
    }
  };

  apply();

  if (button) {
    button.addEventListener("click", () => {
      visibleCount = Math.min(visibleCount + DEFAULT_STEP, items.length);
      apply();
    });
  }

  log(items.length);
}

export function initLoadMoreGallery() {
  const grid = document.querySelector(".gallery__grid");
  if (!grid) return;

  const items = Array.from(grid.querySelectorAll(".gallery__item"));
  if (!items.length) return;

  const container = grid.closest("section") || grid.parentElement || document;
  const button = container.querySelector("[data-load-more]");
  const status = container.querySelector("[data-load-status]");
  const hasButton = Boolean(button);
  let visibleCount = hasButton ? Math.min(DEFAULT_STEP, items.length) : items.length;

  const getActiveFilter = () => {
    const active = container.querySelector(".tabs__tab.tabs__tab--active") ||
      container.querySelector(".tabs__tab[aria-pressed='true']");
    return active?.dataset.filter || "all";
  };

  const normalize = (value) =>
    (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const apply = () => {
    const filter = normalize(getActiveFilter());
    const showAll = filter === "" || filter === "all";

    items.forEach((item, index) => {
      const loaded = index < visibleCount;
      item.dataset.loadHidden = loaded ? "false" : "true";

      const raw = item.dataset.cat || item.dataset.filter || "";
      const normalized = normalize(raw).split(/[\s,]+/).filter(Boolean);
      const matches = showAll || normalized.includes(filter);

      item.hidden = !(loaded && matches);
    });

    updateStatus(status, Math.min(visibleCount, items.length), items.length);

    if (visibleCount >= items.length) {
      finalizeLoadMore(button, status);
    } else {
      ensureLoadMore(button, status);
    }
  };

  apply();

  if (button) {
    button.addEventListener("click", () => {
      visibleCount = Math.min(visibleCount + DEFAULT_STEP, items.length);
      apply();
    });
  }

  log(items.length);
}
