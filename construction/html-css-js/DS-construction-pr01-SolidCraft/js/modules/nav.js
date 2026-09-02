"use strict";

import { utils } from "./utils.js";

/* Navigation dropdown */

function initNav() {
  if (initNav._abort) initNav._abort.abort();

  const ac = new AbortController();
  const { signal } = ac;

  initNav._abort = ac;

  const html = document.documentElement;
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector("#navMenu");

  if (!toggle || !menu) return;
  if (!toggle.getAttribute("aria-controls"))
    toggle.setAttribute("aria-controls", "navMenu");

  const OPEN_CLASS = "is-nav-open";
  const OUTSIDE_EVT = "pointerdown" in window ? "pointerdown" : "click";
  const NAVIGATION_BREAKPOINT = 1024;
  const mqDesktop = window.matchMedia(
    `(min-width: ${NAVIGATION_BREAKPOINT}px)`,
  );

  let lastFocus = null;

  const setOpen = (open, { silentFocus = false } = {}) => {
    menu.classList.toggle("open", open);
    html.classList.toggle(OPEN_CLASS, open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Zamknij menu" : "Otwórz menu");
    window.dispatchEvent(new CustomEvent("nav:toggle", { detail: { open } }));
    if (silentFocus) return;
    if (open) {
      lastFocus = document.activeElement;
      menu
        .querySelector('a, button, [tabindex]:not([tabindex="-1"])')
        ?.focus({ preventScroll: true });
    } else {
      (lastFocus || toggle).focus({ preventScroll: true });
      lastFocus = null;
    }
  };

  setOpen(menu.classList.contains("open"), { silentFocus: true });

  toggle.addEventListener(
    "click",
    () => setOpen(!menu.classList.contains("open")),
    { signal },
  );

  menu.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      if (!mqDesktop.matches) setOpen(false);
    },
    { signal },
  );

  document.addEventListener(
    OUTSIDE_EVT,
    (e) => {
      if (!menu.classList.contains("open")) return;
      if (!menu.contains(e.target) && !toggle.contains(e.target))
        setOpen(false);
    },
    { capture: true, passive: true, signal },
  );

  document.addEventListener(
    "keydown",
    (e) => {
      const isOpen = menu.classList.contains("open");
      if (!isOpen) return;
      if (e.key === "Escape") {
        const ddMenuLive = document.querySelector("#dd-oferta");
        const ddTrigLive = document.querySelector(
          '.dropdown-trigger[href="#oferta"]',
        );
        const active = document.activeElement;
        const insideDd =
          ddMenuLive &&
          ddTrigLive &&
          (ddMenuLive.contains(active) || ddTrigLive.contains(active));
        if (!insideDd) {
          setOpen(false);
          return;
        }
      }
      if (e.key === "Tab") {
        const focusables = menu.querySelectorAll(
          'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    { signal },
  );

  const ddTrigger = document.querySelector('.dropdown-trigger[href="#oferta"]');
  const ddMenu = document.querySelector("#dd-oferta");

  if (ddTrigger && ddMenu) {
    const parentLi =
      ddTrigger.closest(".has-dropdown") || ddTrigger.parentElement;
    const isDdOpen = () => ddMenu.classList.contains("open");
    ddTrigger.setAttribute("aria-expanded", String(isDdOpen()));
    ddTrigger.setAttribute("aria-haspopup", "true");
    if (!ddTrigger.getAttribute("aria-controls"))
      ddTrigger.setAttribute("aria-controls", "dd-oferta");
    const focusFirstItem = () => {
      ddMenu
        .querySelector('a, button, [tabindex]:not([tabindex="-1"])')
        ?.focus({ preventScroll: true });
    };

    const setDd = (open, { returnFocus = false, focusFirst = false } = {}) => {
      ddMenu.classList.toggle("open", open);
      ddTrigger.setAttribute("aria-expanded", String(open));
      if (open && focusFirst) focusFirstItem();
      else if (!open && returnFocus) ddTrigger.focus({ preventScroll: true });
    };

    if (parentLi) {
      parentLi.addEventListener(
        "mouseenter",
        () => {
          if (mqDesktop.matches) setDd(true);
        },
        { signal },
      );
      parentLi.addEventListener(
        "mouseleave",
        () => {
          if (mqDesktop.matches) setDd(false);
        },
        { signal },
      );
      parentLi.addEventListener(
        "focusin",
        () => {
          if (mqDesktop.matches) setDd(true);
        },
        { signal },
      );
      parentLi.addEventListener(
        "focusout",
        (e) => {
          if (mqDesktop.matches && !parentLi.contains(e.relatedTarget))
            setDd(false);
        },
        { signal },
      );
    }

    const openMobileOnce = () => {
      if (mqDesktop.matches) return false;
      if (!isDdOpen()) {
        setDd(true, { focusFirst: true });
        return true;
      }
      return false;
    };

    ddTrigger.addEventListener(
      "click",
      (e) => {
        if (openMobileOnce()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      { signal },
    );

    ddTrigger.addEventListener(
      "keydown",
      (e) => {
        const isEnter = e.key === "Enter";
        const isSpace = e.key === " " || e.code === "Space";
        if (!(isEnter || isSpace)) return;
        if (openMobileOnce()) e.preventDefault();
      },
      { signal },
    );

    document.addEventListener(
      OUTSIDE_EVT,
      (e) => {
        if (
          isDdOpen() &&
          !ddMenu.contains(e.target) &&
          !ddTrigger.contains(e.target)
        ) {
          setDd(false, { returnFocus: false });
        }
      },
      { capture: true, passive: true, signal },
    );

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape" || !isDdOpen()) return;
        const active = document.activeElement;
        const inside =
          active && (ddMenu.contains(active) || ddTrigger.contains(active));
        if (inside) {
          e.preventDefault();
          setDd(false, { returnFocus: true });
        }
      },
      { signal },
    );

    window.addEventListener(
      "nav:toggle",
      (e) => {
        if (!e.detail.open) setDd(false);
      },
      { signal },
    );

    const onMqChange = () => setDd(false);
    if (mqDesktop.addEventListener)
      mqDesktop.addEventListener("change", onMqChange, { signal });
    else mqDesktop.addListener(onMqChange);
  }
}

/* ScrollSpy */

function initScrollSpy() {
  if (initScrollSpy._abort) initScrollSpy._abort.abort();
  const ac = new AbortController();
  const { signal } = ac;

  initScrollSpy._abort = ac;

  const html = document.documentElement;
  const headerEl = document.querySelector(".site-header");
  const navMenu = document.getElementById("navMenu");
  const navLinks = [...document.querySelectorAll('.nav-menu a[href^="#"]')];

  if (!navLinks.length) return;

  const PEEK = 12;
  const mapHref = (href) => (href === "#top" ? "#strona-glowna" : href);
  const targetsFromMenu = navLinks
    .map((a) => mapHref(a.getAttribute("href")))
    .filter((href) => href && href.startsWith("#") && href.length > 1);
  const extraTargets = [];

  if (document.querySelector("#oferta")) extraTargets.push("#oferta");

  const sections = [...new Set([...targetsFromMenu, ...extraTargets])]
    .map((sel) => document.querySelector(sel))
    .filter(Boolean);

  if (!sections.length) return;

  const getHeaderLive = () =>
    headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 0;
  const getOffset = () =>
    (typeof utils?.getHeaderH === "function"
      ? utils.getHeaderH()
      : getHeaderLive()) + PEEK;
  const isMenuOpen = () => {
    return (
      (navMenu && navMenu.classList.contains("open")) ||
      html.classList.contains("is-nav-open") ||
      document.body.classList.contains("nav-open") ||
      document.documentElement.classList.contains("nav-open") ||
      (headerEl && headerEl.classList.contains("open"))
    );
  };

  const applyScrollMargin = () => {
    const OFFSET = getOffset();
    const token = String(OFFSET);
    sections.forEach((sec) => {
      if (sec.dataset.appliedScrollMargin !== token) {
        sec.style.scrollMarginTop = OFFSET + "px";
        sec.dataset.appliedScrollMargin = token;
      }
    });
  };

  let lastId = sections[0].id;
  const setActive = (id) => {
    lastId = id;
    navLinks.forEach((a) => {
      const href = mapHref(a.getAttribute("href"));
      const match = href === "#" + id;
      a.classList.toggle("is-active", match);
      if (match) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    const ofertaTrigger = document.querySelector(
      '.dropdown-trigger[aria-controls="dd-oferta"]',
    );
    if (ofertaTrigger) {
      const isOfertaCtx = id === "oferta" || id.startsWith("oferta-");
      ofertaTrigger.classList.toggle("is-active", isOfertaCtx);
      if (isOfertaCtx) ofertaTrigger.setAttribute("aria-current", "true");
      else ofertaTrigger.removeAttribute("aria-current");
    }
  };

  const pickCurrent = () => {
    const OFFSET = getOffset();
    const probeY = OFFSET + 1;
    const candidates = sections.filter((sec) => {
      const r = sec.getBoundingClientRect();
      return r.top <= probeY && r.bottom > probeY;
    });
    if (candidates.length) return candidates[candidates.length - 1].id;

    let currentId = sections[0].id;
    let bestTop = -Infinity;
    for (const sec of sections) {
      const top = sec.getBoundingClientRect().top - OFFSET;
      if (top <= 0 && top > bestTop) {
        bestTop = top;
        currentId = sec.id;
      }
    }
    if (
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 2
    ) {
      currentId = sections[sections.length - 1].id;
    }
    return currentId;
  };

  const compute = () => {
    if (isMenuOpen()) return;
    const id = pickCurrent();
    if (id !== lastId) setActive(id);
  };

  let scrollTimeout = 0;
  let scrollEndPending = false;
  const scheduleComputeAfterScroll = () => {
    if ("onscrollend" in window) {
      if (scrollEndPending) return;
      scrollEndPending = true;
      const once = () => {
        scrollEndPending = false;
        window.removeEventListener("scrollend", once);
        compute();
      };
      window.addEventListener("scrollend", once, { signal });
    } else {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(compute, 120);
    }
  };
  signal.addEventListener("abort", () => {
    scrollEndPending = false;
  });

  let ticking = false;
  const onScroll = () => {
    if (isMenuOpen()) return;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        compute();
      });
    }
    scheduleComputeAfterScroll();
  };
  window.addEventListener("scroll", onScroll, { passive: true, signal });

  let raf = 0;
  const onResize = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      applyScrollMargin();
      compute();
    });
  };
  window.addEventListener("resize", onResize, { passive: true, signal });
  window.addEventListener("nav:toggle", onResize, { signal });

  const prefersNoAnim = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const behavior = prefersNoAnim ? "auto" : "smooth";

  navLinks.forEach((a) => {
    a.addEventListener(
      "click",
      (e) => {
        const raw = a.getAttribute("href") || "";
        const href = mapHref(raw);
        if (!href.startsWith("#")) return;
        e.preventDefault();
        const target = document.querySelector(href);
        if (!target) return;
        navMenu?.classList.remove("open");
        headerEl?.classList.remove("open");
        html.classList.remove("is-nav-open");
        document.body.classList.remove("nav-open");
        document.documentElement.classList.remove("nav-open");
        window.dispatchEvent(
          new CustomEvent("nav:toggle", { detail: { open: false } }),
        );
        setActive(target.id);
        const OFFSET = getOffset();
        const targetY = Math.max(
          0,
          window.scrollY + target.getBoundingClientRect().top - OFFSET,
        );
        window.scrollTo({ top: targetY, behavior });
        if (history.pushState) history.pushState(null, "", href);
        else location.hash = href;
        scheduleComputeAfterScroll();
      },
      { signal },
    );
  });

  if (navMenu) {
    const mo = new MutationObserver(() => {
      if (!isMenuOpen()) scheduleComputeAfterScroll();
    });
    mo.observe(navMenu, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("pagehide", () => mo.disconnect(), {
      once: true,
      signal,
    });
  }

  applyScrollMargin();
  compute();
}

