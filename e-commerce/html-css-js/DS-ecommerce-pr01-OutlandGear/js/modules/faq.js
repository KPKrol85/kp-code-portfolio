import { qs, qsa, delegate } from "./dom.js";

const ROOT_SELECTOR = "[data-faq-root]";
const TRIGGER_SELECTOR = "[data-faq-trigger]";

const syncItem = (trigger, panel, isOpen) => {
  trigger.setAttribute("aria-expanded", String(isOpen));
  panel.hidden = !isOpen;
};

export const initFaq = () => {
  const root = qs(ROOT_SELECTOR);
  if (!root) return;

  root.classList.add("faq--enhanced");

  const triggers = qsa(TRIGGER_SELECTOR, root);
  triggers.forEach((trigger, index) => {
    const panelId = trigger.getAttribute("aria-controls");
    const panel = panelId ? qs(`#${panelId}`, root) : null;
    if (!panel) return;

    const shouldOpen = index === 0;
    syncItem(trigger, panel, shouldOpen);
  });

  delegate(root, TRIGGER_SELECTOR, "click", (_, trigger) => {
    const panelId = trigger.getAttribute("aria-controls");
    const panel = panelId ? qs(`#${panelId}`, root) : null;
    if (!panel) return;

    const isOpen = trigger.getAttribute("aria-expanded") === "true";

    qsa(TRIGGER_SELECTOR, root).forEach((itemTrigger) => {
      const itemPanelId = itemTrigger.getAttribute("aria-controls");
      const itemPanel = itemPanelId ? qs(`#${itemPanelId}`, root) : null;
      if (!itemPanel) return;

      syncItem(itemTrigger, itemPanel, false);
    });

    syncItem(trigger, panel, !isOpen);
  });
};
