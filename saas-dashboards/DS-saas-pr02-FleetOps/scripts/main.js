/**
 * FleetOps runtime entry point.
 *
 * Every maintained HTML document loads this single module. It owns the
 * bootstrap sequence that the previous ordered `<script defer>` list performed
 * implicitly; module imports below make that order explicit.
 */
import { FleetStore } from "./state/store.js";
import { Toast } from "./ui/components/toast.js";
import { initLandingShell } from "./ui/layoutLanding.js";
import { getMotionSafeScrollBehavior } from "./utils/dom.js";

(function init() {
  const publicHashRedirects = {
    "#/": "/",
    "#/product": "/product/",
    "#/features": "/features/",
    "#/pricing": "/pricing/",
    "#/about": "/about/",
    "#/contact": "/contact/",
    "#/security": "/security/",
    "#/careers": "/careers/",
    "#/privacy": "/privacy/",
    "#/terms": "/terms/",
    "#/cookies": "/cookies/",
  };

  const normalizeHash = () => {
    const hash = window.location.hash || "";
    return hash === "#" ? "" : hash;
  };

  const isDynamicHash = (hash) => hash === "#/login" || hash === "#/app" || hash.startsWith("#/app/");

  let applicationRouterPromise;
  let latestRouteRequest = 0;

  const loadApplicationRouter = () => {
    applicationRouterPromise ||= import("./router.js");
    return applicationRouterPromise;
  };

  const redirectLegacyPublicHash = (hash) => {
    if (!hash) return false;

    const target = publicHashRedirects[hash];
    if (target) {
      window.location.replace(target);
      return true;
    }

    if (hash.startsWith("#/") && !isDynamicHash(hash)) {
      window.location.replace("/");
      return true;
    }

    return false;
  };

  const normalizePath = (path) => {
    if (!path || path === "/") return "/";
    return path.endsWith("/") ? path : `${path}/`;
  };

  const applyStaticAriaCurrent = () => {
    const currentPath = normalizePath(window.location.pathname);
    const links = document.querySelectorAll(".site-header__brand, .site-header__links a, .footer__logo, .footer__list a, .footer__legal-list a");

    links.forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!href || href.includes("#/")) {
        link.removeAttribute("aria-current");
        return;
      }

      const url = new URL(href, window.location.origin);
      if (url.origin === window.location.origin && normalizePath(url.pathname) === currentPath) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  // Netlify Forms ingests submissions posted to the site itself, so the enhanced
  // path stays same-origin and needs no endpoint of the project's own. The
  // provider accepts URL-encoded bodies only, and the form identifier travels in
  // the body through the hidden `form-name` field declared in the document.
  const CONTACT_ENDPOINT = "/";
  const CONTACT_ENCODING = "application/x-www-form-urlencoded";

  const bindStaticContactForm = () => {
    const form = document.getElementById("contactForm");
    if (!form) return;

    const submitButton = form.querySelector('button[type="submit"]');
    const idleLabel = submitButton ? submitButton.textContent : "";
    let pending = false;

    const setPending = (isPending) => {
      pending = isPending;
      form.setAttribute("aria-busy", isPending ? "true" : "false");
      if (!submitButton) return;
      submitButton.disabled = isPending;
      submitButton.textContent = isPending ? "Wysyłanie…" : idleLabel;
    };

    form.addEventListener("submit", (event) => {
      // Replacing the native navigation is an enhancement: the document keeps
      // `method="POST"` and the Netlify metadata, so a browser that never runs
      // this handler still submits the form natively to the same provider.
      event.preventDefault();

      // One request at a time. The disabled control already blocks the pointer
      // path; this also covers a submit reaching the form by any other route.
      if (pending) return;

      if (!form.checkValidity()) {
        form.reportValidity();
        Toast.show("Uzupełnij wymagane pola.", "warning", { assertive: true });
        return;
      }

      setPending(true);

      fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": CONTACT_ENCODING },
        body: new URLSearchParams(new FormData(form)).toString(),
      })
        .then((response) => {
          // Only a successful response proves the provider accepted the
          // submission. A fulfilled request carrying an error status is a
          // failure, so it must not reach the confirmation below.
          if (!response.ok) {
            throw new Error(`Contact form submission rejected with HTTP ${response.status}`);
          }

          // The values are cleared only once sending is confirmed; the
          // acknowledgement checkbox is reset with them.
          form.reset();
          Toast.show("Wiadomość została wysłana.", "success");
        })
        .catch((error) => {
          // A rejected request and an error status land here alike. The typed
          // values are deliberately left in place so the message is not lost,
          // and the published channels stay the stated alternative.
          console.warn("[FleetOps] Contact form submission failed", error);
          Toast.show(
            "Nie udało się potwierdzić wysłania wiadomości. Spróbuj ponownie lub napisz na kontakt@kp-code.pl albo zadzwoń +48 533 537 091.",
            "warning",
            { assertive: true }
          );
        })
        .finally(() => setPending(false));
    });
  };

  const bindStaticLegalNav = () => {
    document.querySelectorAll(".legal-nav__link").forEach((link) => {
      link.addEventListener("click", (event) => {
        const href = link.getAttribute("href") || "";
        if (!href.startsWith("#")) return;

        const target = document.getElementById(href.slice(1));
        if (!target) return;

        event.preventDefault();
        const behavior = getMotionSafeScrollBehavior();

        target.scrollIntoView({ behavior, block: "start" });
        target.focus({ preventScroll: true });
      });
    });
  };

  const initStaticPublicPage = () => {
    initLandingShell();
    applyStaticAriaCurrent();
    bindStaticContactForm();
    bindStaticLegalNav();
  };

  const handleHashRoute = () => {
    const requestId = ++latestRouteRequest;
    const hash = normalizeHash();
    if (redirectLegacyPublicHash(hash)) return true;
    if (isDynamicHash(hash)) {
      void loadApplicationRouter()
        .then(({ FleetRouter }) => {
          if (requestId !== latestRouteRequest || normalizeHash() !== hash) return;
          FleetRouter.routeTo(hash);
        })
        .catch((error) => {
          if (requestId !== latestRouteRequest || normalizeHash() !== hash) return;
          console.warn("[FleetOps] Application runtime failed to load", error);
        });
      return true;
    }
    return false;
  };

  FleetStore.initDomain();
  FleetStore.initActivity();

  FleetStore.initTheme();
  if (FleetStore.state.preferences.compact) {
    document.body.dataset.compact = "true";
  }

  const syncOnlineStatus = () => {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    FleetStore.setOnlineStatus(isOnline);
  };

  const registerServiceWorker = () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // The service worker caches `.js`/`.css` responses, which would serve stale
    // modules back to the Vite dev server. Production registration is unchanged;
    // during development any previously installed worker is removed instead.
    if (import.meta.env.DEV) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("[FleetOps] Service worker registration failed", error);
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  };

  window.addEventListener("online", syncOnlineStatus);
  window.addEventListener("offline", syncOnlineStatus);
  syncOnlineStatus();

  window.addEventListener("hashchange", handleHashRoute);

  const initialHash = normalizeHash();
  if (!initialHash || !handleHashRoute()) initStaticPublicPage();

  registerServiceWorker();
})();
