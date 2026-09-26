import { INSTAGRAM_APP_URL, INSTAGRAM_DM_URL, INSTAGRAM_WEB_URL } from "./config.js";

const OPEN_APP_FALLBACK_MS = 900;

const openInstagram = () => {
  const startedAt = Date.now();

  window.location.href = INSTAGRAM_APP_URL;

  window.setTimeout(() => {
    if (document.visibilityState === "visible" && Date.now() - startedAt < OPEN_APP_FALLBACK_MS + 300) {
      window.location.href = INSTAGRAM_DM_URL;
    }
  }, OPEN_APP_FALLBACK_MS);
};

export const initMobileCta = () => {
  const instagramLinks = document.querySelectorAll("[data-instagram-link]");

  if (!instagramLinks.length) {
    return;
  }

  instagramLinks.forEach((link) => {
    link.setAttribute("href", INSTAGRAM_WEB_URL);

    link.addEventListener("click", (event) => {
      const isPrimaryClick = event.button === 0;
      const opensNewContext = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

      if (!isPrimaryClick || opensNewContext) {
        return;
      }

      event.preventDefault();
      openInstagram();
    });
  });
};
