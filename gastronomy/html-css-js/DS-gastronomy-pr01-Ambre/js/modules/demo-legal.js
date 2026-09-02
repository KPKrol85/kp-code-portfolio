import { log } from "./utils.js";

const ACCEPTED_KEY = "demoLegalAccepted";
const FOCUSABLE_SELECTOR = [
  "a[href]:not([tabindex='-1'])",
  "area[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled]):not([type='hidden']):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "[contenteditable='true']:not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function initDemoLegalModal() {
  const modal = document.getElementById("demo-legal-modal");
  if (!modal) return;

  const panel = modal.querySelector(".demo-legal-modal__panel");
  if (!panel) return;

  const acceptBtn = modal.querySelector("[data-demo-legal-accept]");
  const closeTriggers = modal.querySelectorAll("[data-demo-legal-close]");
  const backgroundInertState = new Map();
  let previouslyFocused = null;
  let isOpen = false;

  const getFocusable = () =>
    Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (element) => !element.closest("[inert]") && element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0
    );

  const setBackgroundInert = (shouldBeInert) => {
    if (shouldBeInert) {
      backgroundInertState.clear();
      Array.from(document.body.children).forEach((element) => {
        if (element === modal) return;
        backgroundInertState.set(element, element.hasAttribute("inert"));
        element.setAttribute("inert", "");
      });
      return;
    }

    backgroundInertState.forEach((wasInert, element) => {
      if (!element.isConnected) return;
      if (wasInert) element.setAttribute("inert", "");
      else element.removeAttribute("inert");
    });
    backgroundInertState.clear();
  };

  const focusWithoutScroll = (element) => {
    if (!element || typeof element.focus !== "function") return;
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  };

  const restoreFocus = () => {
    const previousIsAvailable =
      previouslyFocused?.isConnected && !previouslyFocused.closest("[inert]") && !previouslyFocused.hasAttribute("disabled") && !previouslyFocused.hasAttribute("hidden");
    const target = previousIsAvailable ? previouslyFocused : document.getElementById("main");
    previouslyFocused = null;
    if (!target) return;

    const previousTabindex = target.getAttribute("tabindex");
    const usesTemporaryTabindex = previousTabindex === null && !target.matches(FOCUSABLE_SELECTOR);
    if (usesTemporaryTabindex) target.setAttribute("tabindex", "-1");
    focusWithoutScroll(target);
    if (usesTemporaryTabindex) {
      if (document.activeElement === target) {
        target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
      } else {
        target.removeAttribute("tabindex");
      }
    }
  };

  const close = () => {
    const wasOpen = isOpen;
    isOpen = false;
    document.removeEventListener("keydown", handleKeydown);
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("inert", "");
    modal.setAttribute("hidden", "");
    setBackgroundInert(false);
    if (wasOpen) restoreFocus();
  };

  const handleKeydown = (event) => {
    if (!isOpen) return;

    if (event.key === "Escape") {
      close();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = getFocusable();
    if (!focusable.length) {
      event.preventDefault();
      focusWithoutScroll(panel);
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeIndex = focusable.indexOf(document.activeElement);

    if (focusable.length === 1) {
      event.preventDefault();
      focusWithoutScroll(first);
      return;
    }

    if (activeIndex === -1) {
      event.preventDefault();
      focusWithoutScroll(event.shiftKey ? last : first);
      return;
    }

    if (event.shiftKey && activeIndex === 0) {
      event.preventDefault();
      focusWithoutScroll(last);
      return;
    }

    if (!event.shiftKey && activeIndex === focusable.length - 1) {
      event.preventDefault();
      focusWithoutScroll(first);
    }
  };

  const open = () => {
    if (isOpen) return;
    const active = document.activeElement;
    previouslyFocused = active && active !== document.body && active !== document.documentElement && !modal.contains(active) ? active : null;
    isOpen = true;
    modal.removeAttribute("hidden");
    modal.removeAttribute("inert");
    modal.setAttribute("aria-hidden", "false");
    setBackgroundInert(true);
    focusWithoutScroll(panel);
    document.addEventListener("keydown", handleKeydown);
  };

  const handleAccept = () => {
    localStorage.setItem(ACCEPTED_KEY, "true");
    close();
  };

  if (localStorage.getItem(ACCEPTED_KEY) === "true") {
    close();
    return;
  }

  open();

  acceptBtn?.addEventListener("click", handleAccept);
  closeTriggers.forEach((trigger) => {
    trigger.addEventListener("click", close);
  });

  log();
}
