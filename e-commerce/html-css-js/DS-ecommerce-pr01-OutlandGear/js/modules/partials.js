import { qsa } from "./dom.js";

export const PARTIALS_READY_EVENT = "partials:ready";

const normalizePath = (path) => {
  const normalized = path.replace(/\/index\.html$/, "/").replace(/\/+$/, "");
  return normalized || "/";
};

const markCurrentNavLinks = (scope = document) => {
  const currentPath = normalizePath(window.location.pathname);

  qsa("a[data-nav-link]", scope).forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    const linkPath = normalizePath(new URL(href, window.location.href).pathname);
    if (linkPath === currentPath) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

const loadPartial = async (host) => {
  const src = host.dataset.partialSrc;
  if (!src) return;

  try {
    const response = await fetch(src, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Failed to load partial: ${src}`);
    host.innerHTML = await response.text();
  } catch {
    host.dataset.partialStatus = "fallback";
  }
};

export const initPartials = async () => {
  const hosts = qsa("[data-partial-src]");
  if (!hosts.length) {
    markCurrentNavLinks();
    document.dispatchEvent(new CustomEvent(PARTIALS_READY_EVENT));
    return;
  }

  await Promise.all(hosts.map((host) => loadPartial(host)));
  markCurrentNavLinks();
  document.dispatchEvent(new CustomEvent(PARTIALS_READY_EVENT));
};
