import { CONFIG } from "../config.js";
import { qs } from "./dom.js";

const TOAST_TYPES = {
  success: {
    label: "Sukces",
    role: "status",
    live: "polite",
    duration: 2500,
  },
  info: {
    label: "Informacja",
    role: "status",
    live: "polite",
    duration: 2500,
  },
  warning: {
    label: "Uwaga",
    role: "alert",
    live: "assertive",
    duration: 3000,
  },
  error: {
    label: "Błąd",
    role: "alert",
    live: "assertive",
    duration: 4000,
  },
};

let hideToastTimer = null;

const getToastType = (type) => TOAST_TYPES[type] || TOAST_TYPES.info;

export const showToast = (message, options = {}) => {
  const toast = qs(CONFIG.selectors.toastRegion);
  if (!toast) return;

  const type = getToastType(options.type);
  const duration = Number.isFinite(options.duration) ? options.duration : type.duration;

  toast.innerHTML = "";
  toast.dataset.feedbackType =
    options.type && TOAST_TYPES[options.type] ? options.type : "info";
  toast.setAttribute("role", type.role);
  toast.setAttribute("aria-live", type.live);
  toast.setAttribute("aria-atomic", "true");

  const label = document.createElement("span");
  label.className = "toast__label";
  label.textContent = `${type.label}:`;

  const content = document.createElement("span");
  content.className = "toast__message";
  content.textContent = message;

  toast.append(label, content);
  toast.classList.add("toast--visible");

  window.clearTimeout(hideToastTimer);
  hideToastTimer = window.setTimeout(() => {
    toast.classList.remove("toast--visible");
  }, duration);
};
