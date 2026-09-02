import { CONFIG } from "../config.js";
import { qs, qsa, delegate } from "./dom.js";
import { loadCart, saveCart, getStorageStatus } from "./storage.js";
import { clamp, formatCurrency } from "../utils.js";
import { showToast } from "./toast.js";
import { createFallbackNotice } from "./fallback.js";
import { clearUiState, setUiState } from "./ui-state.js";
import { findProductById, loadNormalizedProducts } from "./product-data.js";

let productsCache = [];
let cartHandlersBound = false;

const getCart = () => loadCart();

const setCart = (cart) => saveCart(cart);

const upsertStorageNotice = (container, actionLabel, onAction) => {
  if (!container) return;

  const status = getStorageStatus();
  const existing = qs("[data-storage-warning]", container.parentElement || container);

  if (status.available) {
    if (existing) existing.remove();
    return;
  }

  const notice = createFallbackNotice({
    message: status.message || "Nie możemy zapisać zmian w koszyku.",
    actionLabel,
    onAction,
    role: "status",
    polite: true,
  });

  notice.setAttribute("data-storage-warning", "");

  if (existing) {
    existing.replaceWith(notice);
  } else {
    container.before(notice);
  }
};

export const addToCart = (product, qty = 1) => {
  if (!product || !Number.isFinite(Number(product.id))) return;

  const cart = getCart();
  const productId = Number(product.id);
  const existing = cart.items.find((item) => item.id === productId);
  if (existing) {
    existing.qty = clamp(existing.qty + qty, 1, 99);
  } else {
    cart.items.push({ id: productId, qty: clamp(qty, 1, 99) });
  }
  const saved = setCart(cart);
  if (!saved) {
    showToast("Nie udało się zapisać koszyka. Odśwież stronę i spróbuj ponownie.", {
      type: "error",
    });
  }
  return saved;
};

export const updateCartCount = () => {
  const cart = getCart();
  const count = cart.items.reduce((total, item) => total + item.qty, 0);
  qsa(CONFIG.selectors.cartCount).forEach((el) => {
    el.textContent = String(count);
  });
};

const removeItem = (id) => {
  const cart = getCart();
  cart.items = cart.items.filter((item) => item.id !== id);
  return setCart(cart);
};

const updateQty = (id, qty) => {
  const cart = getCart();
  const item = cart.items.find((entry) => entry.id === id);
  if (item) {
    item.qty = clamp(qty, 1, 99);
  }
  return setCart(cart);
};

const calculateTotals = (items) => {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0),
    0,
  );
  const delivery = subtotal > 600 ? 0 : 24;
  return { subtotal, delivery, total: subtotal + delivery };
};

const syncCartLayout = (summary, isEmpty) => {
  if (!summary) return;

  summary.hidden = isEmpty;
  const cartLayout = summary.closest(".cart");
  if (!cartLayout) return;

  cartLayout.classList.toggle("cart--empty", isEmpty);
};

