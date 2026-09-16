import { initMisc } from "./features/misc.js";
import { initThemeToggle } from "./features/theme.js";
import { initNav } from "./features/nav.js";

document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", function () {
  initMisc();
  initNav();
  initThemeToggle();
});
