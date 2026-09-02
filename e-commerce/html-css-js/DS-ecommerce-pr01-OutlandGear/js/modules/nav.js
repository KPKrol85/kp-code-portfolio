import { qs, qsa, on } from "./dom.js";

const DESKTOP_NAV_MIN = 1040;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

const getDropdownMenu = (toggle) => {
  const menuId = toggle?.getAttribute("aria-controls");
  return menuId ? qs(`#${menuId}`) : null;
};

const closeAllDropdowns = () => {
  qsa("[data-dropdown-toggle]").forEach((toggle) => {
    toggle.setAttribute("aria-expanded", "false");
    const menu = getDropdownMenu(toggle);
    if (menu) menu.setAttribute("aria-hidden", "true");
  });
};

const getNavElements = () => {
  const drawer = qs("[data-nav-drawer]");
  const searchPanel = qs("[data-search-panel]");

  return {
    header: qs(".site-header"),
    navToggle: qs("[data-nav-toggle]"),
    navClose: qs("[data-nav-close]"),
    drawer,
    drawerPanel: drawer ? qs("[data-nav-panel]", drawer) : null,
    searchToggle: qs("[data-search-toggle]"),
    searchPanel,
    searchInput: searchPanel ? qs("[data-search-input]", searchPanel) : null,
  };
};

const getDrawerFocusable = (drawer) => {
  if (!drawer) return [];
  return qsa(FOCUSABLE_SELECTOR, drawer).filter(
    (element) => !element.hasAttribute("disabled"),
  );
};

const setDrawerState = (isOpen) => {
  const { navToggle, drawer } = getNavElements();
  if (!navToggle || !drawer) return false;

  drawer.classList.toggle("is-open", isOpen);
  drawer.setAttribute("aria-hidden", String(!isOpen));
  navToggle.classList.toggle("is-active", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "Zamknij menu" : "Otwórz menu");
  document.body.classList.toggle("nav-drawer-open", isOpen);
  return true;
};

const setSearchState = (isOpen) => {
  const { header, searchToggle, searchPanel } = getNavElements();
  if (!header || !searchToggle || !searchPanel) return false;

  header.classList.toggle("is-search-open", isOpen);
  searchPanel.classList.toggle("is-open", isOpen);
  searchToggle.setAttribute("aria-expanded", String(isOpen));
  searchToggle.setAttribute(
    "aria-label",
    isOpen ? "Zamknij wyszukiwanie" : "Otwórz wyszukiwanie",
  );
  return true;
};

const setupDropdowns = () => {
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const toggle = target.closest("[data-dropdown-toggle]");
    if (!toggle) {
      closeAllDropdowns();
      return;
    }

    event.stopPropagation();
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    closeAllDropdowns();

    if (isExpanded) return;

    toggle.setAttribute("aria-expanded", "true");
    const menu = getDropdownMenu(toggle);
    if (menu) menu.setAttribute("aria-hidden", "false");
  });

  on(document, "keydown", (event) => {
    if (event.key === "Escape") {
      closeAllDropdowns();
    }
  });
};