const renderCart = (items, stateRegion) => {
  const container = qs(CONFIG.selectors.cartContainer);
  const summary = qs(CONFIG.selectors.cartSummary);
  if (!container || !summary) return;

  container.innerHTML = "";
  if (!items.length) {
    syncCartLayout(summary, true);
    setUiState(stateRegion, {
      type: "empty",
      title: "Koszyk jest pusty",
      message: "Dodaj produkty z katalogu, aby przejść do podsumowania.",
    });
    return;
  }

  syncCartLayout(summary, false);
  clearUiState(stateRegion);

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.setAttribute("data-cart-item", item.id);

    const media = document.createElement("img");
    media.className = "cart-item__media";
    media.src = item.images?.[0] || "";
    media.alt = item.name;
    media.loading = "lazy";
    media.decoding = "async";
    media.width = 90;
    media.height = 90;

    const info = document.createElement("div");
    info.className = "cart-item__info";
    const title = document.createElement("p");
    title.className = "cart-item__title";
    title.textContent = item.name;
    const meta = document.createElement("p");
    meta.className = "subtle cart-item__meta";
    meta.textContent = `${item.category} • ${item.subcategory}`;
    info.append(title, meta);

    const price = document.createElement("div");
    price.className = "cart-item__price";
    price.textContent = formatCurrency(item.price, item.currency);

    const qtyGroup = document.createElement("div");
    qtyGroup.className = "cart-item__controls";
    const qtyLabel = document.createElement("label");
    qtyLabel.className = "visually-hidden";
    qtyLabel.textContent = "Ilość";
    qtyLabel.setAttribute("for", `qty-${item.id}`);
    const qtyInput = document.createElement("input");
    qtyInput.className = "form__input cart-item__qty";
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.max = "99";
    qtyInput.value = String(item.qty);
    qtyInput.id = `qty-${item.id}`;
    qtyInput.setAttribute("data-qty-input", item.id);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn--ghost btn--small cart-item__remove";
    removeBtn.type = "button";
    removeBtn.textContent = "Usuń";
    removeBtn.setAttribute("data-remove-item", item.id);

    qtyGroup.append(qtyLabel, qtyInput, removeBtn);

    row.append(media, info, price, qtyGroup);
    container.appendChild(row);
  });

  const totals = calculateTotals(items);
  summary.innerHTML = `
    <div class="cart-summary__header">
      <p class="kicker">Podsumowanie</p>
      <h2 class="cart-summary__title">Wartość zamówienia</h2>
    </div>
    <div class="cart-summary__rows">
      <div class="cart-summary__row"><span>Subtotal</span><span>${formatCurrency(totals.subtotal)}</span></div>
      <div class="cart-summary__row"><span>Dostawa</span><span>${totals.delivery ? formatCurrency(totals.delivery) : "0 PLN"}</span></div>
      <div class="cart-summary__row cart-summary__row--total"><span>Razem</span><span>${formatCurrency(totals.total)}</span></div>
    </div>
  `;
};

const hydrateItems = (products, cart) =>
  cart.items
    .map((item) => {
      const product = findProductById(products, item.id);
      if (!product) return null;
      return { ...product, qty: item.qty };
    })
    .filter(Boolean);

const renderCartLoadError = (container, summary) => {
  if (!container) return;

  container.innerHTML = "";
  syncCartLayout(summary, false);
  const fallback = createFallbackNotice({
    message: "Nie udało się załadować danych produktów w koszyku. Spróbuj ponownie.",
    actionLabel: "Spróbuj ponownie",
    onAction: () => initCart(),
  });

  container.appendChild(fallback);
  if (summary) {
    summary.innerHTML =
      '<p class="subtle">Odśwież dane, aby zobaczyć podsumowanie zamówienia.</p>';
  }
};

export const initCart = async () => {
  const container = qs(CONFIG.selectors.cartContainer);
  if (!container) {
    updateCartCount();
    return;
  }

  const summary = qs(CONFIG.selectors.cartSummary);
  const stateRegion = qs("[data-cart-state]");

  try {
    productsCache = await loadNormalizedProducts();
  } catch (error) {
    console.error("Cart data error", error);
    renderCartLoadError(container, summary);
    return;
  }

  const cart = getCart();
  const items = hydrateItems(productsCache, cart);
  renderCart(items, stateRegion);
  updateCartCount();
  upsertStorageNotice(container, "Odśwież stronę", () => window.location.reload());

  if (cartHandlersBound) return;

  delegate(container, "[data-remove-item]", "click", (_, target) => {
    const id = Number(target.getAttribute("data-remove-item"));
    if (!Number.isInteger(id)) return;
    const updated = removeItem(id);
    if (!updated) {
      upsertStorageNotice(container, "Odśwież stronę", () => window.location.reload());
      return;
    }

    const refreshed = hydrateItems(productsCache, getCart());
    renderCart(refreshed, stateRegion);
    updateCartCount();
    upsertStorageNotice(container, "Odśwież stronę", () => window.location.reload());
  });

  delegate(container, "[data-qty-input]", "change", (_, target) => {
    const id = Number(target.getAttribute("data-qty-input"));
    const qty = Number(target.value);
    if (!Number.isInteger(id) || !Number.isFinite(qty)) return;
    const updated = updateQty(id, qty);

    if (!updated) {
      upsertStorageNotice(container, "Odśwież stronę", () => window.location.reload());
      return;
    }

    const refreshed = hydrateItems(productsCache, getCart());
    renderCart(refreshed, stateRegion);
    updateCartCount();
    upsertStorageNotice(container, "Odśwież stronę", () => window.location.reload());
  });

  cartHandlersBound = true;
};
