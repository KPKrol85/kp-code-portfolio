(() => {
  const root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  const THEME_KEY = "eternalRestTheme";
  const THEME_VERSION = 1;
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const themeAuto = document.querySelector("[data-theme-auto]");
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const getStoredTheme = () => {
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (!raw) return { version: THEME_VERSION, mode: "auto" };
      const data = JSON.parse(raw);
      if (data.version !== THEME_VERSION) {
        return { version: THEME_VERSION, mode: "auto" };
      }
      return data;
    } catch (error) {
      return { version: THEME_VERSION, mode: "auto" };
    }
  };

  const storeTheme = (mode) => {
    localStorage.setItem(
      THEME_KEY,
      JSON.stringify({ version: THEME_VERSION, mode })
    );
  };

  const applyTheme = (mode) => {
    if (mode === "auto") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", mode);
    }
    if (themeToggle) {
      const isDark = mode === "dark" || (mode === "auto" && mediaQuery.matches);
      themeToggle.setAttribute(
        "aria-label",
        isDark ? "Włącz jasny motyw" : "Włącz ciemny motyw"
      );
      themeToggle.dataset.theme = isDark ? "dark" : "light";
    }
  };

  let themeState = getStoredTheme();
  applyTheme(themeState.mode);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const nextMode =
        themeState.mode === "dark" ? "light" : "dark";
      themeState = { version: THEME_VERSION, mode: nextMode };
      storeTheme(nextMode);
      applyTheme(nextMode);
    });
  }

  if (themeAuto) {
    themeAuto.addEventListener("click", () => {
      themeState = { version: THEME_VERSION, mode: "auto" };
      storeTheme("auto");
      applyTheme("auto");
    });
  }

  mediaQuery.addEventListener("change", () => {
    if (themeState.mode === "auto") {
      applyTheme("auto");
    }
  });

  const header = document.querySelector("[data-site-header]");
  let lastScroll = 0;
  let ticking = false;

  const onScroll = () => {
    lastScroll = window.scrollY;
    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (header) {
          header.classList.toggle("site-header--compact", lastScroll > 40);
        }
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });

  const menuButton = document.querySelector("[data-menu-button]");
  const menuPanel = document.querySelector("[data-menu-panel]");
  let lastFocused = null;
  const desktopQuery = window.matchMedia("(min-width: 760px)");

  const closeMenu = () => {
    if (!menuPanel || !menuButton) return;
    menuPanel.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-menu-open");
    if (!desktopQuery.matches) {
      menuPanel.setAttribute("aria-hidden", "true");
    }
    if (lastFocused) lastFocused.focus();
  };

  const openMenu = () => {
    if (!menuPanel || !menuButton) return;
    lastFocused = document.activeElement;
    menuPanel.classList.add("is-open");
    menuButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("is-menu-open");
    menuPanel.setAttribute("aria-hidden", "false");
    const focusables = menuPanel.querySelectorAll(
      "a, button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    if (focusables.length) focusables[0].focus();
  };

  if (menuButton && menuPanel) {
    const syncMenuState = () => {
      if (desktopQuery.matches) {
        menuPanel.classList.remove("is-open");
        menuPanel.setAttribute("aria-hidden", "false");
        document.body.classList.remove("is-menu-open");
        menuButton.setAttribute("aria-expanded", "false");
      } else if (!menuPanel.classList.contains("is-open")) {
        menuPanel.setAttribute("aria-hidden", "true");
      }
    };

    syncMenuState();
    desktopQuery.addEventListener("change", syncMenuState);

    menuButton.addEventListener("click", () => {
      if (menuPanel.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuPanel.classList.contains("is-open")) {
        closeMenu();
      }
      if (event.key === "Tab" && menuPanel.classList.contains("is-open")) {
        const focusables = Array.from(
          menuPanel.querySelectorAll(
            "a, button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
          )
        );
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

    document.addEventListener("click", (event) => {
      if (
        menuPanel.classList.contains("is-open") &&
        !menuPanel.contains(event.target) &&
        !menuButton.contains(event.target)
      ) {
        closeMenu();
      }
    });
  }

  const revealItems = document.querySelectorAll("[data-reveal]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (revealItems.length) {
    if (reduceMotion.matches) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2 }
      );
      revealItems.forEach((item) => observer.observe(item));
    }
  }

  document.querySelectorAll("[data-accordion]").forEach((accordion) => {
    accordion.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-accordion-trigger]");
      if (!trigger) return;
      const panelId = trigger.getAttribute("aria-controls");
      const panel = document.getElementById(panelId);
      const isExpanded = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!isExpanded));
      if (panel) {
        panel.hidden = isExpanded;
      }
    });
  });

  const pricingFilter = document.querySelector("[data-pricing-filter]");
  if (pricingFilter) {
    pricingFilter.addEventListener("change", (event) => {
      const value = event.target.value;
      document.querySelectorAll("[data-pricing-card]").forEach((card) => {
        const category = card.dataset.category;
        const shouldShow = value === "all" || value === category;
        card.classList.toggle("is-hidden", !shouldShow);
      });
    });
  }

  document.querySelectorAll("[data-details-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const panelId = button.getAttribute("aria-controls");
      const panel = document.getElementById(panelId);
      if (!panel) return;
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!isExpanded));
      panel.hidden = isExpanded;
      button.textContent = isExpanded
        ? "Pokaż szczegóły"
        : "Ukryj szczegóły";
    });
  });

  const contactButtons = document.querySelectorAll("[data-contact-method]");
  const contactInput = document.querySelector("[data-contact-input]");
  if (contactButtons.length && contactInput) {
    contactButtons.forEach((button) => {
      button.addEventListener("click", () => {
        contactButtons.forEach((btn) => btn.setAttribute("aria-pressed", "false"));
        button.setAttribute("aria-pressed", "true");
        contactInput.value = button.dataset.contactMethod;
      });
    });
  }

  const form = document.querySelector("[data-validate-form]");
  if (form) {
    const success = form.querySelector("[data-form-success]");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (success) {
        success.hidden = true;
      }
      let hasError = false;
      const fields = form.querySelectorAll("[data-required]");
      fields.forEach((field) => {
        const errorId = field.getAttribute("aria-describedby");
        const errorEl = errorId ? document.getElementById(errorId) : null;
        if (!field.value.trim()) {
          hasError = true;
          field.setAttribute("aria-invalid", "true");
          if (errorEl) {
            errorEl.textContent = "To pole jest wymagane.";
          }
        } else {
          field.removeAttribute("aria-invalid");
          if (errorEl) {
            errorEl.textContent = "";
          }
        }
      });
      if (!hasError && success) {
        success.hidden = false;
        success.focus();
        form.reset();
      }
    });
  }

  const backToTop = document.querySelector("[data-back-to-top]");
  if (backToTop) {
    window.addEventListener("scroll", () => {
      backToTop.classList.toggle("is-visible", window.scrollY > 500);
    });
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
    });
  }
})();
