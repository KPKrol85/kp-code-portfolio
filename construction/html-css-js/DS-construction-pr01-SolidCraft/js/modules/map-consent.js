"use strict";

function initMapConsent() {
  const mapContainer = document.querySelector("[data-map-src]");
  if (!mapContainer) return;

  const mapSrc = mapContainer.dataset.mapSrc;
  const placeholder = mapContainer.querySelector(".map-placeholder");
  const loadBtn = mapContainer.querySelector(".map-load-btn");
  const storageKey = "consent.maps";

  const loadMap = () => {
    if (!mapSrc || mapContainer.querySelector("iframe")) return;

    const iframe = document.createElement("iframe");
    iframe.title = "Mapa dojazdu — przykładowa lokalizacja Tarnów";
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    iframe.setAttribute("allowfullscreen", "");
    iframe.src = mapSrc;

    if (placeholder) placeholder.remove();
    mapContainer.appendChild(iframe);
  };

  try {
    if (localStorage.getItem(storageKey) === "true") loadMap();
  } catch {}

  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      try {
        localStorage.setItem(storageKey, "true");
      } catch {}
      loadMap();
    });
  }
}

export { initMapConsent };
