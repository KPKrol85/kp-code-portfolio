import { FleetStore } from "../state/store.js";
import { CleanupRegistry } from "../utils/cleanup.js";
import { FleetUI } from "../utils/dom.js";
import { Accordion } from "./components/accordion.js";

function getLandingTheme() {
  const { preferences } = FleetStore.state;
  const theme = preferences.theme || "light";
  FleetStore.applyTheme(theme);
  return theme;
}

function initResourcesMenu() {
  const toggle = document.getElementById("resourcesToggle");
  const menu = document.getElementById("resourcesMenu");
  if (!toggle || !menu) return;

  let isOpen = false;

  const closeMenu = (returnFocus = false) => {
    if (!isOpen) return;
    isOpen = false;
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    if (returnFocus) toggle.focus();
  };

  const openMenu = () => {
    if (isOpen) return;
    isOpen = true;
    menu.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.setAttribute("aria-expanded", "false");

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    if (isOpen) {
      closeMenu(true);
    } else {
      openMenu();
    }
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMenu(true));
  });

  const handleDocClick = (event) => {
    if (!menu.contains(event.target) && !toggle.contains(event.target)) {
      closeMenu(true);
    }
  };

  const handleDocKeydown = (event) => {
    if (event.key === "Escape" && isOpen) {
      closeMenu(true);
    }
  };

  document.addEventListener("click", handleDocClick);

  document.addEventListener("keydown", handleDocKeydown);

  CleanupRegistry.add(() => {
    document.removeEventListener("click", handleDocClick);
    document.removeEventListener("keydown", handleDocKeydown);
  });
}

function initLandingShell() {
  const mainContent = document.getElementById("main-content");
  if (mainContent && !mainContent.hasAttribute("tabindex")) {
    mainContent.setAttribute("tabindex", "-1");
  }

  const logoCleanup = FleetUI.bindLogoScroll("home");
  CleanupRegistry.add(logoCleanup);

  const tBtn = document.getElementById("themeToggleLanding");
  if (tBtn) {
    tBtn.addEventListener("click", () => {
      FleetStore.toggleTheme();
      getLandingTheme();
    });
  }

  const navToggle = document.getElementById("navToggle");
  const navDrawer = document.getElementById("mobileNav");
  const navBackdrop = document.querySelector("[data-nav-close]");
  let navOpen = false;

  // Matches the drawer's own persistent-navigation breakpoint (styles/src/08-header.css `@media (min-width: 1025px)`).
  const desktopNavQuery = window.matchMedia("(min-width: 1025px)");

  const applyNavAccessibility = () => {
    if (!navDrawer) return;
    if (desktopNavQuery.matches) {
      navDrawer.removeAttribute("role");
      navDrawer.removeAttribute("aria-modal");
      navDrawer.removeAttribute("aria-hidden");
    } else {
      navDrawer.setAttribute("role", "dialog");
      navDrawer.setAttribute("aria-modal", "true");
      navDrawer.setAttribute("aria-hidden", String(!navOpen));
    }
  };

  const syncNavUI = () => {
    document.documentElement.classList.toggle("is-nav-open", navOpen);
    if (navToggle) navToggle.setAttribute("aria-expanded", String(navOpen));
    applyNavAccessibility();
  };

  const getDrawerFocusables = () => {
    if (!navDrawer) return [];
    return Array.from(navDrawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
  };

  const trapDrawerFocus = (event) => {
    if (!navOpen || event.key !== "Tab") return;
    const focusables = getDrawerFocusables();
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !navDrawer.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const openNav = () => {
    if (!navToggle || !navDrawer) return;
    navOpen = true;
    syncNavUI();
    window.requestAnimationFrame(() => {
      const focusables = getDrawerFocusables();
      const firstItem = focusables[0];
      if (firstItem) firstItem.focus();
    });
  };

  const closeNav = () => {
    if (!navToggle) return;
    navOpen = false;
    syncNavUI();
    navToggle.focus();
  };

  if (navToggle) {
    navToggle.addEventListener("click", () => {
      if (navOpen) {
        closeNav();
      } else {
        openNav();
      }
    });
  }

  if (navBackdrop) {
    navBackdrop.addEventListener("click", () => {
      if (navOpen) closeNav();
    });
  }

  if (navDrawer) {
    navDrawer.addEventListener("click", (event) => {
      if (event.target && event.target.closest("a")) {
        closeNav();
      }
    });
  }

  initResourcesMenu();

  const handleKeydown = (event) => {
    if (event.key === "Escape" && navOpen) {
      closeNav();
      return;
    }
    trapDrawerFocus(event);
  };
  document.addEventListener("keydown", handleKeydown);

  const handleDesktopNavChange = () => {
    if (desktopNavQuery.matches) {
      navOpen = false;
    }
    syncNavUI();
  };
  desktopNavQuery.addEventListener("change", handleDesktopNavChange);

  syncNavUI();

  CleanupRegistry.add(() => {
    document.removeEventListener("keydown", handleKeydown);
    desktopNavQuery.removeEventListener("change", handleDesktopNavChange);
  });

  const siteHeader = document.querySelector(".landing .site-header");
  if (siteHeader) {
    let lastY = 0;
    let ticking = false;
    let isScrolled = siteHeader.classList.contains("is-scrolled");
    const SHRINK_ADD_Y = 72;
    const SHRINK_REMOVE_Y = 24;
    const scrollOptions = { passive: true };

    const setScrolled = (next) => {
      if (next === isScrolled) return;
      isScrolled = next;
      siteHeader.classList.toggle("is-scrolled", next);
    };

    const onScroll = () => {
      lastY = window.scrollY || 0;
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        if (lastY > SHRINK_ADD_Y) {
          setScrolled(true);
        } else if (lastY < SHRINK_REMOVE_Y) {
          setScrolled(false);
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, scrollOptions);
    onScroll();

    CleanupRegistry.add(() => {
      window.removeEventListener("scroll", onScroll, scrollOptions);
    });
  }

  document.querySelectorAll(".accordion").forEach((el) => Accordion.init(el));
}

FleetUI.getLandingTheme = getLandingTheme;
FleetUI.initResourcesMenu = initResourcesMenu;
FleetUI.initLandingShell = initLandingShell;

export { getLandingTheme, initResourcesMenu, initLandingShell };
