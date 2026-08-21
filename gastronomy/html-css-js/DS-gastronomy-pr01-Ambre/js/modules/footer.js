import { $ } from "./utils.js";

export function initFooterYear() {
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
}