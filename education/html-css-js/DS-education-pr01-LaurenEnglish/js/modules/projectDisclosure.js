import { readStoredValue, writeStoredValue } from "../state/browserStorage.js";

const focusableSelectors =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const normalizeRuntimePath = (path) => (path === "/" ? "/index.html" : path);

const getDisclosureConfiguration = (dialog) => ({
  enabled: dialog.dataset.projectDisclosureEnabled === "true",
  eligiblePaths: (dialog.dataset.projectDisclosureRoutes ?? "")
    .split(/\s+/u)
    .filter(Boolean),
  storageKey: dialog.dataset.projectDisclosureStorageKey ?? "",
  version: dialog.dataset.projectDisclosureVersion ?? "",
});

export const initProjectDisclosure = () => {
  const dialog = document.querySelector("[data-project-disclosure]");
  const dismissButton = dialog?.querySelector(
    "[data-project-disclosure-dismiss]",
  );
  if (!(dialog instanceof HTMLDialogElement) || !dismissButton) return;

  const { enabled, eligiblePaths, storageKey, version } =
    getDisclosureConfiguration(dialog);
  const currentPath = normalizeRuntimePath(location.pathname);
  const isEligible = eligiblePaths.includes(currentPath);
  if (
    !enabled ||
    !isEligible ||
    !storageKey ||
    !version ||
    typeof dialog.showModal !== "function"
  ) {
    return;
  }

  const root = document.documentElement;
  const getFocusableElements = () =>
    Array.from(dialog.querySelectorAll(focusableSelectors)).filter(
      (element) =>
        element instanceof HTMLElement &&
        element.offsetParent !== null &&
        !element.closest("[inert]"),
    );
  const closeDisclosure = () => {
    root.classList.remove("has-project-disclosure");
    if (dialog.open) dialog.close();
  };

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    root.classList.remove("has-project-disclosure");
  });
  document.addEventListener("keydown", (event) => {
    if (!dialog.open || event.key !== "Tab") return;

    const focusable = getFocusableElements();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dismissButton.addEventListener("click", () => {
    writeStoredValue(storageKey, version);
    closeDisclosure();
  });

  if (readStoredValue(storageKey) === version) return;

  try {
    dialog.showModal();
    root.classList.add("has-project-disclosure");
    dismissButton.focus({ preventScroll: true });
  } catch {
    root.classList.remove("has-project-disclosure");
  }
};
