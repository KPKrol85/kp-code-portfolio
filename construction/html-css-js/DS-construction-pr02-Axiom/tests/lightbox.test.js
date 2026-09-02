// PH4-02 — focused coverage for js/components/lightbox.js.
//
// The suite drives the real module through a minimal but realistic copy of the
// gallery and lightbox markup from index.html and only asserts observable
// behavior: attributes, focus, and the displayed image and caption.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { initLightbox } from "../js/components/lightbox.js";

const GALLERY_ITEMS = [
  { href: "assets/img/realizacje/remont-02-1600x1067.jpg", alt: "Remont mieszkania" },
  { href: "assets/img/realizacje/budowa-domu-05-1600x1067.jpg", alt: "Budowa domu" },
  { href: "assets/img/realizacje/poddasze-03-1600x1067.jpg", alt: "Adaptacja poddasza" },
];

const galleryItemMarkup = (item) => `
  <figure class="gallery__item">
    <a class="gallery__link" href="${item.href}">
      <img src="${item.href}" alt="${item.alt}" width="1200" height="800" loading="lazy" decoding="async" />
    </a>
  </figure>
`;

const GALLERY_FIXTURE = `
  <button type="button" id="outsideControl">Poza lightboxem</button>
  <section class="gallery">
    <div class="gallery__container">
      ${GALLERY_ITEMS.map(galleryItemMarkup).join("")}
    </div>
  </section>
  <div class="lb" id="lightbox" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="lightbox-title" aria-describedby="lightbox-caption" hidden tabindex="-1">
    <div class="lb__backdrop" data-lb-close aria-hidden="true"></div>
    <figure class="lb__figure">
      <h2 id="lightbox-title" class="sr-only">Podgląd zdjęcia</h2>
      <img class="lb__img" alt="" width="1200" height="800" />
      <figcaption class="lb__caption" id="lightbox-caption"></figcaption>
      <button class="lb__close" type="button" aria-label="Zamknij (Esc)" data-lb-close>&times;</button>
    </figure>
  </div>
`;

// initLightbox() registers document-level listeners, so every listener added
// during initialisation is recorded and removed again after each test. Without
// this, a stale listener from an earlier test would still react to the next
// test's fixture.
const documentAddEventListener = document.addEventListener.bind(document);
const trackedDocumentListeners = [];

const originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");

const mountGallery = () => {
  document.body.className = "";
  document.body.innerHTML = GALLERY_FIXTURE;
  const spy = vi.spyOn(document, "addEventListener").mockImplementation((type, handler, options) => {
    trackedDocumentListeners.push([type, handler, options]);
    documentAddEventListener(type, handler, options);
  });
  initLightbox();
  spy.mockRestore();
  return document.querySelector("#lightbox");
};

const galleryLinks = () => Array.from(document.querySelectorAll(".gallery__link"));

const openFromGallery = (index) => {
  const link = galleryLinks()[index];
  link.focus();
  link.click();
  return link;
};

const pressKey = (key, init = {}) => {
  const target = document.activeElement || document.body;
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

beforeAll(() => {
  // jsdom performs no layout, so every element reports offsetParent === null.
  // js/utils/a11y.js uses that property to drop non-rendered elements, so the
  // focus trap would otherwise be built from an empty list. This stub reports
  // the layout parent for rendered elements and null inside a [hidden] subtree.
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      for (let node = this; node instanceof HTMLElement; node = node.parentElement) {
        if (node.hasAttribute("hidden")) return null;
      }
      return this.parentElement;
    },
  });
});

afterAll(() => {
  if (originalOffsetParent) Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParent);
});

beforeEach(() => {
  document.body.className = "";
  document.body.innerHTML = "";
});

afterEach(() => {
  while (trackedDocumentListeners.length) {
    const [type, handler, options] = trackedDocumentListeners.pop();
    document.removeEventListener(type, handler, options);
  }
  vi.restoreAllMocks();
  document.body.className = "";
  document.body.innerHTML = "";
});

