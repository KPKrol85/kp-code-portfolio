import { CONFIG } from "../config.js";
import { qs, qsa, on, delegate } from "./dom.js";
import { debounce, formatCurrency } from "../utils.js";
import { addToCart, updateCartCount } from "./cart.js";
import { showToast } from "./toast.js";
import { createFallbackNotice } from "./fallback.js";
import { findProductById, loadNormalizedProducts } from "./product-data.js";
import { buildProductUrl } from "./routes.js";
import { clearUiState, setUiState } from "./ui-state.js";

const parseRange = (value) => {
  if (!value) return null;
  const [min, max] = value.split("-").map(Number);
  return { min, max };
};

const DEFAULT_FILTERS = {
  range: null,
  price: "",
  rating: 0,
  subcategory: "",
  badges: [],
  sort: "popularity",
};

const sorters = {
  popularity: (a, b) => b.rating * b.reviewsCount - a.rating * a.reviewsCount,
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
  newest: (a, b) => b.id - a.id,
};

let addToCartHandlersBound = false;

const hasOption = (select, value) =>
  Boolean(
    select && value && qsa("option", select).some((option) => option.value === value),
  );

const parseStateFromUrl = (form) => {
  const params = new URLSearchParams(window.location.search);
  const state = {
    searchTerm: params.get("q")?.trim() || "",
    price: params.get("price") || "",
    rating: params.get("rating") || "",
    category: params.get("category") || "",
    subcategory: params.get("subcategory") || "",
    badges: (params.get("badges") || "")
      .split(",")
      .map((badge) => badge.trim())
      .filter(Boolean),
    sort: params.get("sort") || DEFAULT_FILTERS.sort,
    limit: Number.parseInt(params.get("limit") || "", 10),
  };

  if (form) {
    const priceSelect = qs("[name=price]", form);
    const ratingSelect = qs("[name=rating]", form);
    const subSelect = qs("[name=subcategory]", form);
    const sortSelect = qs("[name=sort]", form);
    const badgeValues = qsa("[name=badge]", form).map((input) => input.value);

    if (!hasOption(priceSelect, state.price)) state.price = "";
    if (!hasOption(ratingSelect, state.rating)) state.rating = "";
    if (!hasOption(subSelect, state.subcategory)) state.subcategory = "";
    if (!hasOption(sortSelect, state.sort)) state.sort = DEFAULT_FILTERS.sort;

    state.badges = state.badges.filter(
      (badge, index, arr) => badgeValues.includes(badge) && arr.indexOf(badge) === index,
    );
  }

  if (!Number.isInteger(state.limit) || state.limit < CONFIG.perPage) {
    state.limit = CONFIG.perPage;
  }

  return state;
};

const applyStateToForm = (form, state) => {
  if (!form) return;

  const priceSelect = qs("[name=price]", form);
  const ratingSelect = qs("[name=rating]", form);
  const subSelect = qs("[name=subcategory]", form);
  const sortSelect = qs("[name=sort]", form);

  if (priceSelect) priceSelect.value = state.price;
  if (ratingSelect) ratingSelect.value = state.rating;
  if (subSelect) subSelect.value = state.subcategory;
  if (sortSelect) sortSelect.value = state.sort;

  const selectedBadges = new Set(state.badges);
  qsa("[name=badge]", form).forEach((input) => {
    input.checked = selectedBadges.has(input.value);
  });
};

const syncUrlState = (searchTerm, filters, limit) => {
  const params = new URLSearchParams();

  if (searchTerm) params.set("q", searchTerm);
  if (filters.price) params.set("price", filters.price);
  if (filters.rating) params.set("rating", String(filters.rating));
  if (filters.category) params.set("category", filters.category);
  if (filters.subcategory) params.set("subcategory", filters.subcategory);
  if (filters.badges.length) params.set("badges", filters.badges.join(","));
  if (filters.sort && filters.sort !== DEFAULT_FILTERS.sort)
    params.set("sort", filters.sort);
  if (limit > CONFIG.perPage) params.set("limit", String(limit));

  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
  history.replaceState(null, "", nextUrl);
};

