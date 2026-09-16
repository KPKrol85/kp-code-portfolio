import { initScrollspy } from "../core/scrollspy.js";

export function initGalleryPage() {
  initScrollspy({
    pageClass: "page--gallery",
    ids: ["wnetrza", "dania", "desery", "napoje"],
    listSelector: '.gallery-tabs__list a[href^="#"]',
    stickySelector: ".gallery-tabs",
    bottomPercent: "-55%",
    bottomPercentMobile: "-65%",
  });
}