describe("lightbox opening", () => {
  it("opens on a gallery activation and shows the selected image", () => {
    const lb = mountGallery();

    openFromGallery(1);

    expect(lb.hasAttribute("hidden")).toBe(false);
    expect(lb.getAttribute("aria-hidden")).toBe("false");
    expect(document.body.classList.contains("lb-open")).toBe(true);
    expect(lb.querySelector(".lb__img").getAttribute("src")).toBe(GALLERY_ITEMS[1].href);
    expect(lb.querySelector(".lb__caption").textContent).toBe(GALLERY_ITEMS[1].alt);
    expect(lb.querySelector(".lb__caption").hidden).toBe(false);
  });

  it("moves focus into the lightbox when it opens", () => {
    const lb = mountGallery();

    openFromGallery(0);

    expect(document.activeElement).toBe(lb.querySelector(".lb__close"));
    expect(lb.contains(document.activeElement)).toBe(true);
  });
});

describe("lightbox focus trap", () => {
  it("keeps Tab and Shift+Tab inside the open lightbox", () => {
    const lb = mountGallery();
    openFromGallery(0);
    const closeBtn = lb.querySelector(".lb__close");
    const fsBtn = lb.querySelector(".lb__fs");
    const outsideControl = document.querySelector("#outsideControl");
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab on the first control wraps to the last one instead of leaving.
    pressKey("Tab", { shiftKey: true });

    expect(document.activeElement).toBe(fsBtn);
    expect(lb.contains(document.activeElement)).toBe(true);

    // Tab on the last control wraps back to the first one.
    pressKey("Tab");

    expect(document.activeElement).toBe(closeBtn);
    expect(lb.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(outsideControl);
  });

  it("includes the dynamically created navigation controls in the trap", () => {
    const lb = mountGallery();
    openFromGallery(0);
    const nextBtn = lb.querySelector(".lb__next");
    const prevBtn = lb.querySelector(".lb__prev");
    expect(nextBtn).not.toBeNull();
    expect(prevBtn).not.toBeNull();

    nextBtn.focus();
    pressKey("Tab");

    expect(lb.contains(document.activeElement)).toBe(true);

    prevBtn.focus();
    pressKey("Tab", { shiftKey: true });

    expect(lb.contains(document.activeElement)).toBe(true);
  });
});

describe("lightbox closing", () => {
  it("returns focus to the gallery item that opened it", () => {
    const lb = mountGallery();
    const trigger = openFromGallery(2);
    expect(document.activeElement).not.toBe(trigger);

    lb.querySelector(".lb__close").click();

    expect(document.activeElement).toBe(trigger);
    expect(lb.getAttribute("aria-hidden")).toBe("true");
    expect(lb.hasAttribute("hidden")).toBe(true);
    expect(document.body.classList.contains("lb-open")).toBe(false);
  });

  it("returns focus to the gallery item after closing with Escape", () => {
    const lb = mountGallery();
    const trigger = openFromGallery(0);

    pressKey("Escape");

    expect(document.activeElement).toBe(trigger);
    expect(lb.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("lightbox keyboard navigation", () => {
  it("advances to the next gallery item on ArrowRight", () => {
    const lb = mountGallery();
    openFromGallery(0);
    const img = lb.querySelector(".lb__img");
    const caption = lb.querySelector(".lb__caption");
    expect(img.getAttribute("src")).toBe(GALLERY_ITEMS[0].href);

    pressKey("ArrowRight");

    expect(img.getAttribute("src")).toBe(GALLERY_ITEMS[1].href);
    expect(caption.textContent).toBe(GALLERY_ITEMS[1].alt);

    pressKey("ArrowRight");

    expect(img.getAttribute("src")).toBe(GALLERY_ITEMS[2].href);
    expect(caption.textContent).toBe(GALLERY_ITEMS[2].alt);
  });

  it("goes back to the previous gallery item on ArrowLeft and wraps around", () => {
    const lb = mountGallery();
    openFromGallery(1);
    const img = lb.querySelector(".lb__img");
    expect(img.getAttribute("src")).toBe(GALLERY_ITEMS[1].href);

    pressKey("ArrowLeft");

    expect(img.getAttribute("src")).toBe(GALLERY_ITEMS[0].href);

    pressKey("ArrowLeft");

    expect(img.getAttribute("src")).toBe(GALLERY_ITEMS[GALLERY_ITEMS.length - 1].href);
  });

  it("ignores arrow keys once the lightbox is closed", () => {
    const lb = mountGallery();
    openFromGallery(0);
    const img = lb.querySelector(".lb__img");

    lb.querySelector(".lb__close").click();
    pressKey("ArrowRight");

    expect(img.hasAttribute("src")).toBe(false);
  });
});
