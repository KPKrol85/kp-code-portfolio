const focusableSelectors =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
const desktopNavigationQuery = "(min-width: 1280px)";

export const initMobileNav = () => {
  const toggle = document.querySelector(".nav__toggle");
  const drawer = document.querySelector("[data-drawer]");
  const toggleLabel = toggle?.querySelector("[data-nav-toggle-label]");
  const navigation = toggle?.closest(".nav");
  const desktopActions = document.querySelector(".header__actions");
  if (!toggle || !drawer || !toggleLabel || !navigation) return;
  if (typeof window.matchMedia !== "function") return;

  const desktopQuery = window.matchMedia(desktopNavigationQuery);
  if (!desktopQuery) return;
  let lastFocused = null;

  const getFocusableElements = () =>
    Array.from(drawer.querySelectorAll(focusableSelectors)).filter(
      (element) =>
        element instanceof HTMLElement && element.offsetParent !== null,
    );

  const setToggleState = (isOpen) => {
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggleLabel.textContent = isOpen ? "Zamknij menu" : "Otwórz menu";
  };

  const setMobileDrawerState = (isOpen) => {
    drawer.classList.toggle("is-open", isOpen);
    drawer.setAttribute("aria-hidden", String(!isOpen));
    drawer.inert = !isOpen;
    document.body.classList.toggle("has-open-navigation", isOpen);
    setToggleState(isOpen);
  };

  const openDrawer = () => {
    if (desktopQuery.matches) return;
    lastFocused = document.activeElement;
    setMobileDrawerState(true);
    getFocusableElements()[0]?.focus();
  };

  const closeDrawer = ({ restoreFocus = true } = {}) => {
    const focusTarget =
      lastFocused instanceof HTMLElement && document.contains(lastFocused)
        ? lastFocused
        : toggle;

    drawer.classList.remove("is-open");
    document.body.classList.remove("has-open-navigation");
    setToggleState(false);
    if (restoreFocus && !desktopQuery.matches) {
      focusTarget.focus();
    }
    drawer.setAttribute("aria-hidden", "true");
    drawer.inert = true;
    lastFocused = null;
  };

  const exposeDesktopNavigation = () => {
    const activeElement = document.activeElement;
    const mobileOnlyControlHasFocus =
      activeElement === toggle ||
      activeElement === drawer.querySelector(".nav__cta");

    drawer.classList.remove("is-open");
    drawer.removeAttribute("aria-hidden");
    drawer.inert = false;
    document.body.classList.remove("has-open-navigation");
    setToggleState(false);
    lastFocused = null;

    if (mobileOnlyControlHasFocus) {
      drawer.querySelector(".nav__link")?.focus();
    }
  };

  const hideMobileNavigation = () => {
    const activeElement = document.activeElement;
    if (
      drawer.contains(activeElement) ||
      desktopActions?.contains(activeElement)
    ) {
      toggle.focus();
    }
    closeDrawer({ restoreFocus: false });
  };

  const syncNavigationMode = () => {
    if (!navigation.classList.contains("is-enhanced")) return;

    if (desktopQuery.matches) {
      exposeDesktopNavigation();
    } else {
      hideMobileNavigation();
    }
  };

  const onKeydown = (event) => {
    if (desktopQuery.matches || !drawer.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = getFocusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!drawer.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  toggle.addEventListener("click", () => {
    if (!navigation.classList.contains("is-enhanced")) return;

    if (drawer.classList.contains("is-open")) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  drawer.addEventListener("click", (event) => {
    if (
      !desktopQuery.matches &&
      drawer.classList.contains("is-open") &&
      event.target.closest("a[href]")
    ) {
      closeDrawer();
    }
  });

  document.addEventListener("keydown", onKeydown);
  if (typeof desktopQuery.addEventListener === "function") {
    desktopQuery.addEventListener("change", syncNavigationMode);
  } else if (typeof desktopQuery.addListener === "function") {
    desktopQuery.addListener(syncNavigationMode);
  } else {
    return;
  }

  try {
    navigation.classList.add("is-enhanced");
    toggle.hidden = false;
    syncNavigationMode();
  } catch (error) {
    navigation.classList.remove("is-enhanced");
    toggle.hidden = true;
    drawer.classList.remove("is-open");
    drawer.removeAttribute("aria-hidden");
    drawer.inert = false;
    document.body.classList.remove("has-open-navigation");
    throw error;
  }
};
