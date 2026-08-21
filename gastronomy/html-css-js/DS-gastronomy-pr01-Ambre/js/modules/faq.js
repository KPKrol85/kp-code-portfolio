import { log } from "./utils.js";

export function initFaqAria() {
  const section = document.getElementById("faq") || document.querySelector(".faq");
  if (!section) return;

  const items = section.querySelectorAll("details");
  if (!items.length) return;

  const usedIds = new Set(
    Array.from(section.querySelectorAll("[id]"))
      .map((el) => el.id)
      .filter(Boolean)
  );

  items.forEach((item, index) => {
    const summary = item.querySelector("summary");
    if (!summary) return;

    const content = item.querySelector(".faq__content");
    if (content && !content.id) {
      const baseId = `faq-panel-${index + 1}`;
      let nextId = baseId;
      let suffix = 2;
      while (usedIds.has(nextId)) {
        nextId = `${baseId}-${suffix}`;
        suffix += 1;
      }
      content.id = nextId;
      usedIds.add(nextId);
    }

    if (content) {
      summary.setAttribute("aria-controls", content.id);
    }

    const update = () => {
      summary.setAttribute("aria-expanded", item.hasAttribute("open") ? "true" : "false");
    };

    item.addEventListener("toggle", update);
    update();
  });

  log(items.length);
}
