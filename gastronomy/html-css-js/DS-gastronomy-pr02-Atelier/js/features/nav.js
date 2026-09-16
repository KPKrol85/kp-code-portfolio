import { q } from "../core/dom.js";

var root = document.documentElement;
var scrollLockY = 0;
var scrollLockActive = false;
var headerOffsetRaf = null;

function isNavMobile() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 1023px)").matches : false;
}

function syncNavA11y(nav, expanded) {
  if (!nav) return;
  /*
   On desktop the nav stays in the normal tab order.
   On mobile, aria-hidden/inert tracks drawer state to prevent focus leakage.
  */
  if (!isNavMobile()) {
    nav.removeAttribute("aria-hidden");
    nav.removeAttribute("inert");
    return;
  }
  nav.setAttribute("aria-hidden", String(!expanded));
  if (expanded) {
    nav.removeAttribute("inert");
  } else {
    try {
      nav.setAttribute("inert", "");
    } catch (err) {}
  }
}

function closeNavDropdowns(scope) {
  var rootEl = scope || document;
  var openItems = rootEl.querySelectorAll(".nav__item--dropdown.is-open");
  openItems.forEach(function (item) {
    item.classList.remove("is-open");
    var toggle = item.querySelector(".nav__dropdown-toggle");
    toggle && toggle.setAttribute("aria-expanded", "false");
  });
}

function lockScroll() {
  if (scrollLockActive) return;
  scrollLockActive = true;
  /*
   Lock body scroll without visual jump by preserving current Y offset.
   Scrollbar compensation avoids horizontal layout shift when the drawer opens.
  */
  scrollLockY = window.scrollY || window.pageYOffset || 0;
  var scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.position = "fixed";
  document.body.style.top = "-" + scrollLockY + "px";
  document.body.style.width = "100%";
  if (scrollbarGap > 0) {
    document.body.style.paddingRight = scrollbarGap + "px";
  }
  root.classList.add("nav-open");
}

function unlockScroll() {
  if (!scrollLockActive) return;
  scrollLockActive = false;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  document.body.style.paddingRight = "";
  root.classList.remove("nav-open");
  window.scrollTo(0, scrollLockY);
}

function setMenuAria(button, expanded) {
  button.setAttribute("aria-expanded", String(expanded));
  var nav = q("#primary-nav");
  if (nav) {
    nav.setAttribute("data-open", String(expanded));
    syncNavA11y(nav, expanded);
  }
}

function updateHeaderOffset() {
  var header = q(".site-header");
  if (!header) return;
  var height = header.getBoundingClientRect().height;
  if (!height) return;
  root.style.setProperty("--header-offset", Math.round(height) + "px");
}

function scheduleHeaderOffsetUpdate() {
  if (headerOffsetRaf) return;
  headerOffsetRaf = window.requestAnimationFrame(function () {
    headerOffsetRaf = null;
    updateHeaderOffset();
  });
}

