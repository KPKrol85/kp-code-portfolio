import { initMisc } from "./features/misc.js";
import { initDemoLegalModal } from "./features/demo-modal.js";
import { initThemeToggle } from "./features/theme.js";
import { initNav } from "./features/nav.js";
import { initReveal } from "./features/reveal.js";
import { initIcons } from "./features/icons.js";

document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", function () {
  initIcons();
  initMisc();
  initDemoLegalModal();
  initNav();
  initReveal();
  initThemeToggle();
});
