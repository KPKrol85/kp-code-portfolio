const UNAVAILABLE_TEXT = "Nie udało się wczytać zdjęcia.";

export function initLightbox() {
  const html = document.documentElement;
  const hasGalleryLinks = document.querySelector(".gallery__link");
  if (!hasGalleryLinks) return;

  let overlay = document.querySelector(".lb-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "lb-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Podgląd zdjęcia");
    overlay.setAttribute("aria-describedby", "lb-caption");
    overlay.setAttribute("aria-keyshortcuts", "Esc ArrowLeft ArrowRight F");

    const modal = document.createElement("div");
    modal.className = "lb-modal";

    const figure = document.createElement("figure");
    figure.className = "lb-figure";

    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.loading = "eager";

    const status = document.createElement("p");
    status.className = "lb-status";
    status.hidden = true;
    status.textContent = UNAVAILABLE_TEXT;

    const caption = document.createElement("figcaption");
    caption.className = "lb-caption";
    caption.id = "lb-caption";

    const controls = document.createElement("div");
    controls.className = "lb-controls";
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "lb-btn lb-prev";
    prevBtn.setAttribute("aria-label", "Poprzednie zdjęcie");
    prevBtn.setAttribute("title", "Poprzednie zdjęcie");
    prevBtn.textContent = "←";
    const counter = document.createElement("span");
    counter.className = "lb-counter";
    counter.textContent = "1/1";
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "lb-btn lb-next";
    nextBtn.setAttribute("aria-label", "Następne zdjęcie");
    nextBtn.setAttribute("title", "Następne zdjęcie");
    nextBtn.textContent = "→";
    const fullBtn = document.createElement("button");
    fullBtn.type = "button";
    fullBtn.className = "lb-btn lb-full";
    fullBtn.setAttribute("aria-label", "Pełny ekran");
    fullBtn.setAttribute("title", "Pełny ekran");
    fullBtn.textContent = "⤢";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "lb-btn lb-close";
    closeBtn.setAttribute("aria-label", "Zamknij podgląd");
    closeBtn.setAttribute("title", "Zamknij podgląd");
    closeBtn.textContent = "×";
    controls.append(prevBtn, counter, nextBtn, fullBtn, closeBtn);

    const live = document.createElement("div");
    live.className = "visually-hidden";
    live.id = "lb-live";
    live.setAttribute("aria-live", "polite");

    figure.append(img, status, caption);
    modal.append(figure, controls, live);
    overlay.append(modal);
    document.body.appendChild(overlay);
  }

  const imgEl = overlay.querySelector("img");
  const statusEl = overlay.querySelector(".lb-status");
  const captionEl = overlay.querySelector(".lb-caption");
  const closeBtn = overlay.querySelector(".lb-close");
  const prevBtn = overlay.querySelector(".lb-prev");
  const nextBtn = overlay.querySelector(".lb-next");
  const fullBtn = overlay.querySelector(".lb-full");
  const counterEl = overlay.querySelector(".lb-counter");
  const liveEl = overlay.querySelector("#lb-live");
  const pageSections = Array.prototype.slice.call(document.querySelectorAll("header, main, footer"));

  function setPageInert(isInert) {
    /*
     Hide and inactivate background landmarks while dialog is open.
     This keeps assistive tech and keyboard focus inside the lightbox context.
    */
    pageSections.forEach(function (el) {
      if (!el) return;
      if (isInert) {
        try {
          el.setAttribute("inert", "");
        } catch (e) {}
        el.setAttribute("aria-hidden", "true");
      } else {
        try {
          el.removeAttribute("inert");
        } catch (e) {}
        el.removeAttribute("aria-hidden");
      }
    });
  }
  if (fullBtn && !fullBtn.getAttribute("title")) {
    fullBtn.setAttribute("title", "Pełny ekran (F)");
  }

  function getCaptionFromLink(link) {
    if (!link) return "";
    /* Caption source priority keeps content authoring flexible across gallery cards. */
    const dataCap = link.getAttribute("data-lb-caption");
    if (dataCap) return dataCap.trim();
    const fc = link.querySelector("figcaption");
    if (fc && fc.textContent.trim()) return fc.textContent.trim();
    const innerImg = link.querySelector("img");
    if (innerImg && innerImg.alt.trim()) return innerImg.alt.trim();
    return "";
  }

  let group = [];
  let index = 0;
  let lastTrigger = null;
  let groupLabel = "";

  function getGroupLabel(link) {
    const section = link && link.closest("section[aria-labelledby]");
    if (!section) return "";
    const headingId = section.getAttribute("aria-labelledby");
    const heading = headingId && document.getElementById(headingId);
    return heading ? heading.textContent.trim() : "";
  }

  function placeArrows() {
    if (!imgEl || !prevBtn || !nextBtn) return;
    /* In the unavailable state the arrows line up with the message instead of the hidden image. */
    const rect = (imgEl.hidden && statusEl ? statusEl : imgEl).getBoundingClientRect();
    if (!rect || !rect.height) return;
    const mid = rect.top + rect.height / 2;
    prevBtn.style.top = mid + "px";
    nextBtn.style.top = mid + "px";
  }

  function updateCounter(status) {
    const position = index + 1 + "/" + group.length;
    counterEl.textContent = groupLabel ? groupLabel + " · " + position : position;
    if (liveEl) {
      const positionAnnouncement = "Obraz " + (index + 1) + " z " + group.length;
      liveEl.textContent = (groupLabel ? groupLabel + ". " : "") + positionAnnouncement + (status ? ". " + status : groupLabel ? "." : "");
    }
  }
  function getThumbnailSrc(link, failedSrc) {
    /*
     The trigger's thumbnail counts only once it has really loaded a photograph: currentSrc follows the
     <picture>/srcset choice, and the "Brak obrazu" placeholder from initImageFallbacks() is excluded.
    */
    const thumb = link.querySelector("img");
    if (!thumb || thumb.dataset.fallbackApplied || !thumb.complete || !thumb.naturalWidth) return "";
    const src = thumb.currentSrc || thumb.src;
    return src && src !== failedSrc ? src : "";
  }
  function prefetch(i) {
    /* Preload neighboring slides for smoother next/previous navigation. */
    const n = group[i + 1];
    const p = group[i - 1];
    [n, p].forEach((a) => {
      if (a) {
        const im = new Image();
        im.src = a.getAttribute("href");
      }
    });
  }
  function render(i) {
    const a = group[i];
    if (!a) return;
    /*
     Every render resets the error state and binds fresh handlers. Replacing src makes the browser drop
     the previous request's pending load/error events, so these handlers only ever see this image.
    */
    let fallbackTried = false;
    imgEl.classList.remove("is-ready");
    imgEl.hidden = false;
    if (statusEl) statusEl.hidden = true;
    imgEl.onload = function () {
      imgEl.classList.add("is-ready");
      placeArrows();
    };
    imgEl.onerror = function () {
      /* Fall back to the thumbnail once; if that is unusable too, show and announce the message. */
      const thumbSrc = fallbackTried ? "" : getThumbnailSrc(a, imgEl.src);
      fallbackTried = true;
      if (thumbSrc) {
        imgEl.src = thumbSrc;
        return;
      }
      imgEl.hidden = true;
      if (statusEl) statusEl.hidden = false;
      updateCounter(UNAVAILABLE_TEXT);
      placeArrows();
    };
    imgEl.src = a.getAttribute("href");
    captionEl.textContent = getCaptionFromLink(a) || "";
    updateCounter();
    prefetch(i);
    requestAnimationFrame(placeArrows);
  }
  function openFromLink(a) {
    /*
     Build a logical group from data-lightbox and remember trigger
     so focus can be restored to the invoking element on close.
    */
    lastTrigger = a;
    const gName = a.getAttribute("data-lightbox") || "gallery";
    group = Array.prototype.slice.call(document.querySelectorAll(".gallery__link" + (gName ? '[data-lightbox="' + gName + '"]' : "")));
    groupLabel = getGroupLabel(a);
    index = Math.max(0, group.indexOf(a));
    html.classList.add("lb-open");
    render(index);
    requestAnimationFrame(() => closeBtn.focus());

    setPageInert(true);
  }
  function closeLightbox() {
    html.classList.remove("lb-open");
    imgEl.removeAttribute("src");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

    setPageInert(false);
    /* Focus is restored only after the background landmarks are interactive again. */
    if (lastTrigger) lastTrigger.focus();
  }
  function next() {
    index = (index + 1) % group.length;
    render(index);
  }
  function prev() {
    index = (index - 1 + group.length) % group.length;
    render(index);
  }

  document.addEventListener("keydown", (e) => {
    if (!html.classList.contains("lb-open")) return;
    /* Global keyboard shortcuts active only while the dialog is open. */
    if (e.key === "Escape") return void closeLightbox();
    if (e.key === "ArrowRight" || e.key === "PageDown") return void next();
    if (e.key === "ArrowLeft" || e.key === "PageUp") return void prev();
    if (e.key === "Home") {
      index = 0;
      return void render(index);
    }
    if (e.key === "End") {
      index = group.length - 1;
      return void render(index);
    }
    if (e.key.toLowerCase() === "f") {
      if (!document.fullscreenElement) {
        overlay.requestFullscreen && overlay.requestFullscreen();
      } else {
        document.exitFullscreen && document.exitFullscreen();
      }
    }
  });

  window.addEventListener("resize", placeArrows);
  window.addEventListener("orientationchange", placeArrows);
  document.addEventListener("fullscreenchange", placeArrows);

  let touchStartX = 0,
    touchStartY = 0,
    touchStartTime = 0;
  overlay.addEventListener(
    "touchstart",
    function (e) {
      if (!e.changedTouches || !e.changedTouches.length) return;
      const t = e.changedTouches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = Date.now();
    },
    { passive: true }
  );
  overlay.addEventListener(
    "touchend",
    function (e) {
      if (!e.changedTouches || !e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt = Date.now() - touchStartTime;
      /* Horizontal swipe with distance/time threshold to avoid accidental triggers. */
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && dt < 600) {
        if (dx < 0) {
          next();
        } else {
          prev();
        }
      }
    },
    { passive: true }
  );

  document.addEventListener("fullscreenchange", function () {
    html.classList.toggle("is-fullscreen", !!document.fullscreenElement);
  });

  (function initTopZoneHover() {
    let raf = null;
    /* Top-zone hover is suppressed in fullscreen to avoid redundant UI toggles. */
    function updateTopZone(y) {
      if (document.fullscreenElement) return;
      const threshold = 96;
      overlay.classList.toggle("lb-topzone", y <= threshold);
    }
    overlay.addEventListener("mousemove", function (e) {
      const y = e.clientY - overlay.getBoundingClientRect().top;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => updateTopZone(y));
    });
    overlay.addEventListener("mouseleave", function () {
      overlay.classList.remove("lb-topzone");
    });
  })();

  overlay.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    /* Trap Tab navigation inside dialog controls. */
    const focusables = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  });

  closeBtn.addEventListener("click", closeLightbox);
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  fullBtn.addEventListener("click", function () {
    if (!document.fullscreenElement) {
      overlay.requestFullscreen && overlay.requestFullscreen();
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  });

  document.addEventListener("click", (e) => {
    /* Delegated opener supports dynamically rendered gallery links. */
    const a = e.target.closest(".gallery__link");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    openFromLink(a);
  });
  }