const createCard = (product) => {
  const article = document.createElement("article");
  article.className = "card product-card";

  const media = document.createElement("div");
  media.className = "product-card__media";
  const img = document.createElement("img");
  img.src = product.images?.[0] || "";
  img.alt = product.name || "";
  img.loading = "lazy";
  img.decoding = "async";
  img.width = 320;
  img.height = 220;
  media.appendChild(img);

  if (Array.isArray(product.badges) && product.badges.length) {
    const badge = document.createElement("span");
    const badgeKey = product.badges[0].toLowerCase();
    badge.className = `badge product-card__badge badge--${badgeKey}`;
    badge.textContent = product.badges[0];
    media.appendChild(badge);
  }

  const body = document.createElement("div");
  body.className = "product-card__content";
  const title = document.createElement("h3");
  title.className = "product-card__title";
  title.textContent = product.name || "";

  const meta = document.createElement("div");
  meta.className = "product-card__meta";
  meta.textContent = `Ocena ${product.rating} • ${product.reviewsCount} opinii`;

  const price = document.createElement("div");
  price.className = "product-card__price";
  price.textContent = formatCurrency(product.price, product.currency);

  if (product.oldPrice) {
    const oldPrice = document.createElement("span");
    oldPrice.className = "product-card__price--old";
    oldPrice.textContent = formatCurrency(product.oldPrice, product.currency);
    price.appendChild(oldPrice);
  }

  const actions = document.createElement("div");
  actions.className = "product-card__actions";

  const viewLink = document.createElement("a");
  viewLink.href = buildProductUrl(product.slug);
  viewLink.className = "btn btn--outline btn--small";
  viewLink.textContent = "Zobacz";

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn--small";
  addBtn.type = "button";
  addBtn.textContent = "Dodaj do koszyka";
  addBtn.setAttribute("data-add-to-cart", product.id);

  actions.append(viewLink, addBtn);
  body.append(title, price, meta, actions);

  article.append(media, body);
  return article;
};

const renderListing = (products, grid, countEl, limit) => {
  grid.innerHTML = "";
  const items = products.slice(0, limit);
  items.forEach((product) => grid.appendChild(createCard(product)));
  if (countEl) {
    countEl.textContent = `${products.length} produktów`;
  }
};

