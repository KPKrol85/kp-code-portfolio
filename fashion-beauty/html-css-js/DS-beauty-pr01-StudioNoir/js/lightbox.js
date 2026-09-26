export const initLightbox = () => {
  const root = document.querySelector("[data-lightbox-root]");
  const image = document.querySelector("[data-lightbox-image]");
  const dialog = root?.querySelector('[role="dialog"]');
  const closeButton = root?.querySelector("[data-lightbox-close]");
  const triggers = document.querySelectorAll("[data-lightbox]");
  if (!root || !image || !dialog || !triggers.length) return;

  let lastTrigger = null;

  const getFocusableElements = () => {
    const selector =
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    return [...dialog.querySelectorAll(selector)].filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.hasAttribute("disabled")) return false;
      return !element.hasAttribute("aria-hidden");
    });
  };

  const focusDialog = () => {
    if (closeButton instanceof HTMLElement) {
      closeButton.focus();
      return;
    }

    const [firstFocusable] = getFocusableElements();
    if (firstFocusable instanceof HTMLElement) {
      firstFocusable.focus();
    }
  };

  const open = (src, alt) => {
    const activeElement = document.activeElement;
    lastTrigger = activeElement instanceof HTMLElement ? activeElement : null;

    image.src = src;
    image.alt = alt || "Podgląd zdjęcia";
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    focusDialog();
  };

  const close = () => {
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    image.src = "";
    document.body.style.overflow = "";

    if (lastTrigger && document.contains(lastTrigger)) {
      lastTrigger.focus();
    }
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const src = trigger.getAttribute("data-lightbox");
      const img = trigger.querySelector("img");
      open(src, img?.alt);
    });
  });

  root.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-lightbox-close")) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!root.classList.contains("is-open")) return;

    if (event.key === "Escape") {
      close();
      return;
    }

    if (event.key !== "Tab") return;

    const focusableElements = getFocusableElements();
    if (!focusableElements.length) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  });
};
