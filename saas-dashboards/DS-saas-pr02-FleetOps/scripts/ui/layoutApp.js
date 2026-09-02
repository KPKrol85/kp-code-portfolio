import { FleetPermissions } from "../core/permissions.js";
import { FleetStore } from "../state/store.js";
import { CleanupRegistry } from "../utils/cleanup.js";
import { dom, FleetUI } from "../utils/dom.js";
import { format } from "../utils/format.js";
import { Dropdown } from "./components/dropdown.js";
import { Toast } from "./components/toast.js";

function renderAppShell(viewTitle, contentNode, { routeTo } = {}) {
  const app = document.getElementById("app");
  const { auth, preferences } = FleetStore.state;
  const currentUser = FleetStore.state.currentUser || FleetPermissions.defaultUser;
  const demoUsers = FleetPermissions.DemoUsers;
  const getRoleLabel = FleetPermissions.getRoleLabel;
  const escapeHtml = FleetUI.escapeHtml;

  const theme = preferences.theme || "light";
  document.documentElement.setAttribute("data-theme", theme);

  const initials = escapeHtml(auth.user ? format.avatarInitials(auth.user.name || auth.user.email) : "FO");
  const safeUserEmail = escapeHtml(auth.user ? auth.user.email : "użytkownik demo");
  const safeUserName = escapeHtml(auth.user ? auth.user.name : "Użytkownik demo");
  const safeRoleLabel = escapeHtml(getRoleLabel(currentUser?.role));
  const safeViewTitle = escapeHtml(viewTitle);
  const roleOptions = demoUsers
    .map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.displayName || user.role)}</option>`)
    .join("");

  const shell = dom.h("div", "app-shell");

  const appTopbar = dom.h("div", "app-topbar");
  appTopbar.innerHTML = `
    <a class="app-topbar__brand" href="#/app" aria-label="FleetOps - Panel" data-scroll-top="app">
      <img class="logo__icon" src="${theme === "dark" ? "assets/logos/logo-white.svg" : "assets/logos/logo-black.svg"}" data-theme-src-light="assets/logos/logo-black.svg" data-theme-src-dark="assets/logos/logo-white.svg" alt="FleetOps logo" />
      <span class="app-topbar__brand-name">FleetOps</span>
    </a>
    <div class="app-topbar__actions">
      <button class="button button--ghost theme-toggle" id="themeToggleMobile" type="button" aria-label="Przełącz motyw">
        <svg class="theme-toggle__icon theme-toggle__icon--light" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="4" fill="currentColor"></circle>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        <svg class="theme-toggle__icon theme-toggle__icon--dark" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M20 12.5A7.5 7.5 0 1 1 11.5 4a6 6 0 0 0 8.5 8.5Z" fill="currentColor"></path>
        </svg>
      </button>
      <button class="button button--ghost app-topbar__menu-button" id="drawerToggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="appDrawer">
        <span class="menu-toggle-icon" aria-hidden="true">
          <span class="menu-toggle-icon__line menu-toggle-icon__line--top"></span>
          <span class="menu-toggle-icon__line menu-toggle-icon__line--middle"></span>
          <span class="menu-toggle-icon__line menu-toggle-icon__line--bottom"></span>
        </span>
      </button>
    </div>
  `;
  shell.appendChild(appTopbar);

  const drawerBackdrop = dom.h("div", "drawer-backdrop");
  drawerBackdrop.setAttribute("aria-hidden", "true");
  shell.appendChild(drawerBackdrop);

  const sidebar = dom.h("aside", "sidebar drawer");
  sidebar.setAttribute("id", "appDrawer");
  sidebar.setAttribute("aria-label", "Nawigacja aplikacji");
  sidebar.innerHTML = `
    <a class="sidebar__brand" href="#/app" aria-label="FleetOps - Panel" data-scroll-top="app">
      <img class="logo__icon" src="${theme === "dark" ? "assets/logos/logo-white.svg" : "assets/logos/logo-black.svg"}" data-theme-src-light="assets/logos/logo-black.svg" data-theme-src-dark="assets/logos/logo-white.svg" alt="FleetOps logo" />
      <span class="sidebar__brand-name">FleetOps</span>
    </a>
    <nav aria-label="Aplikacja">
      <a href="#/app" data-route="/app">Przegląd</a>
      <a href="#/app/orders" data-route="/app/orders">Zlecenia</a>
      <a href="#/app/fleet" data-route="/app/fleet">Flota</a>
      <a href="#/app/drivers" data-route="/app/drivers">Kierowcy</a>
      <a href="#/app/reports" data-route="/app/reports">Raporty</a>
      <a href="#/app/settings" data-route="/app/settings">Ustawienia</a>
    </nav>
    <div class="sidebar__footer">
  <div class="sidebar__meta">
    Konto: <span class="sidebar__meta-name">${safeUserName}</span>
  </div>
  <div class="sidebar__meta">
    Email: <span class="sidebar__meta-value">${safeUserEmail}</span>
  </div>
  <div class="sidebar__meta">
    Rola: <span class="sidebar__meta-value">${safeRoleLabel}</span>
  </div>
