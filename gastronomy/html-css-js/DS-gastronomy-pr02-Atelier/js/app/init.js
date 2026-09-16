import { initNetworkStatusBanner } from "../features/network.js";
import { initDemoLegalModal } from "../features/demo-modal.js";
import { initThemeToggle } from "../features/theme.js";
import { initNav } from "../features/nav.js";
import { initReveal } from "../features/reveal.js";
import { initImageFallbacks, renderFeaturedMenu, initMenuPage } from "../features/menu.js";
import { initGalleryPage } from "../features/gallery.js";
import { initLightbox } from "../features/lightbox.js";
import { initForm } from "../features/form.js";
import { initMisc } from "../features/misc.js";

var COMMON_INITIALIZERS = [initMisc, initNetworkStatusBanner, initDemoLegalModal, initNav, initReveal, initThemeToggle];

var PAGE_INITIALIZERS = {
  home: [initImageFallbacks, initForm, renderHomeFeaturedMenu, initLightbox],
  contact: [initForm],
  menu: [initImageFallbacks, initMenuPage],
  gallery: [initImageFallbacks, initGalleryPage, initLightbox],
};

function runInitializers(initializers) {
  initializers.forEach(function (initializer) {
    if (typeof initializer === "function") {
      initializer();
    }
  });
}

function renderHomeFeaturedMenu() {
  renderFeaturedMenu().then(function (rendered) {
    if (rendered && typeof window.initReveal === "function") {
      window.initReveal();
    }
  });
}

function getCurrentPage() {
  if (!document.body || !document.body.dataset) return "";
  return document.body.dataset.page || document.body.dataset.template || "";
}

export function initCommon() {
  runInitializers(COMMON_INITIALIZERS);
}

export function initByPage(page) {
  var initializers = PAGE_INITIALIZERS[page];
  if (!Array.isArray(initializers)) return;
  runInitializers(initializers);
}

export function initApp() {
  document.addEventListener("DOMContentLoaded", function () {
    var page = getCurrentPage();
    initCommon();
    initByPage(page);
  });
}
