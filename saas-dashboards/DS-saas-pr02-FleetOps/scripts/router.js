import { FleetStore } from "./state/store.js";
import { Toast } from "./ui/components/toast.js";
import { renderAppShell } from "./ui/layoutApp.js";
import { dashboardView } from "./ui/views/dashboardView.js";
import { driversView } from "./ui/views/driversView.js";
import { fleetView } from "./ui/views/fleetView.js";
import { notFoundView } from "./ui/views/notFoundView.js";
import { ordersView } from "./ui/views/ordersView.js";
import { reportsView } from "./ui/views/reportsView.js";
import { settingsView } from "./ui/views/settingsView.js";
import { CleanupRegistry } from "./utils/cleanup.js";
import { FleetStorage } from "./utils/storage.js";

function renderLogin() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <main class="login-page" id="main-content">
      <div class="login-card">
        <div class="login-card__topbar">
          <div class="login-card__logo">
            <img class="login-card__logo-icon" src="${FleetStore.state.preferences.theme === "dark" ? "assets/logos/logo-white.svg" : "assets/logos/logo-black.svg"}" data-theme-src-light="assets/logos/logo-black.svg" data-theme-src-dark="assets/logos/logo-white.svg" alt="FleetOps logo" />
            <span class="login-card__brand">FleetOps</span>
          </div>
          <a class="button button--ghost login-card__back" href="/">Wróć</a>
        </div>
        <div class="login-card__header">
          <h1 class="login-card__title">Zaloguj się</h1>
          <p class="login-card__lead">Logowanie demo — dane są zapisywane lokalnie w przeglądarce.</p>
        </div>
        <form id="loginForm" class="login-form">
          <label class="form-control">
            <span class="label">E-mail</span>
            <input required type="email" name="email" class="input" placeholder="you@fleetops.app" />
          </label>
          <label class="form-control">
            <span class="label">Hasło</span>
            <input required minlength="4" type="password" name="password" class="input" placeholder="••••••" />
          </label>
          <div class="login-form__actions">
            <button class="button button--primary" type="submit">Zaloguj się</button>
            <button class="button button--secondary" type="button" id="demoLogin">Kontynuuj jako demo</button>
          </div>
        </form>
      </div>
    </main>
  `;

  const form = document.getElementById("loginForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.email.value;
    const password = form.password.value;
    if (!email || password.length < 4) {
      Toast.show("Podaj email i hasło (min 4 znaki)", "warning", { assertive: true });
      return;
    }
    const name = email.split("@")[0];
    FleetStore.login({ email, name });
    Toast.show("Zalogowano", "success");
    const returnTo = sessionStorage.getItem("auth:returnTo");
    if (returnTo) sessionStorage.removeItem("auth:returnTo");
    window.location.hash = returnTo || "#/app";
  });

  document.getElementById("demoLogin").addEventListener("click", () => {
    FleetStore.login({ email: "demo@fleetops.app", name: "Demo User" });
    const returnTo = sessionStorage.getItem("auth:returnTo");
    if (returnTo) sessionStorage.removeItem("auth:returnTo");
    window.location.hash = returnTo || "#/app";
  });
}

// === Dynamic aria-current (global) ===
function applyAriaCurrent() {
  const currentHash = window.location.hash || "#/";
  const normalizedHash = currentHash === "#" ? "#/" : currentHash;

  const updateGroup = (groupLinks) => {
    let matched = false;
    groupLinks.forEach((link) => {
      const href = link.getAttribute("href");
      const isMatch = href === normalizedHash;
      if (isMatch) {
        link.setAttribute("aria-current", "page");
        matched = true;
      } else {
        link.removeAttribute("aria-current");
      }
    });
    return matched;
  };

  const navLinks = document.querySelectorAll(".site-header__links a");
  const hasNavMatch = updateGroup(navLinks);

  const homeLogo = document.querySelector('.site-header__brand[data-scroll-top="home"]');
  if (homeLogo) {
    if (!hasNavMatch && normalizedHash === "#/") {
      homeLogo.setAttribute("aria-current", "page");
    } else {
      homeLogo.removeAttribute("aria-current");
    }
  }

  updateGroup(document.querySelectorAll(".sidebar nav a"));
}

const routeLabels = {
  "/login": "Logowanie",
  "/app": "Przegląd",
  "/app/orders": "Zlecenia",
  "/app/fleet": "Flota",
  "/app/drivers": "Kierowcy",
  "/app/reports": "Raporty",
  "/app/settings": "Ustawienia",
};

let lastAnnouncedPath = "";
let routeAnnounceTimer = null;
let lastScrolledPath = "";

function announceRouteChange(path, label) {
  if (!label || path === lastAnnouncedPath) return;

  const region = document.getElementById("fleetops-route-status");
  if (!region) return;

  lastAnnouncedPath = path;
  if (routeAnnounceTimer) window.clearTimeout(routeAnnounceTimer);
  region.textContent = "";
  routeAnnounceTimer = window.setTimeout(() => {
    region.textContent = `Widok: ${label}`;
  }, 0);
}

function scrollRouteToTop(path) {
  if (!path || path === lastScrolledPath) return;

  lastScrolledPath = path;
  const resetElementScroll = (element) => {
    if (!element) return;

    if (typeof element.scrollTo === "function") {
      try {
        element.scrollTo({ top: 0, left: 0, behavior: "auto" });
        return;
      } catch (e) {
        element.scrollTo(0, 0);
        return;
      }
    }

    if ("scrollTop" in element) element.scrollTop = 0;
    if ("scrollLeft" in element) element.scrollLeft = 0;
  };

  const run = () => {
    if (typeof window.scrollTo === "function") {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch (e) {
        window.scrollTo(0, 0);
      }
    }

    const scrollTargets = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      document.getElementById("app"),
      document.querySelector("main"),
      document.querySelector(".app-main"),
    ];

    scrollTargets.forEach(resetElementScroll);
  };

  run();

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(run);
  } else {
    window.setTimeout(run, 0);
  }
}

function routeTo(hash) {
  const returnToKey = "auth:returnTo";
  const path = hash.replace("#", "") || "/";
  const requiresAuth = path.startsWith("/app");
  const renderedPath = path;
  let renderedLabel = routeLabels[path];

  CleanupRegistry.runAll();

  if (requiresAuth && !FleetStore.state.auth.isAuthenticated) {
    const targetHash = hash || window.location.hash || "#/app";
    try {
      sessionStorage.setItem(returnToKey, targetHash);
    } catch (e) {
      console.warn("ReturnTo storage error", e);
    }
    window.location.hash = "#/login";
    return;
  }

  if (path.startsWith("/app")) {
    FleetStorage.set("fleet-last-route", path);
  }

  switch (path) {
    case "/login":
      renderLogin();
      break;
    case "/app":
      renderAppShell("Przegląd", dashboardView(), { routeTo });
      break;
    case "/app/orders":
      renderAppShell("Zlecenia", ordersView(), { routeTo });
      break;
    case "/app/fleet":
      renderAppShell("Flota", fleetView(), { routeTo });
      break;
    case "/app/drivers":
      renderAppShell("Kierowcy", driversView(), { routeTo });
      break;
    case "/app/reports":
      renderAppShell("Raporty", reportsView(), { routeTo });
      break;
    case "/app/settings":
      renderAppShell("Ustawienia", settingsView(), { routeTo });
      break;
    default:
      if (path.startsWith("/app")) {
        renderedLabel = "Nie znaleziono";
        renderAppShell("Nie znaleziono", notFoundView(), { routeTo });
      } else {
        // Public pages are static documents, not hash routes: anything that is
        // neither `/login` nor an `/app` route belongs to the public site.
        window.location.replace("/");
        return;
      }
  }

  // <<< TO JEST JEDYNE MIEJSCE, GDZIE USTAWIAMY aria-current >>>
  applyAriaCurrent();
  announceRouteChange(renderedPath, renderedLabel);
  scrollRouteToTop(renderedPath);
}

const FleetRouter = { routeTo };

export { FleetRouter, routeTo };