</div>
  `;
  shell.appendChild(sidebar);

  const main = dom.h("div", "app-main");
  const topbar = dom.h("div", "topbar");
  topbar.innerHTML = `
    <div class="topbar-left">
      <h1 class="topbar__title">${safeViewTitle}</h1>
      <!-- Global search is not a FleetOps feature. The control stays visible as demo
           chrome but is natively disabled with an explanatory title, the same honest
           treatment the orders CSV export uses. -->
      <div class="search"><input aria-label="Szukaj" type="search" placeholder="Szukaj..." title="Wyszukiwanie globalne jest niedostępne w wersji demo" disabled /></div>
    </div>
    <div class="topbar-actions">
      <label class="role-switcher">
        <span class="role-switcher__label">Rola</span>
        <select class="input role-switcher__select" id="roleSwitcher" aria-label="Wybierz rolę">
          ${roleOptions}
        </select>
      </label>
      <button class="button button--ghost theme-toggle" id="themeToggle" type="button" aria-label="Przełącz motyw">
        <svg class="theme-toggle__icon theme-toggle__icon--light" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="4" fill="currentColor"></circle>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        <svg class="theme-toggle__icon theme-toggle__icon--dark" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M20 12.5A7.5 7.5 0 1 1 11.5 4a6 6 0 0 0 8.5 8.5Z" fill="currentColor"></path>
        </svg>
      </button>
      <!-- No alerts panel exists; the label no longer promises to open one. -->
      <button class="button button--ghost topbar__notification-button" aria-label="Alerty" type="button" title="Alerty są niedostępne w wersji demo" disabled>Alerty</button>
      <div class="dropdown topbar__user-menu">
        <button class="button button--ghost avatar" id="userMenuBtn" type="button" aria-label="Menu użytkownika" aria-expanded="false" aria-controls="userMenu">${initials}</button>
        <div class="dropdown-menu topbar__user-menu-panel" id="userMenu">
          <div class="dropdown-item topbar__user-menu-item">Konto: <span class="topbar__user-menu-name">${safeUserName}</span></div>
          <div class="dropdown-item topbar__user-menu-item">Rola: ${safeRoleLabel}</div>
          <button class="dropdown-item topbar__user-menu-item topbar__user-menu-logout" id="logoutBtn" type="button">Wyloguj się</button>
        </div>
      </div>
    </div>
  `;
  const offlineBanner = dom.h("div", "offline-banner");
  offlineBanner.setAttribute("role", "status");
  offlineBanner.textContent = "Tryb offline";

  const updateOfflineBanner = () => {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    offlineBanner.hidden = isOnline;
    offlineBanner.classList.toggle("is-visible", !isOnline);
  };
  updateOfflineBanner();
  window.addEventListener("online", updateOfflineBanner);
  window.addEventListener("offline", updateOfflineBanner);
  CleanupRegistry.add(() => {
    window.removeEventListener("online", updateOfflineBanner);
    window.removeEventListener("offline", updateOfflineBanner);
  });

  // === Theme toggle (app) ===
  const themeBtn = topbar.querySelector("#themeToggle");
  const themeBtnMobile = appTopbar.querySelector("#themeToggleMobile");
  const roleSwitcher = topbar.querySelector("#roleSwitcher");

  if (roleSwitcher && currentUser) {
    roleSwitcher.value = currentUser.id;
    roleSwitcher.addEventListener("change", () => {
      const selected = demoUsers.find((user) => user.id === roleSwitcher.value) || currentUser;
      const selectedRoleLabel = getRoleLabel(selected.role);
      FleetStore.setCurrentUser(selected);
      FleetStore.addActivity({
        title: "Rola zmieniona",
        detail: `Rola zmieniona: ${selectedRoleLabel}`,
        time: new Date().toISOString(),
      });
      Toast.show(`Rola zmieniona: ${selectedRoleLabel}`, "success");
      if (typeof routeTo === "function") {
        routeTo(window.location.hash);
      }
    });
  }

  const syncThemeUI = () => {
    const current = FleetStore.state.preferences.theme || "light";
    FleetStore.applyTheme(current);
  };

  syncThemeUI();

  themeBtn.addEventListener("click", () => {
    FleetStore.toggleTheme();
    syncThemeUI();
  });

  if (themeBtnMobile) {
    themeBtnMobile.addEventListener("click", () => {
      FleetStore.toggleTheme();
      syncThemeUI();
    });
  }

  // === Dropdown / logout ===
  topbar.querySelector("#userMenuBtn").addEventListener("click", (e) => {
    const menu = topbar.querySelector("#userMenu");
    Dropdown.toggle(e.currentTarget, menu);
  });

  topbar.querySelector("#logoutBtn").addEventListener("click", () => {
    FleetStore.logout();
    Toast.show("Wylogowano", "success");
    window.location.hash = "#/login";
  });

  main.appendChild(topbar);
  main.appendChild(offlineBanner);

  // The route content region is the shell's `main` landmark and the target of
  // the persistent skip link (`index.html`). `dom.mount` replaces the whole of
  // `#app`, so this stays the document's only `#main-content`. `tabindex="-1"`
  // follows the project's existing fragment-target pattern (the legal document
  // sections) and is what makes the skip link move focus here rather than only
  // scroll.
  const contentWrap = dom.h("main", "app-content");
  contentWrap.id = "main-content";
  contentWrap.setAttribute("tabindex", "-1");
  contentWrap.appendChild(contentNode);
  main.appendChild(contentWrap);

  shell.appendChild(main);
  dom.mount(app, shell);

  const logoCleanup = FleetUI.bindLogoScroll("app", () => shell.querySelector(".app-main"));
  CleanupRegistry.add(logoCleanup);

  // === highlight active nav (class + aria-current) ===
  const currentPath = window.location.hash.replace("#", "") || "/app";
  const links = sidebar.querySelectorAll("nav a[data-route]");

  links.forEach((a) => {
    const isActive = a.dataset.route === currentPath;
    a.classList.toggle("active", isActive);
    if (isActive) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  // === Drawer / mobile nav ===
  const drawerToggle = appTopbar.querySelector("#drawerToggle");
  const firstLink = sidebar.querySelector("nav a");
  let isDrawerOpen = false;

  // Matches the sidebar's own persistent-navigation breakpoint (styles/src/06-app.css `@media (min-width: 1025px)`).
  const desktopNavQuery = window.matchMedia("(min-width: 1025px)");

  const getDrawerFocusables = () => Array.from(
    sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
  );

  const trapDrawerFocus = (event) => {
    if (!isDrawerOpen || event.key !== "Tab") return;
    const focusables = getDrawerFocusables();
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !sidebar.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const applyDrawerAccessibility = () => {
    if (desktopNavQuery.matches) {
      sidebar.removeAttribute("role");
      sidebar.removeAttribute("aria-modal");
      sidebar.removeAttribute("aria-hidden");
    } else {
      sidebar.setAttribute("role", "dialog");
      sidebar.setAttribute("aria-modal", "true");
      sidebar.setAttribute("aria-hidden", String(!isDrawerOpen));
    }
  };

  const syncDrawerUI = () => {
    applyDrawerAccessibility();
    drawerBackdrop.classList.toggle("is-visible", isDrawerOpen);
    sidebar.classList.toggle("is-open", isDrawerOpen);
    drawerToggle.setAttribute("aria-expanded", String(isDrawerOpen));
    document.body.classList.toggle("drawer-open", isDrawerOpen);
    if (isDrawerOpen && firstLink) {
      firstLink.focus();
    }
  };


  const closeDrawer = () => {
    isDrawerOpen = false;
    syncDrawerUI();
    drawerToggle.focus();
  };

  drawerToggle.addEventListener("click", () => {
    isDrawerOpen = !isDrawerOpen;
    syncDrawerUI();
  });

  drawerBackdrop.addEventListener("click", closeDrawer);

  sidebar.querySelectorAll("nav a[data-route]").forEach((link) => {
    link.addEventListener("click", closeDrawer);
  });

  const handleKeydown = (event) => {
    if (event.key === "Escape" && isDrawerOpen) {
      closeDrawer();
      return;
    }
    trapDrawerFocus(event);
  };
  document.addEventListener("keydown", handleKeydown);

  const handleDesktopNavChange = () => {
    if (desktopNavQuery.matches) {
      isDrawerOpen = false;
    }
    syncDrawerUI();
  };
  desktopNavQuery.addEventListener("change", handleDesktopNavChange);

  syncDrawerUI();

  CleanupRegistry.add(() => {
    document.removeEventListener("keydown", handleKeydown);
    desktopNavQuery.removeEventListener("change", handleDesktopNavChange);
  });
}

export { renderAppShell };
