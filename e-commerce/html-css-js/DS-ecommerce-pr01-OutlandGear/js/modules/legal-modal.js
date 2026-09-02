import { qs, qsa, on } from "./dom.js";

const STORAGE_KEY = "outlandGearLegalAcceptedAt";
const SESSION_STORAGE_KEY = "outlandGearLegalAcceptedSession";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const getFocusableElements = (scope) => qsa(FOCUSABLE_SELECTOR, scope);

const readStorageFlag = (storage, key) => {
  try {
    return Boolean(storage?.getItem(key));
  } catch {
    return false;
  }
};

const writeStorageFlag = (storage, key, value) => {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const initLegalModal = () => {
  const modal = qs("#outland-legal-modal");
  if (!modal) return;

  const panel = qs("[data-legal-modal-panel]", modal);
  const openTriggers = qsa("[data-legal-open]");
  const acceptButton = qs("[data-legal-accept]", modal);

  if (!panel || !acceptButton) return;

  let lastFocusedElement = null;

  const lockScroll = () => {
    document.body.style.overflow = "hidden";
  };

  const unlockScroll = () => {
    document.body.style.overflow = "";
  };

  const setModalVisibility = (isVisible) => {
    modal.hidden = !isVisible;
    modal.setAttribute("aria-hidden", String(!isVisible));
  };

  const openModal = () => {
    if (modal.getAttribute("aria-hidden") === "false") return;
    lastFocusedElement = document.activeElement;
    setModalVisibility(true);
    lockScroll();

    const [firstFocusable] = getFocusableElements(panel);
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      panel.focus();
    }
  };

  const acceptAndClose = () => {
    const acceptedAt = new Date().toISOString();
    const persisted = writeStorageFlag(window.localStorage, STORAGE_KEY, acceptedAt);
    if (!persisted) {
      writeStorageFlag(window.sessionStorage, SESSION_STORAGE_KEY, acceptedAt);
    }

    setModalVisibility(false);
    unlockScroll();

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  };

  const trapFocus = (event) => {
    if (event.key !== "Tab") return;

    const focusable = getFocusableElements(panel);
    if (!focusable.length) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  openTriggers.forEach((trigger) => {
    on(trigger, "click", (event) => {
      event.preventDefault();
      openModal();
    });
  });

  on(acceptButton, "click", acceptAndClose);
  on(modal, "keydown", trapFocus);

  const alreadyAccepted =
    readStorageFlag(window.localStorage, STORAGE_KEY) ||
    readStorageFlag(window.sessionStorage, SESSION_STORAGE_KEY);

  const shouldAutoOpen = modal.dataset.legalAutoOpen === "true";

  if (shouldAutoOpen && !alreadyAccepted) {
    window.setTimeout(openModal, 700);
  }
};