const setupDrawer = () => {
  let lastActiveElement = null;

  const closeDrawer = () => {
    if (!setDrawerState(false)) return;
    if (lastActiveElement instanceof HTMLElement) {
      lastActiveElement.focus();
    }
    lastActiveElement = null;
  };

  const openDrawer = () => {
    const { header, drawer, drawerPanel, searchPanel, searchToggle } = getNavElements();
    if (!drawer) return;

    lastActiveElement = document.activeElement;
    if (header) header.classList.remove("is-search-open");
    if (searchToggle) searchToggle.setAttribute("aria-expanded", "false");
    if (searchPanel) searchPanel.classList.remove("is-open");
    if (!setDrawerState(true)) return;

    const [firstFocusable] = getDrawerFocusable(drawer);
    if (firstFocusable) firstFocusable.focus();
    else if (drawerPanel) drawerPanel.focus();
  };

  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-nav-toggle]")) {
      const { drawer } = getNavElements();
      if (!drawer) return;
      const isOpen = drawer.getAttribute("aria-hidden") === "false";
      if (isOpen) closeDrawer();
      else openDrawer();
      return;
    }

    if (target.closest("[data-nav-close]")) {
      closeDrawer();
      return;
    }

    const { drawer } = getNavElements();
    if (drawer && target === drawer) {
      closeDrawer();
    }
  });

  on(document, "keydown", (event) => {
    const { drawer, drawerPanel } = getNavElements();
    if (!drawer || drawer.getAttribute("aria-hidden") === "true") return;

    if (event.key === "Escape") {
      closeDrawer();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = getDrawerFocusable(drawer);
    if (!focusable.length) {
      event.preventDefault();
      if (drawerPanel) drawerPanel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !drawer.contains(active))) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });

  on(
    window,
    "resize",
    () => {
      if (window.innerWidth >= DESKTOP_NAV_MIN) {
        closeDrawer();
      }
    },
    { passive: true },
  );

  setDrawerState(false);
};

const setupSearchToggle = () => {
  let lastActiveElement = null;

  const isDesktop = () => window.innerWidth >= DESKTOP_NAV_MIN;

  const closeSearch = () => {
    const { searchInput } = getNavElements();
    if (!setSearchState(false)) return;
    if (lastActiveElement instanceof HTMLElement && lastActiveElement !== searchInput) {
      lastActiveElement.focus();
    }
    lastActiveElement = null;
  };

  const openSearch = () => {
    const { searchInput } = getNavElements();
    if (!searchInput) return;
    lastActiveElement = document.activeElement;
    if (!setSearchState(true)) return;
    window.requestAnimationFrame(() => searchInput.focus());
  };

  on(document, "click", (event) => {
    const { header, searchToggle, searchPanel } = getNavElements();
    const target = event.target;
    if (!header || !searchToggle || !searchPanel || !(target instanceof Node)) return;

    if (target instanceof Element && target.closest("[data-search-toggle]")) {
      if (isDesktop()) return;
      const isOpen = header.classList.contains("is-search-open");
      if (isOpen) closeSearch();
      else openSearch();
      return;
    }

    if (isDesktop() || !header.classList.contains("is-search-open")) return;
    if (searchPanel.contains(target) || searchToggle.contains(target)) return;
    closeSearch();
  });

  on(document, "keydown", (event) => {
    const { header } = getNavElements();
    if (!header) return;
    if (
      event.key !== "Escape" ||
      isDesktop() ||
      !header.classList.contains("is-search-open")
    )
      return;
    closeSearch();
  });

  on(
    window,
    "resize",
    () => {
      if (isDesktop()) {
        setSearchState(false);
        lastActiveElement = null;
      }
    },
    { passive: true },
  );

  setSearchState(false);
};

const setupStickyHeaderShrink = () => {
  const header = qs(".site-header");
  const ENTER_THRESHOLD = 44;
  const EXIT_THRESHOLD = 16;
  let isShrunk = false;
  let frameId = null;

  if (!header) return;

  const applyState = (shouldShrink) => {
    if (shouldShrink === isShrunk) return;
    isShrunk = shouldShrink;
    header.classList.toggle("is-shrunk", shouldShrink);
  };

  const updateState = () => {
    frameId = null;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (!isShrunk && scrollY >= ENTER_THRESHOLD) {
      applyState(true);
      return;
    }

    if (isShrunk && scrollY <= EXIT_THRESHOLD) {
      applyState(false);
    }
  };

  const requestUpdate = () => {
    if (frameId !== null) return;
    frameId = window.requestAnimationFrame(updateState);
  };

  updateState();
  on(window, "scroll", requestUpdate, { passive: true });
  on(window, "resize", requestUpdate, { passive: true });
};

export const initNav = () => {
  closeAllDropdowns();
  setupDropdowns();
  setupDrawer();
  setupSearchToggle();
  setupStickyHeaderShrink();
};
