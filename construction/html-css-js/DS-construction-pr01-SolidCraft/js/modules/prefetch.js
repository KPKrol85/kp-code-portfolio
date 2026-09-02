"use strict";

function initOfferPrefetch() {
  if (initOfferPrefetch._abort) initOfferPrefetch._abort.abort();
  const ac = new AbortController();
  const { signal } = ac;
  initOfferPrefetch._abort = ac;
  const canPrefetch = () => {
    const n = navigator;
    const c = n && "connection" in n ? n.connection : null;
    if (c?.saveData) return false;
    const et = (c?.effectiveType || "").toLowerCase();
    if (et.includes("2g") || et === "slow-2g") return false;
    return true;
  };
  if (!canPrefetch()) return;
  const links = Array.from(
    document.querySelectorAll(
      '.services-track h3 a[href^="oferta/"], #oferta .card h3 a[href^="oferta/"]',
    ),
  );
  if (!links.length) return;
  const prefetched = new Set();
  const timers = new WeakMap();
  const isSameOriginHttp = (href) => {
    try {
      const u = new URL(href, location.href);
      return (
        (u.protocol === "http:" || u.protocol === "https:") &&
        u.origin === location.origin
      );
    } catch {
      return false;
    }
  };

  const injectPrefetch = (href) => {
    if (!isSameOriginHttp(href)) return;
    if (prefetched.has(href)) return;
    if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) {
      prefetched.add(href);
      return;
    }
    const l = document.createElement("link");
    l.rel = "prefetch";
    l.href = href;
    document.head.appendChild(l);
    prefetched.add(href);
  };

  const schedule = (a) => {
    clear(a);
    const id = setTimeout(() => injectPrefetch(a.href), 120);
    timers.set(a, id);
  };

  const clear = (a) => {
    const id = timers.get(a);
    if (id) {
      clearTimeout(id);
      timers.delete(a);
    }
  };

  links.forEach((a) => {
    a.addEventListener("mouseenter", () => schedule(a), { signal });
    a.addEventListener("mouseleave", () => clear(a), { signal });
    a.addEventListener("focus", () => schedule(a), { signal });
    a.addEventListener("blur", () => clear(a), { signal });
    a.addEventListener("touchstart", () => injectPrefetch(a.href), {
      passive: true,
      once: true,
      signal,
    });
  });
  window.addEventListener("pagehide", () => ac.abort(), { once: true, signal });
}

export { initOfferPrefetch };
