import { initHelpers, reportError } from "./modules/utils.js";
import { initThemeSwitcher } from "./modules/theme.js";
import { initMobileNav, initScrollspy, initSmartNav, initAriaCurrent, initStickyShadow } from "./modules/nav.js";
import { initFooterYear } from "./modules/footer.js";
import { initScrollButtons, initScrollToTop, initScrollTargets } from "./modules/scroll.js";
import { initCtaPulse } from "./modules/cta.js";
import { initLoadMoreMenu, initLoadMoreGallery } from "./modules/load-more.js";
import { initTabs, initGalleryFilter } from "./modules/tabs.js";
import { initPageMenuPanel } from "./modules/page-menu.js";
import { initReservationForm } from "./modules/form.js";
import { initLightbox } from "./modules/lightbox.js";
import { initFaqAria } from "./modules/faq.js";
import { initDemoLegalModal } from "./modules/demo-legal.js";

const FEATURES = [
  { name: "HELPERS", init: initHelpers },
  { name: "THEME SWITCHER", init: initThemeSwitcher },

  { name: "MOBILE NAV", init: initMobileNav },

  { name: "FOOTER YEAR", init: initFooterYear },

  { name: "SMART NAV", init: initSmartNav },
  { name: "NAV", init: initAriaCurrent },
  { name: "SCROLLSPY", init: initScrollspy },

  { name: "STICKY SHADOW", init: initStickyShadow },
  { name: "SCROLL BUTTONS", init: initScrollButtons },
  { name: "SCROLL TO TOP", init: initScrollToTop },
  { name: "SCROLL TARGETS", init: initScrollTargets },

  { name: "CTA", init: initCtaPulse },

  { name: "DEMO LEGAL MODAL", init: initDemoLegalModal },
  { name: "LOAD MORE MENU", init: initLoadMoreMenu },
  { name: "TABS", init: initTabs },
  { name: "PAGE MENU", init: initPageMenuPanel },
  { name: "RESERVATION FORM", init: initReservationForm },

  { name: "LOAD MORE GALLERY", init: initLoadMoreGallery },
  { name: "GALLERY FILTER", init: initGalleryFilter },
  { name: "LIGHTBOX", init: initLightbox },

  { name: "FAQ", init: initFaqAria }
];

function boot() {
  for (const f of FEATURES) {
    try {
      f.init();
    } catch (err) {
      reportError(err, f.name);
    }
  }
}

document.addEventListener("DOMContentLoaded", boot);
