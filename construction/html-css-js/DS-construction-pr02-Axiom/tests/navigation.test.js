// EXTRA-03 — focused coverage for js/components/navigation.js.
//
// The suite drives the real module through a minimal copy of the production
// header markup and asserts observable mobile and breakpoint state.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initNavigation } from "../js/components/navigation.js";

const NAVIGATION_FIXTURE = `
  <header class="site-header">
    <div class="header__inner">
      <nav id="primaryNav" class="site-nav" aria-label="Nawigacja główna">
        <ul class="site-nav__list">
          <li class="site-nav__item"><a class="site-nav__link" href="#o-nas">O nas</a></li>
          <li class="site-nav__item"><a class="site-nav__link" href="#kontakt">Kontakt</a></li>
        </ul>
      </nav>
      <button id="nav-toggle" type="button" class="nav-toggle" aria-label="Otwórz menu" aria-controls="primaryNav" aria-haspopup="true" aria-expanded="false">
        Menu
      </button>
    </div>
  </header>
  <button id="outsideControl" type="button">Poza nawigacją</button>
`;

const trackedGlobalListeners = [];
const documentAddEventListener = document.addEventListener.bind(document);
const windowAddEventListener = globalThis.window.addEventListener.bind(globalThis.window);

let mediaQuery;

const createMediaQuery = (initialMatches) => {
  const listeners = new Set();

  return {
    matches: initialMatches,
    media: "(max-width: 899px)",
    onchange: null,
    addEventListener(type, listener) {
      if (type === "change") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "change") listeners.delete(listener);
    },
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
    dispatchEvent(event) {
      listeners.forEach((listener) => listener(event));
      return true;
    },
    setMatches(matches) {
      this.matches = matches;
      this.dispatchEvent({ matches, media: this.media });
    },
    clearListeners() {
      listeners.clear();
    },
  };
};

const mountNavigation = ({ mobile = true } = {}) => {
  document.body.className = "";
  document.body.innerHTML = NAVIGATION_FIXTURE;
  mediaQuery = createMediaQuery(mobile);
  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

  vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
    trackedGlobalListeners.push([document, type, listener, options]);
    documentAddEventListener(type, listener, options);
  });
  vi.spyOn(globalThis.window, "addEventListener").mockImplementation((type, listener, options) => {
    trackedGlobalListeners.push([globalThis.window, type, listener, options]);
    windowAddEventListener(type, listener, options);
  });

  initNavigation();

  return {
    button: document.querySelector("#nav-toggle"),
    nav: document.querySelector("#primaryNav"),
    firstLink: document.querySelector(".site-nav__link"),
  };
};

const openNavigation = () => {
  const button = document.querySelector("#nav-toggle");
  button.focus();
  button.click();
};

const pressEscape = () => {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  document.activeElement.dispatchEvent(event);
};

beforeEach(() => {
  document.body.className = "";
  document.body.innerHTML = "";
  document.documentElement.style.removeProperty("--mobile-nav-top");
  document.documentElement.style.removeProperty("--mobile-nav-max-height");
});

afterEach(() => {
  while (trackedGlobalListeners.length) {
    const [target, type, listener, options] = trackedGlobalListeners.pop();
    target.removeEventListener(type, listener, options);
  }
  mediaQuery?.clearListeners();
  mediaQuery = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.className = "";
  document.body.innerHTML = "";
  document.documentElement.style.removeProperty("--mobile-nav-top");
  document.documentElement.style.removeProperty("--mobile-nav-max-height");
});

describe("mobile navigation state", () => {
  it("initialises collapsed with hidden and inert navigation", () => {
    const { button, nav } = mountNavigation();

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Otwórz menu");
    expect(button.classList.contains("active")).toBe(false);
    expect(nav.classList.contains("mobile-open")).toBe(false);
    expect(nav.getAttribute("aria-hidden")).toBe("true");
    expect(nav.hasAttribute("inert")).toBe(true);
    expect(document.body.classList.contains("nav-open")).toBe(false);
  });

  it("opens through the toggle and moves focus to the first link", () => {
    const { button, nav, firstLink } = mountNavigation();

    openNavigation();

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Zamknij menu");
    expect(button.classList.contains("active")).toBe(true);
    expect(nav.classList.contains("mobile-open")).toBe(true);
    expect(nav.getAttribute("aria-hidden")).toBe("false");
    expect(nav.hasAttribute("inert")).toBe(false);
    expect(document.body.classList.contains("nav-open")).toBe(true);
    expect(document.activeElement).toBe(firstLink);
  });

  it("closes through the toggle and returns focus to it", () => {
    const { button, nav } = mountNavigation();
    openNavigation();

    button.click();

    expect(nav.classList.contains("mobile-open")).toBe(false);
    expect(nav.getAttribute("aria-hidden")).toBe("true");
    expect(nav.hasAttribute("inert")).toBe(true);
    expect(document.body.classList.contains("nav-open")).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it("closes with Escape and returns focus to the toggle", () => {
    const { button, nav } = mountNavigation();
    openNavigation();

    pressEscape();

    expect(nav.classList.contains("mobile-open")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("closes when a navigation link is activated", () => {
    const { button, nav, firstLink } = mountNavigation();
    openNavigation();

    firstLink.click();

    expect(nav.classList.contains("mobile-open")).toBe(false);
    expect(document.body.classList.contains("nav-open")).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it("closes on a pointer interaction outside the navigation", () => {
    const { button, nav } = mountNavigation();
    openNavigation();

    document.querySelector("#outsideControl").dispatchEvent(new Event("pointerdown", { bubbles: true }));

    expect(nav.classList.contains("mobile-open")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });
});

describe("navigation breakpoint synchronisation", () => {
  it("resets an open mobile menu to the visible desktop state", () => {
    const { button, nav } = mountNavigation();
    openNavigation();

    mediaQuery.setMatches(false);

    expect(nav.classList.contains("mobile-open")).toBe(false);
    expect(nav.getAttribute("aria-hidden")).toBe("false");
    expect(nav.hasAttribute("inert")).toBe(false);
    expect(button.classList.contains("active")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Otwórz menu");
    expect(document.body.classList.contains("nav-open")).toBe(false);
  });
});
