import { SELECTORS } from "../core/config.js";
import { qs } from "../utils/dom.js";
import { getFocusableElements, handleFocusTrap } from "../utils/a11y.js";

export const initLightbox = () => {
  const DEFAULT_ASPECT_RATIO = "16 / 9";
  const lb = qs(SELECTORS.lightbox);
  if (!lb) return;
  const imgEl = lb.querySelector(".lb__img");
  const captionEl = lb.querySelector(".lb__caption");
  const closeBtn = lb.querySelector(".lb__close");
  const backdrop = lb.querySelector(".lb__backdrop");
  const figureEl = lb.querySelector(".lb__figure");
  let items = [];
  let currentIndex = 0;
  let currentContainer = null;
  let prevBtn = null;
  let nextBtn = null;
  let liveRegion = null;
  let fsBtn = null;
  let lastActive = null;
  let focusables = [];
  const imageMeta = new Map();
  const isTouchLike = window.matchMedia ? window.matchMedia("(hover: none) and (pointer: coarse)").matches : "ontouchstart" in window;
  const resetMediaSizing = () => {
    if (figureEl) {
      figureEl.style.setProperty("--lb-aspect-ratio", DEFAULT_ASPECT_RATIO);
    }
    if (imgEl) {
      imgEl.removeAttribute("width");
      imgEl.removeAttribute("height");
    }
  };
  const applyMediaSizing = (w, h) => {
    if (!w || !h) return;
    imgEl.setAttribute("width", String(w));
    imgEl.setAttribute("height", String(h));
    if (figureEl) {
      figureEl.style.setProperty("--lb-aspect-ratio", `${w} / ${h}`);
    }
  };
  resetMediaSizing();
  if (imgEl) {
    imgEl.decoding = "async";
    imgEl.loading = "eager";
  }
  const trapInit = () => {
    focusables = getFocusableElements(lb);
  };
  const trapRelease = () => {
    focusables = [];
  };
  const open = (src, alt) => {
    lastActive = document.activeElement;
    resetMediaSizing();
    if (!items.length) {
      imgEl.src = src;
      imgEl.alt = alt || "";
      if (alt && alt.trim()) {
        captionEl.textContent = alt;
        captionEl.hidden = false;
      } else {
        captionEl.textContent = "";
        captionEl.hidden = true;
      }
    }
    lb.removeAttribute("hidden");
    lb.setAttribute("aria-hidden", "false");
    document.body.classList.add("lb-open");
    ensureControls();
    trapInit();
    if (closeBtn) closeBtn.focus();
    announceSlide();
  };
  const close = () => {
    lb.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lb-open");
    imgEl.removeAttribute("src");
    resetMediaSizing();
    captionEl.textContent = "";
    captionEl.hidden = true;
    trapRelease();
    lb.classList.remove("is-immersive");
    lb.setAttribute("hidden", "");
    if (lastActive && typeof lastActive.focus === "function") {
      lastActive.focus();
    }
    items = [];
    currentIndex = 0;
    currentContainer = null;
    if (fsBtn) {
      fsBtn.setAttribute("aria-pressed", "false");
      fsBtn.setAttribute("aria-label", "Włącz pełny ekran");
    }
  };
  const isFs = () => !!document.fullscreenElement;
  const enterFs = (el) => (el && el.requestFullscreen ? el.requestFullscreen() : Promise.resolve());
  const exitFs = () => (document.exitFullscreen ? document.exitFullscreen() : Promise.resolve());
  const isImmersiveFallback = () => lb.classList.contains("is-immersive");
  const toggleFs = () => {
    if (figureEl && figureEl.requestFullscreen && document.exitFullscreen) {
      return isFs() ? exitFs() : enterFs(figureEl);
    }
    lb.classList.toggle("is-immersive");
    updateFsButton();
    return Promise.resolve();
  };
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".gallery__link");
    if (!link || !link.closest(".gallery__container")) return;
    e.preventDefault();
    const href = link.getAttribute("href");
    const thumbImg = link.querySelector("img");
    const alt = thumbImg ? thumbImg.alt : "";
    currentContainer = link.closest(".gallery__container");
    const links = currentContainer ? Array.from(currentContainer.querySelectorAll(".gallery__link")) : [link];
    items = links
      .map((a) => {
        const timg = a.querySelector("img");
        return { href: a.getAttribute("href"), alt: timg ? timg.alt : "" };
      })
      .filter((i) => !!i.href);
    currentIndex = Math.max(
      0,
      items.findIndex((i) => i.href === href)
    );
    open(href, alt);
    render(currentIndex);
  });
  if (backdrop)
    backdrop.addEventListener("click", () => {
      if (isFs()) {
        exitFs().finally(() => close());
        return;
      }
      if (isImmersiveFallback()) lb.classList.remove("is-immersive");
      close();
    });
  if (imgEl) {
    imgEl.addEventListener("click", () => {
      toggleFs();
    });
    imgEl.addEventListener("dblclick", (e) => {
      e.preventDefault();
      toggleFs();
    });
  }

  function ensureControls() {
    if (!figureEl) return;
    if (!prevBtn) {
      prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "lb__prev";
      prevBtn.setAttribute("aria-label", "Poprzednie zdjęcie");
      prevBtn.innerHTML = "&#8249;";
      prevBtn.addEventListener("click", () => {
        showPrev();
      });
      figureEl.appendChild(prevBtn);
    }
    if (!nextBtn) {
      nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "lb__next";
      nextBtn.setAttribute("aria-label", "Następne zdjęcie");
      nextBtn.innerHTML = "&#8250;";
      nextBtn.addEventListener("click", () => {
        showNext();
      });
      figureEl.appendChild(nextBtn);
    }
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.className = "sr-only";
      liveRegion.setAttribute("aria-live", "polite");
      lb.appendChild(liveRegion);
    }
    if (!fsBtn) {
      fsBtn = document.createElement("button");
      fsBtn.type = "button";
      fsBtn.className = "lb__fs";
      fsBtn.setAttribute("aria-pressed", "false");
      fsBtn.setAttribute("aria-label", "Włącz pełny ekran");
      fsBtn.textContent = "⛶";
      fsBtn.addEventListener("click", () => {
        toggleFs();
        updateFsButton();
      });
      figureEl.appendChild(fsBtn);
    }
    updateFsButton();
  }

  function announceSlide() {
    if (!liveRegion || !items.length) return;
    const n = items.length;
    liveRegion.textContent = `Zdjęcie ${currentIndex + 1} z ${n}`;
  }

  function updateFsButton() {
    if (!fsBtn) return;
    const active = isFs() || isImmersiveFallback();
    fsBtn.setAttribute("aria-pressed", String(active));
    fsBtn.setAttribute("aria-label", active ? "Wyłącz pełny ekran" : "Włącz pełny ekran");
  }

  function preloadNeighbor(i) {
    if (!items.length) return;
    const n = items.length;
    const prev = items[(i - 1 + n) % n];
    const next = items[(i + 1) % n];
    [prev, next].forEach((it) => {
      if (it && it.href) {
        if (imageMeta.has(it.href)) return;
        const pre = new Image();
        pre.decoding = "async";
        pre.loading = "eager";
        pre.addEventListener("load", () => {
          imageMeta.set(it.href, {
            width: pre.naturalWidth,
            height: pre.naturalHeight,
          });
        });
        pre.src = it.href;
      }
    });
  }

  function render(i) {
    if (!items.length) return;
    const it = items[i];
    if (!it) return;
    imgEl.classList.add("is-fading");
    const meta = imageMeta.get(it.href);
    if (meta) {
      applyMediaSizing(meta.width, meta.height);
    }
    const onLoad = () => {
      const width = imgEl.naturalWidth;
      const height = imgEl.naturalHeight;
      imageMeta.set(it.href, { width, height });
      applyMediaSizing(width, height);
      imgEl.classList.remove("is-fading");
      imgEl.removeEventListener("load", onLoad);
    };
    imgEl.addEventListener("load", onLoad);
    imgEl.src = it.href;
    imgEl.alt = it.alt || "";
    if (it.alt && it.alt.trim()) {
      captionEl.textContent = it.alt;
      captionEl.hidden = false;
    } else {
      captionEl.textContent = "";
      captionEl.hidden = true;
    }
    announceSlide();
    preloadNeighbor(i);
  }

  function showNext() {
    if (!items.length) return;
    currentIndex = (currentIndex + 1) % items.length;
    render(currentIndex);
  }

  function showPrev() {
    if (!items.length) return;
    currentIndex = (currentIndex - 1 + items.length) % items.length;
    render(currentIndex);
  }

  (function initSwipe() {
    if (!figureEl) return;
    let startX = 0,
      startY = 0,
      dragging = false,
      dx = 0,
      dy = 0,
      active = false;
    const H_THRESHOLD = 48; // px
    const detectStart = (x, y) => {
      startX = x;
      startY = y;
      dragging = false;
      dx = 0;
      dy = 0;
      active = true;
    };
    const detectMove = (x, y, ev) => {
      if (!active) return;
      dx = x - startX;
      dy = y - startY;
      if (!dragging) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) dragging = true;
      }
      if (dragging && ev && ev.cancelable) ev.preventDefault();
    };
    const detectEnd = () => {
      if (dragging) {
        if (Math.abs(dx) > H_THRESHOLD) {
          if (dx < 0) showNext();
          else showPrev();
        }
      }
      dragging = false;
      active = false;
      dx = dy = 0;
    };
    figureEl.addEventListener("pointerdown", (e) => {
      detectStart(e.clientX, e.clientY);
    });
    figureEl.addEventListener(
      "pointermove",
      (e) => {
        detectMove(e.clientX, e.clientY, e);
      },
      { passive: true }
    );
    figureEl.addEventListener("pointerup", detectEnd);
    figureEl.addEventListener("pointercancel", detectEnd);
    figureEl.addEventListener("pointerleave", () => {
      if (active) detectEnd();
    });
  })();
  if (closeBtn) closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (lb.getAttribute("aria-hidden") !== "false") return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (isFs()) {
        exitFs();
        return;
      }
      if (isImmersiveFallback()) {
        lb.classList.remove("is-immersive");
        return;
      }
      close();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      showNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      showPrev();
    } else if (e.key === "Tab") {
      handleFocusTrap(e, focusables);
    }
  });
  document.addEventListener("fullscreenchange", () => {
    if (!isFs()) {
      lb.classList.remove("is-immersive");
    }
    updateFsButton();
  });
  if (!isTouchLike) {
    document.addEventListener(
      "mouseenter",
      (e) => {
        const el = e.target;
        if (!el || el.nodeType !== 1 || typeof el.closest !== "function") return;
        const link = el.closest(".gallery__link");
        if (!link || !link.closest(".gallery__container")) return;
        const href = link.getAttribute("href");
        if (!href) return;
        const pre = new Image();
        pre.decoding = "async";
        pre.src = href;
      },
      true
    );
  }
};
