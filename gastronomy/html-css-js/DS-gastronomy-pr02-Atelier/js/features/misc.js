export function initMisc() {
  var legalYear = document.getElementById("year");
  if (legalYear) {
    legalYear.textContent = String(new Date().getFullYear());
  }

  function setAriaCurrentPageLinks() {
    if (typeof location === "undefined") return;
    function normalizePath(path) {
      if (!path || path === "/") return "/index.html";
      return path;
    }
    var currentPath = normalizePath(location.pathname);
    var links = document.querySelectorAll("nav a[href]");
    links.forEach(function (link) {
      var href = link.getAttribute("href");
      if (!href) return;
      var url = new URL(href, location.href);
      if (url.hash) {
        link.removeAttribute("aria-current");
        return;
      }
      var linkPath = normalizePath(url.pathname);
      if (linkPath === currentPath) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  setAriaCurrentPageLinks();

  var reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") return;
      var target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });
}
