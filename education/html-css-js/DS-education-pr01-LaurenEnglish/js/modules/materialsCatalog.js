import { materials } from "../data/materials.js";
import { getMaterialPresentation } from "../data/materialAccess.js";
import { filterMaterials } from "../data/materialFilters.js";

const createBadge = (label, className = "") => {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`.trim();
  badge.textContent = label;
  return badge;
};

const createMetaItem = (label) => {
  const item = document.createElement("li");
  item.className = "badge";
  item.textContent = label;
  return item;
};

const createMetaItems = (item) => {
  const presentation = getMaterialPresentation(item);
  const fragment = document.createDocumentFragment();
  fragment.append(
    createMetaItem(presentation.categoryLabel),
    createMetaItem(presentation.levelLabel),
    createMetaItem(presentation.formatLabel),
  );

  if (item.duration) {
    fragment.append(createMetaItem(item.duration));
  }

  return fragment;
};

const getFilteredMaterials = (filters) => filterMaterials(materials, filters);

const renderMaterials = (list, container, emptyState) => {
  if (!list.length) {
    container.replaceChildren();
    emptyState.hidden = false;
    return;
  }

  const fragment = document.createDocumentFragment();

  list.forEach((item) => {
    const presentation = getMaterialPresentation(item);
    const card = document.createElement("article");
    card.className = "card card--resource materials__card";
    card.dataset.materialId = item.id;

    const title = document.createElement("h3");
    title.className = "card__title";
    title.textContent = item.title;

    const meta = document.createElement("ul");
    meta.className = "card__tags materials__meta";
    meta.setAttribute("aria-label", "Informacje o materiale");
    meta.append(createMetaItems(item));

    const description = document.createElement("p");
    description.className = "card__text";
    description.textContent = item.description;

    const accessBadge = createBadge(
      presentation.accessLabel,
      `badge--access badge--${item.access}`,
    );
    accessBadge.setAttribute(
      "aria-label",
      `Dostęp: ${presentation.accessLabel}`,
    );

    let action;
    if (presentation.action.kind === "link") {
      action = document.createElement("a");
      action.className = `button ${presentation.action.buttonClass}`;
      action.href = presentation.action.href;
      action.textContent = presentation.action.label;
    } else {
      action = document.createElement("span");
      action.className = "materials__availability";
      action.textContent = presentation.action.label;
    }

    const accessRegion = document.createElement("div");
    accessRegion.className = "materials__footer-access";
    accessRegion.append(accessBadge);

    const actionRegion = document.createElement("div");
    actionRegion.className = "materials__footer-action";
    actionRegion.append(action);

    const footer = document.createElement("div");
    footer.className = "materials__footer";
    footer.append(accessRegion, actionRegion);

    card.append(title, meta, description, footer);
    fragment.append(card);
  });

  container.replaceChildren(fragment);
  emptyState.hidden = true;
};

const getMaterialCountLabel = (count) => {
  if (count === 1) return "materiał";

  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return "materiały";
  }

  return "materiałów";
};

const updateCount = (count, element) => {
  if (!element) return;
  element.textContent = `Znaleziono ${count} ${getMaterialCountLabel(count)}`;
};

const initMaterialsFilters = ({
  categorySelect,
  levelSelect,
  accessSelect,
  resetButton,
  listContainer,
  emptyState,
  countElement,
}) => {
  const defaultFilters = Object.freeze({
    category: "all",
    level: "all",
    access: "all",
  });
  const filters = {
    category: categorySelect.value,
    level: levelSelect.value,
    access: accessSelect.value,
  };

  const updateResetState = () => {
    resetButton.disabled = Object.entries(defaultFilters).every(
      ([key, value]) => filters[key] === value,
    );
  };

  const applyFilters = () => {
    filters.category = categorySelect.value;
    filters.level = levelSelect.value;
    filters.access = accessSelect.value;

    const filtered = getFilteredMaterials(filters);
    renderMaterials(filtered, listContainer, emptyState);
    updateCount(filtered.length, countElement);
    updateResetState();
  };

  categorySelect.addEventListener("change", applyFilters);
  levelSelect.addEventListener("change", applyFilters);
  accessSelect.addEventListener("change", applyFilters);
  resetButton.addEventListener("click", () => {
    categorySelect.value = defaultFilters.category;
    levelSelect.value = defaultFilters.level;
    accessSelect.value = defaultFilters.access;
    applyFilters();
  });

  applyFilters();
};

export const initMaterialsCatalog = () => {
  const listContainer = document.querySelector("#materials-list");
  if (!listContainer) return;

  const categorySelect = document.querySelector("[data-materials-category]");
  const levelSelect = document.querySelector("[data-materials-level]");
  const accessSelect = document.querySelector("[data-materials-access]");
  const resetButton = document.querySelector("[data-materials-reset]");
  const emptyState = document.querySelector("[data-materials-empty]");
  const countElement = document.querySelector("[data-materials-count]");
  const filtersForm = document.querySelector("[data-materials-filters]");

  if (
    !categorySelect ||
    !levelSelect ||
    !accessSelect ||
    !resetButton ||
    !emptyState ||
    !filtersForm
  )
    return;

  initMaterialsFilters({
    categorySelect,
    levelSelect,
    accessSelect,
    resetButton,
    listContainer,
    emptyState,
    countElement,
  });
  filtersForm.hidden = false;
};

export {
  getFilteredMaterials,
  getMaterialPresentation,
  renderMaterials,
  initMaterialsFilters,
  getMaterialCountLabel,
};
