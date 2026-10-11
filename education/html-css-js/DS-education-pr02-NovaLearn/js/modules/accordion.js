export function initAccordion() {
  const accordionButtons = document.querySelectorAll(".accordion__button");

  if (!accordionButtons.length) {
    return;
  }

  accordionButtons.forEach((button) => {
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    if (panel) {
      panel.hidden = true;
    }

    button.addEventListener("click", () => {
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!isExpanded));
      if (panel) {
        panel.hidden = isExpanded;
      }
    });
  });
}
