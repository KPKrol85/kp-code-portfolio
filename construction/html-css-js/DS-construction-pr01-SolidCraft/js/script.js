import { utils } from "./modules/utils.js";
import { initNav, initHeaderShrink, initScrollSpy } from "./modules/nav.js";
import {
  initFooterYear,
  initSmoothTop,
  initScrollReveal,
  initThemeToggle,
  initRipple,
  initHeroBlurSync,
} from "./modules/ui-core.js";
import { createIcon, initIcons } from "./modules/icons.js";
import { initContactForm } from "./modules/forms.js";
import { initOfertaLightbox } from "./modules/lightbox.js";
import { initOfferPrefetch } from "./modules/prefetch.js";
import { initHomeHelpers } from "./modules/home.js";
import { initMapConsent } from "./modules/map-consent.js";
import { initProjectBanner } from "./modules/project-banner.js";

window.SC = window.SC || {};
window.SC.utils = utils;
window.SC.nav = {
  init: initNav,
  initHeaderShrink,
  initScrollSpy,
};
window.SC.ui = {
  initFooterYear,
  initSmoothTop,
  initScrollReveal,
  initThemeToggle,
  initRipple,
  initHeroBlurSync,
};
window.SC.icons = { init: initIcons, create: createIcon };
window.SC.forms = { init: initContactForm };
window.SC.lightbox = { init: initOfertaLightbox };
window.SC.prefetch = { init: initOfferPrefetch };
window.SC.home = { init: initHomeHelpers };
window.SC.mapConsent = { init: initMapConsent };
window.SC.projectBanner = { init: initProjectBanner };
window.utils = window.utils || utils;

const runInit = () => {
  utils.syncHeaderCssVar?.();

  const has = (selector) => !!document.querySelector(selector);

  if (has("[data-icon]")) initIcons?.();

  if (has(".nav-toggle") && has("#navMenu")) initNav?.();
  if (has('.site-header, header[role="banner"]')) initHeaderShrink?.();
  if (has('.nav-menu a[href^="#"]')) initScrollSpy?.();

  if (has("#year")) initFooterYear?.();
  if (has('a[href="#top"], .scroll-top, [data-scroll="top"]'))
    initSmoothTop?.();
  if (has("[data-reveal]")) initScrollReveal?.();
  if (has(".theme-toggle")) initThemeToggle?.();
  if (has(".nav-menu li > a.btn.btn--sm")) initRipple?.();
  if (has(".hero__bg img") && has(".hero__bg-blur")) initHeroBlurSync?.();

  if (has("#oferta .card picture img, .gallery .gallery-item picture img"))
    initOfertaLightbox?.();
  if (
    has(
      '.services-track h3 a[href^="oferta/"], #oferta .card h3 a[href^="oferta/"]',
    )
  )
    initOfferPrefetch?.();
  if (has("#kontakt") || has("#oferta") || has("#strona-glowna"))
    initHomeHelpers?.();

  if (has("[data-map-src]")) initMapConsent?.();
  if (has("section#kontakt .form")) initContactForm?.();
  if (has("#projectBanner")) initProjectBanner?.();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runInit, { once: true });
} else {
  runInit();
}
