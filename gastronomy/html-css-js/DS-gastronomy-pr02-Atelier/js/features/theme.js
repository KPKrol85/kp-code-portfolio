import { q } from "../core/dom.js";

var THEME_STORAGE_KEY = "kp-theme";
var metaTheme = null;
var systemPreference = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
var hasStoredPreference = false;

function getStoredTheme() {
  try {
    var value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch (err) {
    return null;
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    hasStoredPreference = true;
  } catch (err) {}
}

function updateMetaTheme(theme) {
  if (!metaTheme) {
    metaTheme = document.querySelector('meta[name="theme-color"]');
  }
  if (metaTheme) {
    metaTheme.setAttribute("content", theme === "dark" ? "#181210" : "#f8f1e7");
  }
}

function syncToggleVisuals(theme) {
  var toggle = q(".theme-toggle");
  if (!toggle) return;
  var isDark = theme === "dark";
  toggle.setAttribute("aria-pressed", String(isDark));
  var message = isDark ? "Przełącz na tryb jasny" : "Przełącz na tryb ciemny";
  toggle.setAttribute("aria-label", message);
  var hiddenLabel = toggle.querySelector(".visually-hidden");
  hiddenLabel && (hiddenLabel.textContent = message);
}

function emitThemeChange(theme) {
  if (typeof window === "undefined" || typeof window.CustomEvent !== "function") return;
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme } }));
}

function applyTheme(theme, options) {
  options = options || {};
  var nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", nextTheme);
  syncToggleVisuals(nextTheme);
  updateMetaTheme(nextTheme);
  if (options.persist) {
    persistTheme(nextTheme);
  }
  if (!options.silent) {
    emitThemeChange(nextTheme);
  }
}

export function initThemeToggle() {
  var toggle = q(".theme-toggle");
  if (!toggle) return;
  var storedTheme = getStoredTheme();
  if (storedTheme) {
    hasStoredPreference = true;
  }
  var initial = storedTheme || document.documentElement.getAttribute("data-theme");
  if (!initial && systemPreference && typeof systemPreference.matches === "boolean") {
    initial = systemPreference.matches ? "dark" : "light";
  }
  applyTheme(initial || "light", { silent: true });
  toggle.addEventListener("click", function () {
    var current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next, { persist: true });
  });
  if (systemPreference) {
    var handleSystemChange = function (event) {
      if (hasStoredPreference) return;
      applyTheme(event.matches ? "dark" : "light");
    };
    if (typeof systemPreference.addEventListener === "function") {
      systemPreference.addEventListener("change", handleSystemChange);
    } else if (typeof systemPreference.addListener === "function") {
      systemPreference.addListener(handleSystemChange);
    }
  }
}

if (typeof window !== "undefined") {
  window.initThemeToggle = initThemeToggle;
}
