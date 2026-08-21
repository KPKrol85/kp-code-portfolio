import { log } from "./utils.js";

export function initCtaPulse() {
  const buttons = document.querySelectorAll(".btn-cta");
  if (!buttons.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("cta-inview", entry.isIntersecting);
      });
    },
    { threshold: 0.2 }
  );

  buttons.forEach((btn) => observer.observe(btn));
  log(buttons.length);
}