const applyFilters = (products, filters, searchTerm) => {
  const term = searchTerm?.toLowerCase() ?? "";
  return products
    .filter((product) => {
      const badges = Array.isArray(product.badges) ? product.badges : [];
      const name = product.name || "";
      const shortDescription = product.shortDescription || "";

      if (term) {
        const haystack = `${name} ${shortDescription} ${badges.join(" ")}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (filters.category && product.category !== filters.category) return false;
      if (filters.subcategory && product.subcategory !== filters.subcategory)
        return false;
      if (filters.rating && product.rating < filters.rating) return false;
      if (filters.range) {
        if (product.price < filters.range.min || product.price > filters.range.max)
          return false;
      }
      if (filters.badges.length) {
        const hasBadge = filters.badges.some((badge) => badges.includes(badge));
        if (!hasBadge) return false;
      }
      return true;
    })
    .sort(sorters[filters.sort] || sorters.popularity);
};

const getFilters = (form) => {
  const rangeValue = qs("[name=price]", form)?.value;
  const ratingValue = qs("[name=rating]", form)?.value;
  const subValue = qs("[name=subcategory]", form)?.value;
  const sortValue = qs("[name=sort]", form)?.value;
  const badgeInputs = qsa("[name=badge]:checked", form);
  return {
    range: parseRange(rangeValue),
    price: rangeValue || "",
    rating: ratingValue ? Number(ratingValue) : 0,
    subcategory: subValue || "",
    badges: badgeInputs.map((input) => input.value),
    sort: sortValue || DEFAULT_FILTERS.sort,
  };
};

const renderCatalogLoadError = (grid, countEl, loadMoreBtn) => {
  if (!grid) return;
  grid.innerHTML = "";
  const fallback = createFallbackNotice({
    message: "Nie udało się załadować listy produktów. Spróbuj ponownie.",
    actionLabel: "Spróbuj ponownie",
    onAction: () => initCatalog(),
  });
  grid.appendChild(fallback);

  if (countEl) {
    countEl.textContent = "0 produktów";
  }

  if (loadMoreBtn) {
    loadMoreBtn.hidden = true;
    loadMoreBtn.setAttribute("aria-hidden", "true");
  }

  const emptyState = qs("[data-empty-state]");
  if (emptyState) {
    emptyState.hidden = true;
  }
};

const bindAddToCartTriggers = (products) => {
  if (addToCartHandlersBound) return;

  delegate(document, "[data-add-to-cart]", "click", (_, target) => {
    const productId = Number(target.getAttribute("data-add-to-cart"));
    const product = findProductById(products, productId);
    if (!product) return;

    const saved = addToCart(product, 1);
    if (!saved) return;

    updateCartCount();
    showToast(`Dodano „${product.name}” do koszyka.`, { type: "success" });
  });

  addToCartHandlersBound = true;
};

export const initCatalog = async () => {
  const grid = qs(CONFIG.selectors.listingGrid);
  const staticAddToCartButtons = qsa("[data-add-to-cart]");
  if (!grid && !staticAddToCartButtons.length) return;

  const form = qs(CONFIG.selectors.filtersForm);
  const countEl = qs(CONFIG.selectors.listingCount);
  const loadMoreBtn = qs(CONFIG.selectors.listingLoad);
  const searchInput = qs(CONFIG.selectors.searchInput);
  const stateRegion = qs("[data-listing-state]");

  let products = [];
  try {
    products = await loadNormalizedProducts();
  } catch (error) {
    console.error("Catalog data error", error);
    if (grid) {
      renderCatalogLoadError(grid, countEl, loadMoreBtn);
    }
    return;
  }

  bindAddToCartTriggers(products);

  if (!grid) return;

  const initialState = parseStateFromUrl(form);
  let limit = initialState.limit;
  let searchTerm = initialState.searchTerm;

  if (searchInput) {
    searchInput.value = searchTerm;
  }

  applyStateToForm(form, initialState);

  const updateListing = () => {
    const filters = form ? getFilters(form) : { ...DEFAULT_FILTERS };
    const stateFromUrl = parseStateFromUrl(form);
    filters.category = stateFromUrl.category || "";
    const filtered = applyFilters(products, filters, searchTerm);
    renderListing(filtered, grid, countEl, limit);

    if (loadMoreBtn) {
      loadMoreBtn.hidden = filtered.length <= limit;
      loadMoreBtn.setAttribute("aria-hidden", String(filtered.length <= limit));
    }

    if (filtered.length === 0) {
      // The result count above already announces via its own live region
      // (data-listing-count); silence this one so the empty state doesn't
      // fire a second, competing announcement for the same filter change.
      setUiState(stateRegion, {
        type: "empty",
        title: "Brak wyników",
        message: "Zmień filtry lub wpisz inną frazę wyszukiwania.",
        announce: false,
      });
    } else {
      clearUiState(stateRegion);
    }

    syncUrlState(searchTerm, filters, limit);
  };

  if (form) {
    on(form, "change", () => {
      limit = CONFIG.perPage;
      updateListing();
    });
  }

  if (searchInput) {
    on(
      searchInput,
      "input",
      debounce((event) => {
        searchTerm = event.target.value.trim();
        limit = CONFIG.perPage;
        updateListing();
      }, CONFIG.debounceMs),
    );
  }

  if (loadMoreBtn) {
    on(loadMoreBtn, "click", () => {
      limit += CONFIG.perPage;
      updateListing();
    });
  }

  on(window, "popstate", () => {
    const stateFromUrl = parseStateFromUrl(form);
    searchTerm = stateFromUrl.searchTerm;
    limit = stateFromUrl.limit;

    if (searchInput) {
      searchInput.value = searchTerm;
    }

    applyStateToForm(form, stateFromUrl);
    updateListing();
  });

  updateListing();
};
