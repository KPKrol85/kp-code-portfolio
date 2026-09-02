import { log } from "./utils.js";

export function initLightbox() {
  const box = document.querySelector(".site-lightbox") || document.getElementById("lb");
  if (!box) return;

  const isDialog = box.nodeName === "DIALOG" && typeof box.showModal === "function";
  const picture = box.querySelector("picture") || box;
  const sourceAvif = picture?.querySelector('source[type="image/avif"]') || document.getElementById("lb-avif");
  const sourceWebp = picture?.querySelector('source[type="image/webp"]') || document.getElementById("lb-webp");
  const img = picture?.querySelector(".site-lightbox__image") || document.getElementById("lb-img");
  const closeBtn = box.querySelector(".site-lightbox__close") || box.querySelector("[data-close]");
  const overlay = box.querySelector(".site-lightbox__overlay");

  let counter = box.querySelector(".site-lightbox__counter");
  if (!counter) {
    counter = document.createElement("output");
    counter.className = "site-lightbox__counter";
    counter.setAttribute("aria-live", "polite");
    counter.setAttribute("aria-atomic", "true");
    box.appendChild(counter);
  }

  if (!isDialog) {
    box.setAttribute("hidden", "");
    box.setAttribute("aria-hidden", "true");
  }

  const normalizeUrl = (value) => {
    if (!value) return "";
    try {
      return new URL(value, location.href).href;
    } catch {
      return value;
    }
  };

  const basePath = (value = "") => {
    if (!value) return "";
    return normalizeUrl(value)
      .replace(/[?#].*$/, "")
      .replace(/\.(avif|webp|jpe?g|png)$/i, "");
  };

  const toOptimizedBase = (base = "") => {
    if (!base) return base;
    const deduped = base.replace(/(\/assets\/img\/)(?:_optimized\/)+/g, "$1_optimized/");
    if (/(^|\/)assets\/img\/_optimized\//.test(deduped)) return deduped;
    return deduped
      .replace("/assets/img/", "/assets/img/_optimized/")
      .replace("assets/img/", "assets/img/_optimized/")
      .replace(/(\/assets\/img\/)(?:_optimized\/)+/g, "$1_optimized/");
  };

  const getFull = (node) => {
    if (!node) return "";
    try {
      const datasetValue = node.dataset && node.dataset.full;
      if (datasetValue) return normalizeUrl(datasetValue);
    } catch {}

    const attrValue = node.getAttribute && node.getAttribute("data-full");
    if (attrValue) return normalizeUrl(attrValue);

    const href = node.getAttribute && node.getAttribute("href");
    if (href && !href.startsWith("#")) return normalizeUrl(href);

    const innerImg = node.querySelector && node.querySelector("img");
    return innerImg ? innerImg.currentSrc || innerImg.src || "" : "";
  };

  const setImage = (value, alt = "") => {
    if (!value) return;
    const base = basePath(value);
    if (!base) return;

    const optimizedBase = toOptimizedBase(base);

    if (sourceAvif) sourceAvif.srcset = `${optimizedBase}.avif`;
    if (sourceWebp) sourceWebp.srcset = `${optimizedBase}.webp`;
    if (img) {
      img.src = `${base}.jpg`;
      img.alt = alt || "";
    }
  };

  const MODE_GALLERY = "gallery";
  const MODE_SINGLE = "single";

  // Trigger contract: a trigger opens in the mode declared by its nearest
  // [data-lightbox-mode] scope, falling back to the default of its own type.
  // Gallery triggers browse their group; menu dish triggers stay isolated.
  const TRIGGERS = [
    { selector: ".dish__thumb", groupRoot: ".menu__grid", defaultMode: MODE_SINGLE },
    { selector: ".gallery__item", groupRoot: ".gallery__grid", defaultMode: MODE_GALLERY }
  ];

  let index = -1;
  let items = [];
  let mode = MODE_GALLERY;
  let lastActive = null;
  let scrollY = 0;
  let prevPosition = "";
  let prevTop = "";
  let prevWidth = "";
  let prevHash = "";
  let prevRootScrollBehavior = "";
  let documentStateLocked = false;

  const readDeclaredMode = (node) => {
    const scope = node?.closest?.("[data-lightbox-mode]");
    const declared = (scope?.getAttribute("data-lightbox-mode") || "").trim().toLowerCase();
    return declared === MODE_GALLERY || declared === MODE_SINGLE ? declared : "";
  };

  const getVisibleItems = (root, selector) =>
    root
      ? Array.from(root.querySelectorAll(selector)).filter(
          (item) => !item.hidden && item.offsetParent !== null
        )
      : [];

  const getGalleryItems = (root) => getVisibleItems(root, ".gallery__item");

  const canNavigate = () => mode === MODE_GALLERY && items.length > 1;

  const updateCounter = () => {
    const total = items.length;
    if (!counter || mode === MODE_SINGLE || total <= 1 || index < 0) {
      counter.hidden = true;
      counter.textContent = "";
      return;
    }

    counter.hidden = false;
    const label = `${index + 1} / ${total}`;
    counter.value = label;
    counter.textContent = label;
  };

  const open = (src, alt, startIndex = -1, scopeItems = [], requestedMode = MODE_GALLERY) => {
    if (!src) return;

    lastActive = document.activeElement;
    mode = requestedMode === MODE_SINGLE ? MODE_SINGLE : MODE_GALLERY;

    const scoped = Array.isArray(scopeItems) ? scopeItems : [];
    const normalized = normalizeUrl(src);
    setImage(normalized, alt);

    if (mode === MODE_SINGLE) {
      // A dish preview is isolated: the session never holds sibling images.
      items = scoped.slice(0, 1);
      index = items.length ? 0 : -1;
    } else {
      items = scoped.length ? scoped : getGalleryItems(document.querySelector(".gallery__grid"));

      if (typeof startIndex === "number" && startIndex >= 0) {
        index = startIndex;
      } else {
        index = items.findIndex((item) => {
          const itemSrc = getFull(item) || "";
          return itemSrc && normalizeUrl(itemSrc) === normalized;
        });
      }

      if (index === -1 && items.length) index = 0;
    }

    applyMode();

    prevHash = location.hash || "";
    if (prevHash) {
      history.replaceState(null, "", location.pathname + location.search);
    }

    if (!documentStateLocked) {
      scrollY = window.scrollY;
      prevPosition = document.body.style.position;
      prevTop = document.body.style.top;
      prevWidth = document.body.style.width;
      prevRootScrollBehavior = document.documentElement.style.scrollBehavior;
      documentStateLocked = true;
    }

    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    if (isDialog) {
      try {
        if (!box.open) box.showModal();
      } catch (error) {
        log(error);
      }
    } else {
      box.removeAttribute("hidden");
      box.setAttribute("aria-hidden", "false");
      box.classList.add("site-lightbox--open");
    }

    if (closeBtn && typeof closeBtn.focus === "function") closeBtn.focus();
    updateCounter();
    preload(1);
    preload(-1);
  };

  const restoreDocumentState = () => {
    if (!documentStateLocked) return;
    documentStateLocked = false;

    if (prevHash) {
      history.replaceState(null, "", location.pathname + location.search + prevHash);
    }

    document.body.style.position = prevPosition;
    document.body.style.top = prevTop;
    document.body.style.width = prevWidth;
    window.scrollTo(0, scrollY);
    document.documentElement.style.scrollBehavior = prevRootScrollBehavior;

    if (lastActive && typeof lastActive.focus === "function") lastActive.focus();

    index = -1;
    items = [];
    mode = MODE_GALLERY;
    applyMode();
    if (counter) {
      counter.hidden = true;
      counter.textContent = "";
    }
  };

  const close = () => {
    if (isDialog) {
      if (box.open) box.close();
    } else {
      box.classList.remove("site-lightbox--open");
      box.setAttribute("aria-hidden", "true");
      box.setAttribute("hidden", "");
      setTimeout(() => {
        sourceAvif?.removeAttribute("srcset");
        sourceWebp?.removeAttribute("srcset");
        img?.removeAttribute("src");
      }, 170);
    }

    restoreDocumentState();
  };

  const showAt = (nextIndex) => {
    if (!canNavigate()) return;
    index = (nextIndex + items.length) % items.length;
    const node = items[index];
    const src = getFull(node) || "";
    const alt = node?.querySelector("img")?.alt || node?.getAttribute("aria-label") || "";
    setImage(src, alt);
    updateCounter();
  };

  const preload = (step) => {
    if (!canNavigate() || index === -1) return;
    const nextIndex = (index + step + items.length) % items.length;
    const node = items[nextIndex];
    const src = getFull(node) || "";
    if (!src) return;

    const base = basePath(src);
    if (!base) return;

    const optimizedBase = toOptimizedBase(base);

    [`${optimizedBase}.webp`, `${optimizedBase}.avif`, `${base}.jpg`].forEach((value) => {
      const image = new Image();
      image.src = value;
    });
  };

  document.addEventListener("click", (event) => {
    for (const trigger of TRIGGERS) {
      const node = event.target.closest(trigger.selector);
      if (!node) continue;

      const src = getFull(node);
      const alt =
        node.querySelector("img")?.alt || node.getAttribute("aria-label") || "";
      if (event.target.closest("a")) event.preventDefault();

      const triggerMode = readDeclaredMode(node) || trigger.defaultMode;
      const scopeItems =
        triggerMode === MODE_SINGLE
          ? [node]
          : getVisibleItems(node.closest(trigger.groupRoot), trigger.selector);

      open(src, alt, scopeItems.indexOf(node), scopeItems, triggerMode);
      return;
    }
  });

  const gallery = document.querySelector(".gallery__section");
  if (gallery) {
    gallery.addEventListener(
      "click",
      (event) => {
        if (event.target.closest('a[href^="#"]')) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );
  }

  window.addEventListener(
    "hashchange",
    () => {
      const isOpen = isDialog ? box.open : box.classList.contains("site-lightbox--open");
      if (isOpen) {
        history.replaceState(null, "", location.pathname + location.search);
        window.scrollTo(0, scrollY);
      }
    },
    true
  );

  closeBtn?.addEventListener("click", close);
  overlay && overlay.addEventListener("click", close);
  box.addEventListener("click", (event) => {
    if (event.target === box) close();
  });

  box.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      const isOpen = isDialog ? box.open : box.classList.contains("site-lightbox--open");
      const activeInside = box.contains(document.activeElement);
      if (!isOpen || !activeInside || !canNavigate()) return;
      event.preventDefault();
      showAt(index === -1 ? 0 : index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      const isOpen = isDialog ? box.open : box.classList.contains("site-lightbox--open");
      const activeInside = box.contains(document.activeElement);
      if (!isOpen || !activeInside || !canNavigate()) return;
      event.preventDefault();
      showAt(index === -1 ? 0 : index + 1);
      return;
    }

    if (event.key === "Escape") {
      const isOpen = isDialog ? box.open : box.classList.contains("site-lightbox--open");
      if (isOpen) close();
    }
  });

  let prevButton = box.querySelector(".site-lightbox__nav-button--prev");
  let nextButton = box.querySelector(".site-lightbox__nav-button--next");

  const buildButton = (classNames, label, icon) => {
    const button = document.createElement("button");
    button.className = classNames.join(" ");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.innerHTML = icon;
    return button;
  };

  if (!prevButton) {
    prevButton = buildButton(
      ["site-lightbox__nav-button", "site-lightbox__nav-button--prev"],
      "Poprzednie zdjęcie",
      '<svg class="site-lightbox__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 19L8 12l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    );
    box.appendChild(prevButton);
  }

  if (!nextButton) {
    nextButton = buildButton(
      ["site-lightbox__nav-button", "site-lightbox__nav-button--next"],
      "Następne zdjęcie",
      '<svg class="site-lightbox__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    );
    box.appendChild(nextButton);
  }

  const applyMode = () => {
    box.dataset.lightboxMode = mode;
    const navigable = canNavigate();
    [prevButton, nextButton].forEach((button) => {
      if (!button) return;
      button.hidden = !navigable;
      button.disabled = !navigable;
    });
  };

  applyMode();

  prevButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (canNavigate()) showAt(index === -1 ? 0 : index - 1);
  });

  nextButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (canNavigate()) showAt(index === -1 ? 0 : index + 1);
  });

  (function enableSwipe() {
    if (!img) return;
    const supportsPointer = "PointerEvent" in window;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let deltaY = 0;
    let tracking = false;
    let horizontal = false;

    const reset = () => {
      if (prefersReducedMotion) {
        img.style.transition = "none";
        img.style.transform = "translate3d(0,0,0)";
        img.style.willChange = "";
        return;
      }
      img.style.transition = "transform .18s ease";
      img.style.transform = "translate3d(0,0,0)";
      img.addEventListener(
        "transitionend",
        () => {
          img.style.willChange = "";
        },
        { once: true }
      );
    };

    const onStart = (x, y) => {
      startX = x;
      startY = y;
      deltaX = 0;
      deltaY = 0;
      tracking = true;
      horizontal = false;
    };

    const onMove = (x, y, event) => {
      if (!tracking) return;
      deltaX = x - startX;
      deltaY = y - startY;
      if (!horizontal && Math.abs(deltaX) > 8) {
        horizontal = Math.abs(deltaY / (deltaX || 1)) < 0.577;
      }
      if (horizontal) {
        event?.preventDefault?.();
        img.style.transition = "none";
        img.style.transform = `translate3d(${deltaX}px,0,0)`;
        img.style.willChange = "transform";
      }
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;

      if (horizontal && Math.abs(deltaX) > 60 && canNavigate()) {
        const direction = deltaX < 0 ? 1 : -1;
        if (prefersReducedMotion) {
          showAt(index === -1 ? 0 : index + direction);
          preload(1);
          preload(-1);
          reset();
          return;
        }
        img.style.transition = "transform .12s ease";
        img.style.transform = `translate3d(${Math.sign(deltaX) * window.innerWidth * 0.25}px,0,0)`;
        setTimeout(() => {
          showAt(index === -1 ? 0 : index + direction);
          img.style.transition = "none";
          img.style.transform = `translate3d(${28 * Math.sign(-deltaX)}px,0,0)`;
          requestAnimationFrame(() => reset());
          preload(1);
          preload(-1);
        }, 90);
      } else {
        reset();
      }
    };

    if (supportsPointer) {
      img.addEventListener(
        "pointerdown",
        (event) => {
          if (event.pointerType !== "mouse") onStart(event.clientX, event.clientY);
        },
        { passive: true }
      );
      img.addEventListener(
        "pointermove",
        (event) => {
          if (event.pointerType !== "mouse") onMove(event.clientX, event.clientY, event);
        },
        { passive: false }
      );
      img.addEventListener("pointerup", onEnd, { passive: true });
      img.addEventListener("pointercancel", onEnd, { passive: true });
      return;
    }

    img.addEventListener(
      "touchstart",
      (event) => {
        const touch = event.touches[0];
        if (touch) onStart(touch.clientX, touch.clientY);
      },
      { passive: true }
    );

    img.addEventListener(
      "touchmove",
      (event) => {
        const touch = event.touches[0];
        if (touch) onMove(touch.clientX, touch.clientY, event);
      },
      { passive: false }
    );

    img.addEventListener("touchend", onEnd, { passive: true });
    img.addEventListener("touchcancel", onEnd, { passive: true });
  })();

  const fullscreenTarget = box;
  const canFullscreen = !!(
    fullscreenTarget.requestFullscreen ||
    fullscreenTarget.webkitRequestFullscreen ||
    fullscreenTarget.msRequestFullscreen
  );

  const isFullscreen = () =>
    !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );

  const zoomIn = () => box.classList.add("site-lightbox--zoomed");
  const zoomOut = () => box.classList.remove("site-lightbox--zoomed");
  const setFullscreenClass = (value) => box.classList.toggle("site-lightbox--fullscreen", !!value);

  const toggleFullscreen = async () => {
    if (canFullscreen) {
      if (isFullscreen()) {
        await (document.exitFullscreen?.() ||
          document.webkitExitFullscreen?.() ||
          document.msExitFullscreen?.());
        setFullscreenClass(false);
      } else {
        try {
          await (
            fullscreenTarget.requestFullscreen?.() ||
            fullscreenTarget.webkitRequestFullscreen?.() ||
            fullscreenTarget.msRequestFullscreen?.()
          );
          setFullscreenClass(true);
        } catch {
          zoomIn();
          setFullscreenClass(true);
        }
      }
    } else if (box.classList.contains("site-lightbox--zoomed")) {
      zoomOut();
      setFullscreenClass(false);
    } else {
      zoomIn();
      setFullscreenClass(true);
    }
  };

  box.addEventListener("close", () => {
    zoomOut();
    setFullscreenClass(false);
    restoreDocumentState();
  });

  document.addEventListener("fullscreenchange", () => setFullscreenClass(isFullscreen()));

  img?.addEventListener("dblclick", (event) => {
    event.preventDefault();
    toggleFullscreen();
  });

  let lastTap = 0;
  img?.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        event.preventDefault();
        toggleFullscreen();
        lastTap = 0;
      } else {
        lastTap = now;
      }
    },
    { passive: false }
  );

  box.addEventListener("keydown", (event) => {
    if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      toggleFullscreen();
    }
  });

  window.openLB = (src, alt, startIndex) => open(src, alt, startIndex);
  window.closeLB = close;

  log();
}
