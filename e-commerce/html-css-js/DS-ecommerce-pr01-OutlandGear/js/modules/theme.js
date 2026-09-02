import { on, qs, qsa } from "./dom.js";

const STORAGE_KEY = "outlandgear-theme";
const DARK_THEME = "dark";
const LIGHT_THEME = "light";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

let themeInitialized = false;

const isValidTheme = (value) => value === LIGHT_THEME || value === DARK_THEME;

const readStoredTheme = () => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isValidTheme(value) ? value : "";
  } catch {
    return "";
  }
};

const writeStoredTheme = (theme) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
};

const getSystemTheme = () =>
  window.matchMedia?.(MEDIA_QUERY).matches ? DARK_THEME : LIGHT_THEME;

const applyTheme = (theme) => {
  const nextTheme = isValidTheme(theme) ? theme : LIGHT_THEME;
  document.documentElement.dataset.theme = nextTheme;
  return nextTheme;
};

const getToggleState = (theme) => {
  const isDark = theme === DARK_THEME;
  return {
    isDark,
    label: isDark ? "Ciemny" : "Jasny",
    ariaLabel: isDark ? "Przełącz na jasny motyw" : "Przełącz na ciemny motyw",
  };
};

const syncThemeToggles = (theme) => {
  const state = getToggleState(theme);
  qsa("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(state.isDark));
    button.setAttribute("aria-label", state.ariaLabel);
    button.dataset.themeActive = theme;

    const status = qs("[data-theme-toggle-status]", button);
    if (status) {
      status.textContent = state.label;
    }
  });
};

const resolveInitialTheme = () => readStoredTheme() || getSystemTheme();

const setTheme = (theme, options = {}) => {
  const nextTheme = applyTheme(theme);
  if (options.persist) {
    writeStoredTheme(nextTheme);
  }
  syncThemeToggles(nextTheme);
  return nextTheme;
};

const setupThemeToggle = () => {
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const toggle = target.closest("[data-theme-toggle]");
    if (!(toggle instanceof HTMLButtonElement)) return;

    const currentTheme =
      document.documentElement.dataset.theme === DARK_THEME ? DARK_THEME : LIGHT_THEME;
    const nextTheme = currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
    setTheme(nextTheme, { persist: true });
  });
};

const setupSystemThemeSync = () => {
  const mediaQuery = window.matchMedia?.(MEDIA_QUERY);
  if (!mediaQuery) return;

  on(mediaQuery, "change", (event) => {
    if (readStoredTheme()) return;
    setTheme(event.matches ? DARK_THEME : LIGHT_THEME);
  });
};

export const initTheme = () => {
  const currentTheme = document.documentElement.dataset.theme || resolveInitialTheme();

  if (themeInitialized) {
    syncThemeToggles(currentTheme);
    return;
  }

  themeInitialized = true;
  setTheme(currentTheme);
  setupThemeToggle();
  setupSystemThemeSync();
};
