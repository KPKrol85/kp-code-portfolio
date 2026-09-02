import { initReveal } from "./modules/reveal.js";
import { initHeaderShrink } from "./modules/headerShrink.js";
import { initMobileNav } from "./modules/mobileNav.js";
import { initScrollSpy } from "./modules/scrollSpy.js";
import { initAccordion } from "./modules/accordion.js";
import { initMaterialsCatalog } from "./modules/materialsCatalog.js";
import { initAnchorFocus } from "./modules/anchorFocus.js";
import { initProjectDisclosure } from "./modules/projectDisclosure.js";
import { initProgressPage } from "./pages/progress-page.js";
import { readStoredValue, writeStoredValue } from "./state/browserStorage.js";

const reportInitializationFailure = (name, error) => {
  console.error(`[Lauren English] ${name} initialization failed.`, error);
};

const PROJECT_CACHE_PREFIX = "lauren-english-v";
const PROJECT_SERVICE_WORKER_PATH = "/service-worker.js";

const runInitializer = (name, initializer) => {
  try {
    initializer();
  } catch (error) {
    reportInitializationFailure(name, error);
  }
};

const initThemeToggle = () => {
  const toggles = Array.from(document.querySelectorAll("[data-theme-toggle]"));
  if (!toggles.length) return;

  const applyTheme = (theme) => {
    const isDark = theme === "dark";
    const actionLabel = isDark ? "Włącz tryb jasny" : "Włącz tryb ciemny";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    toggles.forEach((toggle) => {
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.setAttribute("aria-label", actionLabel);
    });
  };

  const savedTheme = readStoredValue("theme");
  applyTheme(savedTheme === "dark" ? "dark" : "light");

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      writeStoredValue("theme", nextTheme);
    });
    toggle.hidden = false;
  });
};

const isLocalDevelopmentOrigin = () => location.port === "5173" && ["127.0.0.1", "localhost"].includes(location.hostname);

const isProjectServiceWorker = (registration) =>
  [registration.active, registration.waiting, registration.installing].filter(Boolean).some((worker) => {
    const scriptUrl = new URL(worker.scriptURL);
    return scriptUrl.origin === location.origin && scriptUrl.pathname === PROJECT_SERVICE_WORKER_PATH;
  });

const clearLocalDevelopmentPwaState = async () => {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(isProjectServiceWorker).map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((cacheName) => cacheName.startsWith(PROJECT_CACHE_PREFIX)).map((cacheName) => caches.delete(cacheName)));
  }
};

const registerServiceWorker = () => {
  window.addEventListener("load", () => {
    if (isLocalDevelopmentOrigin()) {
      clearLocalDevelopmentPwaState().catch((error) => reportInitializationFailure("Local Service Worker cleanup", error));
      return;
    }

    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = navigator.serviceWorker.register(PROJECT_SERVICE_WORKER_PATH);
      registration.catch((error) => reportInitializationFailure("Service worker", error));
    } catch (error) {
      reportInitializationFailure("Service worker", error);
    }
  });
};

[
  ["Reveal", initReveal],
  ["Header shrink", initHeaderShrink],
  ["Mobile navigation", initMobileNav],
  ["Scroll spy", initScrollSpy],
  ["Accordion", initAccordion],
  ["Materials catalogue", initMaterialsCatalog],
  ["Anchor focus", initAnchorFocus],
  ["Project disclosure", initProjectDisclosure],
  ["Theme toggle", initThemeToggle],
  ["Progress page", initProgressPage],
  ["Service worker", registerServiceWorker],
].forEach(([name, initializer]) => runInitializer(name, initializer));
