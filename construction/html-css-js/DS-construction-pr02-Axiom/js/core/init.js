import { initCookieBanner } from "../components/cookies.js";
import { initContactSection } from "../sections/contact.js";
import { initCompactHeader } from "../components/header.js";
import { initHeroReveal } from "../sections/hero.js";
import { initLightbox } from "../components/lightbox.js";
import { initNavigation } from "../components/navigation.js";
import { initScrollTop } from "../components/scroll-top.js";
import { initThemeToggle } from "../components/theme.js";
import { registerServiceWorker } from "./service-worker.js";

export const initApp = () => {
  initHeroReveal();
  initThemeToggle();
  initNavigation();
  initScrollTop();
  initContactSection();
  initLightbox();
  initCompactHeader();
  initCookieBanner();
  registerServiceWorker();
};
