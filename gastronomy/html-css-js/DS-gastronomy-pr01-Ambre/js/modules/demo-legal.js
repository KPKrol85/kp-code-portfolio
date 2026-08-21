import { log } from "./utils.js";

const ACCEPTED_KEY = "demoLegalAccepted";

export function initDemoLegalModal() {
  const modal = document.getElementById("demo-legal-modal");
  if (!modal) return;

  const panel = modal.querySelector(".demo-legal-modal__panel");
  const acceptBtn = modal.querySelector("[data-demo-legal-accept]");
  const closeTriggers = modal.querySelectorAll("[data-demo-legal-close]");

  const open = () => {
    modal.removeAttribute("hidden");
    modal.removeAttribute("inert");
    modal.setAttribute("aria-hidden", "false");
    panel?.focus();
  };

  const close = () => {
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("inert", "");
    modal.setAttribute("hidden", "");
  };

  const handleAccept = () => {
    localStorage.setItem(ACCEPTED_KEY, "true");
    close();
  };

  const handleEscape = (event) => {
    if (event.key !== "Escape") return;
    if (modal.hasAttribute("hidden")) return;
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
  document.addEventListener("keydown", handleEscape);

  log();
}