/* Header Shrink */

function initHeaderShrink() {
  if (initHeaderShrink._abort) initHeaderShrink._abort.abort();
  const ac = new AbortController();
  const { signal } = ac;
  initHeaderShrink._abort = ac;
  const header = document.querySelector('.site-header, header[role="banner"]');
  if (!header) return;
  const ENTER = 16;
  const EXIT = 4;
  let isShrink = false;
  let rafScroll = 0;
  const measureHeader = () => Math.round(header.getBoundingClientRect().height);
  const syncVar = () => {
    const h = measureHeader();
    document.documentElement.style.setProperty("--header-h", `${h}px`);
    if (typeof utils?.refreshHeaderH === "function") utils.refreshHeaderH();
    else if (window.utils?.refreshHeaderH) window.utils.refreshHeaderH();
    window.dispatchEvent(
      new CustomEvent("header:sync", { detail: { height: h } }),
    );
    return h;
  };

  const applyShrink = (want) => {
    if (want === isShrink) {
      requestAnimationFrame(syncVar);
      return;
    }
    isShrink = want;
    header.classList.toggle("is-shrink", isShrink);
    requestAnimationFrame(syncVar);
  };

  const onScroll = () => {
    if (rafScroll) return;
    rafScroll = requestAnimationFrame(() => {
      rafScroll = 0;
      const y = window.scrollY || 0;
      if (!isShrink && y > ENTER) applyShrink(true);
      else if (isShrink && y < EXIT) applyShrink(false);
    });
  };

  const ro = new ResizeObserver(() => {
    requestAnimationFrame(syncVar);
  });
  ro.observe(header);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready
      .then(() => requestAnimationFrame(syncVar))
      .catch(() => {});
  }
  window.addEventListener("nav:toggle", () => requestAnimationFrame(syncVar), {
    signal,
  });

  window.addEventListener("pageshow", () => requestAnimationFrame(syncVar), {
    signal,
  });

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) requestAnimationFrame(syncVar);
    },
    { signal },
  );

  window.addEventListener("scroll", onScroll, { passive: true, signal });
  window.addEventListener("resize", () => requestAnimationFrame(syncVar), {
    passive: true,
    signal,
  });

  signal.addEventListener("abort", () => {
    try {
      ro.disconnect();
    } catch {}
  });
  syncVar();
  onScroll();
}

export { initNav, initScrollSpy, initHeaderShrink };
