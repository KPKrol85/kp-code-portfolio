import { CONFIG } from "../config.js";

const defaultCart = () => ({ version: CONFIG.storageVersion, items: [] });

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

let storageIssue = null;

const setStorageIssue = (error) => {
  storageIssue = error || null;
};

const withStorageGuard = (operation, fallbackValue) => {
  try {
    const result = operation();
    setStorageIssue(null);
    return result;
  } catch (error) {
    console.error("Storage error", error);
    setStorageIssue(error);
    return fallbackValue;
  }
};

export const getStorageStatus = () => ({
  available: !storageIssue,
  message: storageIssue ? "Nie możemy zapisać zmian w koszyku w tej przeglądarce." : "",
});

export const loadCart = () => {
  const parsed = withStorageGuard(
    () => safeParse(localStorage.getItem(CONFIG.storageKey), null),
    null,
  );
  if (!parsed || parsed.version !== CONFIG.storageVersion) {
    return defaultCart();
  }
  return parsed;
};

export const saveCart = (cart) =>
  withStorageGuard(() => {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(cart));
    return true;
  }, false);

export const clearCart = () =>
  withStorageGuard(() => {
    localStorage.removeItem(CONFIG.storageKey);
    return true;
  }, false);
