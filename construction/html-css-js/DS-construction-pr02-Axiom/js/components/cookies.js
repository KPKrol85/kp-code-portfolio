import { COOKIE_BANNER, SELECTORS } from "../core/config.js";
import { qs } from "../utils/dom.js";
import { safeGetItem, safeSetItem } from "../utils/storage.js";

export const initCookieBanner = () => {
  const banner = qs(SELECTORS.cookieBanner);
  if (!banner) return;

  const stored = safeGetItem(COOKIE_BANNER.storageKey);
  if (stored) {
    banner.remove();
    return;
  }

  const acceptButton = banner.querySelector("#cookieAccept");
  const modalContent = banner.querySelector(".project-modal__content");
  const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousBodyOverflow = document.body.style.overflow;

  banner.hidden = false;

  document.body.style.overflow = "hidden";

  function save(val) {
    safeSetItem(COOKIE_BANNER.storageKey, JSON.stringify({ v: 1, value: val, ts: Date.now() }));
    document.cookie = `${COOKIE_BANNER.cookieName}=${val}; max-age=${COOKIE_BANNER.cookieMaxAge}; path=/; SameSite=Lax`;
    document.body.style.overflow = previousBodyOverflow;
    banner.remove();

    if (previousActiveElement && previousActiveElement.isConnected) {
      previousActiveElement.focus();
    }
  }

  function trapFocus(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = banner.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  banner.addEventListener("keydown", trapFocus);

  requestAnimationFrame(() => {
    (acceptButton || modalContent)?.focus();
  });

  banner.addEventListener("click", (e) => {
    if (e.target.closest("#cookieAccept")) save("accepted");
  });
};
