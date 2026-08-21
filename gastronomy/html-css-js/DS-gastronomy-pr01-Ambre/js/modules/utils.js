export const DEBUG = false;

export const log = (...args) => {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(...args);
};

export const reportError = (error, context = "UNKNOWN") => {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.error(`[AMBRE_INIT_ERROR] ${context}`, error);
};

export const byTestId = (id, root = document) => root.querySelector(`[data-testid="${id}"]`);

export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const getFocusable = (root) => {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll(
      "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])",
    ),
  ).filter(
    (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true",
  );
};

export function initHelpers() {
  document.documentElement.classList.remove("no-js");

  if (document.body) {
    document.body.classList.remove("no-js");
  } else {
    window.addEventListener(
      "DOMContentLoaded",
      () => {
        if (document.body) {
          document.body.classList.remove("no-js");
        }
      },
      { once: true },
    );
  }

  log("Helpers initialized");
}
