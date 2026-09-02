import { CONFIG } from "./config.js";
import { qs, on } from "./modules/dom.js";
import { initNav } from "./modules/nav.js";
import { initPartials, PARTIALS_READY_EVENT } from "./modules/partials.js";
import { initCatalog } from "./modules/catalog.js";
import { initProduct } from "./modules/product.js";
import { initCart, updateCartCount } from "./modules/cart.js";
import { initCheckout } from "./modules/checkout.js";
import { initContactForm } from "./modules/contact.js";
import { initLegalModal } from "./modules/legal-modal.js";
import { initFaq } from "./modules/faq.js";
import { initNewsletterForm } from "./modules/newsletter.js";
import { initTheme } from "./modules/theme.js";
import { initTravelKits } from "./modules/travel-kits.js";

const initSearch = () => {
  const form = qs(CONFIG.selectors.searchForm);
  const input = qs(CONFIG.selectors.searchInput);
  if (!form || !input) return;

  on(form, "submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    const target = query
      ? `kategoria.html?q=${encodeURIComponent(query)}`
      : "kategoria.html";
    window.location.href = target;
  });
};

let appInitialized = false;

const initApp = () => {
  if (appInitialized) return;
  appInitialized = true;

  initTheme();
  initNav();
  initSearch();
  updateCartCount();
  initCatalog();
  initProduct();
  initTravelKits();
  initCart();
  initCheckout();
  initContactForm();
  initFaq();
  initNewsletterForm();
  initLegalModal();
};

const bootstrapApp = async () => {
  document.addEventListener(
    PARTIALS_READY_EVENT,
    () => {
      initApp();
    },
    { once: true },
  );

  await initPartials();
};

document.addEventListener("DOMContentLoaded", () => {
  void bootstrapApp();
});
