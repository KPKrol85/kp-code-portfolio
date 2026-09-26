const getFocusableElements = (container) =>
  Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  );

export const initNav = () => {
  const toggle = document.querySelector("[data-nav-toggle]");
  const panel = document.querySelector("[data-nav-panel]");
  const pageContent = document.querySelector("[data-page-content]");
  if (!toggle || !panel) return;

  let isOpen = false;

  const isMobileViewport = () => window.innerWidth < 900;

  const setPageInert = (nextOpenState) => {
    if (!pageContent || !isMobileViewport() || !("inert" in pageContent)) return;
    pageContent.inert = nextOpenState;
  };

  const setMenuState = (nextOpenState) => {
    isOpen = nextOpenState;
    panel.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      panel.removeAttribute("aria-hidden");
    } else {
      panel.setAttribute("aria-hidden", "true");
    }

    document.body.style.overflow = isOpen && isMobileViewport() ? "hidden" : "";
    setPageInert(isOpen);
  };

  const openMenu = () => {
    setMenuState(true);
    const focusables = getFocusableElements(panel);
    focusables[0]?.focus();
  };

  const closeMenu = () => {
    setMenuState(false);
    toggle.focus();
  };

  toggle.addEventListener("click", () => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  panel.addEventListener("click", (event) => {
    if (event.target.closest(".nav__link")) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") {
      closeMenu();
      return;
    }

    if (event.key === "Tab") {
      const focusables = getFocusableElements(panel);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener("resize", () => {
    if (!isMobileViewport()) {
      setMenuState(false);
      return;
    }

    if (isOpen) {
      setMenuState(true);
    }
  });

  setMenuState(false);
};