export function initNav() {
  var navToggle = q(".nav-toggle");
  var nav = q("#primary-nav");
  var dropdownToggles = nav ? nav.querySelectorAll(".nav__dropdown-toggle") : [];
  var isMenuOpen = navToggle && navToggle.getAttribute("aria-expanded") === "true";
  var outsideHandler = null;
  var trapHandler = null;

  function getMenuOpen() {
    return navToggle && navToggle.getAttribute("aria-expanded") === "true";
  }

  function getFocusableInNav() {
    if (!nav) return [];
    var selectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(nav.querySelectorAll(selectors)).filter(function (el) {
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    });
  }

  function focusFirstInNav() {
    var focusables = getFocusableInNav();
    if (focusables.length) {
      focusables[0].focus();
    } else if (nav) {
      nav.focus && nav.focus();
    }
  }

  function attachOutsideListener() {
    if (outsideHandler) return;
    /*
     Capture pointerdown early so outside taps close the drawer consistently
     before nested handlers can stop propagation.
    */
    outsideHandler = function (event) {
      if (!getMenuOpen()) return;
      var target = event.target;
      if (!target) return;
      if (nav && nav.contains(target)) return;
      if (navToggle && navToggle.contains(target)) return;
      setMenuState(false);
    };
    document.addEventListener("pointerdown", outsideHandler, true);
  }

  function detachOutsideListener() {
    if (!outsideHandler) return;
    document.removeEventListener("pointerdown", outsideHandler, true);
    outsideHandler = null;
  }

  function attachFocusTrap() {
    if (trapHandler) return;
    /*
     Keep keyboard focus inside the mobile drawer while it is open.
     This preserves a predictable tab sequence for keyboard/screen-reader users.
    */
    trapHandler = function (event) {
      if (!getMenuOpen()) return;
      if (event.key !== "Tab") return;
      var focusables = getFocusableInNav();
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", trapHandler);
  }

  function detachFocusTrap() {
    if (!trapHandler) return;
    document.removeEventListener("keydown", trapHandler);
    trapHandler = null;
  }

  function setMenuState(open, options) {
    if (!navToggle || !nav) return;
    /*
     Single state transition point for drawer lifecycle:
     ARIA flags, scroll lock, focus trap, outside click, and focus restore.
    */
    if (!isNavMobile()) {
      setMenuAria(navToggle, false);
      isMenuOpen = false;
      detachOutsideListener();
      detachFocusTrap();
      unlockScroll();
      closeNavDropdowns(nav);
      return;
    }
    if (open == isMenuOpen) return;
    isMenuOpen = open;
    setMenuAria(navToggle, open);
    navToggle.setAttribute("aria-label", open ? "Zamknij menu" : "Otwórz menu");
    if (open) {
      lockScroll();
      attachOutsideListener();
      attachFocusTrap();
      focusFirstInNav();
    } else {
      detachOutsideListener();
      detachFocusTrap();
      unlockScroll();
      closeNavDropdowns(nav);
      if (!options || !options.skipFocus) {
        navToggle.focus();
      }
    }
  }

  navToggle &&
    navToggle.addEventListener("click", function () {
      setMenuState(!getMenuOpen());
      scheduleHeaderOffsetUpdate();
    });

  if (nav) {
    syncNavA11y(nav, navToggle && navToggle.getAttribute("aria-expanded") === "true");
    dropdownToggles.forEach(function (toggle) {
      toggle.addEventListener("click", function (event) {
        if (!isNavMobile()) return;
        /* Mobile dropdowns behave like an accordion: one expanded item at a time. */
        event.preventDefault();
        event.stopPropagation();
        var item = toggle.closest(".nav__item--dropdown");
        if (!item) return;
        var isOpen = item.classList.contains("is-open");
        closeNavDropdowns(nav);
        if (!isOpen) {
          item.classList.add("is-open");
          toggle.setAttribute("aria-expanded", "true");
        }
      });
    });
    nav.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link || !isNavMobile()) return;
      if (getMenuOpen()) {
        setMenuState(false, { skipFocus: true });
      }
    });
    window.addEventListener("resize", function () {
      /*
       Resize can move across mobile/desktop breakpoints.
       Normalize nav state so hidden mobile-only state does not persist on desktop.
      */
      syncNavA11y(nav, navToggle && navToggle.getAttribute("aria-expanded") === "true");
      if (!isNavMobile()) {
        closeNavDropdowns(nav);
        if (getMenuOpen()) {
          setMenuState(false, { skipFocus: true });
        } else {
          unlockScroll();
          detachOutsideListener();
          detachFocusTrap();
        }
      }
      scheduleHeaderOffsetUpdate();
    });
  }

  document.addEventListener("keyup", function (event) {
    if (event.key !== "Escape") return;
    /*
     Escape closes the highest-priority nav surface first:
     drawer if open, otherwise any expanded dropdown.
    */
    if (getMenuOpen()) {
      setMenuState(false);
      return;
    }
    closeNavDropdowns(nav);
  });

  updateHeaderOffset();
  var header = q(".site-header");
  if (header) {
    var isTicking = false;
    var lastState = null;
    /*
     Scroll-driven header state is rAF-throttled to avoid layout thrash,
     and header offset is recomputed when size/transition changes.
    */
    var updateHeader = function () {
      var shouldShrink = window.scrollY > 8;
      if (shouldShrink !== lastState) {
        header.classList.toggle("is-scrolled", shouldShrink);
        lastState = shouldShrink;
      }
      scheduleHeaderOffsetUpdate();
      isTicking = false;
    };
    var onScroll = function () {
      if (isTicking) return;
      isTicking = true;
      window.requestAnimationFrame(updateHeader);
    };

    if (typeof window.ResizeObserver === "function") {
      new window.ResizeObserver(function () {
        scheduleHeaderOffsetUpdate();
      }).observe(header);
    } else {
      header.addEventListener("transitionend", function (event) {
        if (!event || !event.target) return;
        if (!(event.target === header || header.contains(event.target))) return;
        scheduleHeaderOffsetUpdate();
      });
    }

    updateHeader();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
}
