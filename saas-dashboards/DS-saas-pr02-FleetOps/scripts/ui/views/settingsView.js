import { FleetPermissions } from "../../core/permissions.js";
import { FleetStore } from "../../state/store.js";
import { dom, escapeHtml, FleetUI } from "../../utils/dom.js";
import { Modal } from "../components/modal.js";
import { Toast } from "../components/toast.js";

function settingsView() {
  const root = dom.h("div");
  const getRoleLabel = FleetPermissions.getRoleLabel;
  const currentRangeDays = FleetStore.state.preferences.dashboardRangeDays || 30;
  const listModules = ["orders", "fleet", "drivers"];
  const defaultListPageSize = 10;
  const expandedListPageSize = 25;
  const hasExpandedListPageSize = () =>
    listModules.every((moduleKey) => Number(FleetStore.state.listPrefs?.[moduleKey]?.pageSize || defaultListPageSize) === expandedListPageSize);
  const hasDenseView = () => Boolean(FleetStore.state.preferences.compact);
  const syncPressedState = (button, pressed) => {
    if (!button) return;
    button.classList.toggle("setting-card__button--active", pressed);
    button.setAttribute("aria-pressed", String(pressed));
  };

  const header = dom.h("div", "module-header");
  header.innerHTML = `
    <div>
      <h2 class="module-header__title">Ustawienia</h2>
      <p class="module-header__meta">Personalizacja, widoki i dane demo</p>
    </div>
  `;

  root.appendChild(header);

  const grid = dom.h("div", "settings-grid");

  const themeCard = dom.h("div", "setting-card");
  themeCard.innerHTML = `
    <h3 class="setting-card__title">Motyw</h3>
    <p class="setting-card__description">Zmień wygląd panelu na jasny lub ciemny</p>
    <div class="setting-card__actions">
      <button class="button setting-card__button ${FleetStore.state.preferences.theme === "light" ? "setting-card__button--active" : ""}" id="lightBtn" aria-pressed="${FleetStore.state.preferences.theme === "light"}">Jasny</button>
      <button class="button setting-card__button ${FleetStore.state.preferences.theme === "dark" ? "setting-card__button--active" : ""}" id="darkBtn" aria-pressed="${FleetStore.state.preferences.theme === "dark"}">Ciemny</button>
    </div>
  `;
  grid.appendChild(themeCard);

  const compactCard = dom.h("div", "setting-card");
  compactCard.innerHTML = `
    <h3 class="setting-card__title">Tryb kompaktowy</h3>
    <p class="setting-card__description">Zmniejsza odstępy w panelu operacyjnym</p>
    <label class="setting-card__toggle">
      <input class="setting-card__toggle-input" type="checkbox" id="compactToggle" ${FleetStore.state.preferences.compact ? "checked" : ""} />
      <span class="setting-card__toggle-control" aria-hidden="true"></span>
      <span class="setting-card__toggle-text">Włącz tryb kompaktowy</span>
    </label>
  `;
  grid.appendChild(compactCard);

  const startCard = dom.h("div", "setting-card");
  startCard.innerHTML = `
    <h3 class="setting-card__title">Szybki start</h3>
    <p class="setting-card__description">Przejdź do najważniejszych widoków operacyjnych</p>
    <div class="setting-card__actions">
      <button class="button setting-card__button" data-route="#/app">Przegląd</button>
      <button class="button setting-card__button" data-route="#/app/orders">Zlecenia</button>
      <button class="button setting-card__button" data-route="#/app/fleet">Flota</button>
    </div>
  `;
  grid.appendChild(startCard);

  const rangeCard = dom.h("div", "setting-card");
  rangeCard.innerHTML = `
    <h3 class="setting-card__title">Zakres przeglądu</h3>
    <p class="setting-card__description">Ustaw domyślny zakres danych w przeglądzie KPI</p>
    <div class="setting-card__actions">
      <button class="button setting-card__button ${currentRangeDays === 7 ? "setting-card__button--active" : ""}" type="button" data-range-days="7" aria-pressed="${currentRangeDays === 7}">7 dni</button>
      <button class="button setting-card__button ${currentRangeDays === 30 ? "setting-card__button--active" : ""}" type="button" data-range-days="30" aria-pressed="${currentRangeDays === 30}">30 dni</button>
      <button class="button setting-card__button ${currentRangeDays === 90 ? "setting-card__button--active" : ""}" type="button" data-range-days="90" aria-pressed="${currentRangeDays === 90}">90 dni</button>
    </div>
  `;
  grid.appendChild(rangeCard);

  // Alert preferences have no state field, no persistence and no consumer, so
  // these checks never configured anything - every render rebuilt them checked.
  // They stay visible as demo chrome but are natively disabled with an
  // explanatory title, the same honest treatment the topbar alerts button and
  // the orders CSV export use. Nothing is written, so nothing claims a save.
  const alertsCard = dom.h("div", "setting-card");
  const alertsUnavailableNote = "Konfiguracja alertów jest niedostępna w wersji demo";
  alertsCard.innerHTML = `
    <h3 class="setting-card__title">Alerty operacyjne</h3>
    <p class="setting-card__description">${alertsUnavailableNote}</p>
    <div class="setting-card__checks">
      <label class="setting-card__check" title="${alertsUnavailableNote}">
        <input class="setting-card__check-input" type="checkbox" checked disabled />
        <span class="setting-card__check-control" aria-hidden="true"></span>
        <span class="setting-card__check-text">Opóźnienia</span>
      </label>
      <label class="setting-card__check" title="${alertsUnavailableNote}">
        <input class="setting-card__check-input" type="checkbox" checked disabled />
        <span class="setting-card__check-control" aria-hidden="true"></span>
        <span class="setting-card__check-text">Serwis floty</span>
      </label>
      <label class="setting-card__check" title="${alertsUnavailableNote}">
        <input class="setting-card__check-input" type="checkbox" checked disabled />
        <span class="setting-card__check-control" aria-hidden="true"></span>
        <span class="setting-card__check-text">Pilne zlecenia</span>
      </label>
    </div>
  `;
  grid.appendChild(alertsCard);

  const tableCard = dom.h("div", "setting-card");
  tableCard.innerHTML = `
    <h3 class="setting-card__title">Tabele i listy</h3>
    <p class="setting-card__description">Ustaw preferowany sposób przeglądania danych</p>
    <div class="setting-card__actions">
      <button class="button setting-card__button ${hasExpandedListPageSize() ? "setting-card__button--active" : ""}" type="button" data-list-page-size="${expandedListPageSize}" aria-pressed="${hasExpandedListPageSize()}">25 wierszy</button>
      <button class="button setting-card__button ${hasDenseView() ? "setting-card__button--active" : ""}" type="button" data-dense-list aria-pressed="${hasDenseView()}">Gęsty widok</button>
    </div>
  `;
  grid.appendChild(tableCard);

  const resetCard = dom.h("div", "setting-card");
  resetCard.innerHTML = `
    <h3 class="setting-card__title">Reset demo</h3>
    <p class="setting-card__description">Przywraca dane demo i preferencje interfejsu do stanu początkowego</p>
    <div class="setting-card__actions">
      <button class="button setting-card__button" type="button" id="resetDemo">Resetuj</button>
    </div>
  `;
  grid.appendChild(resetCard);

  const accountCard = dom.h("div", "setting-card");
  const user = FleetStore.state.auth.user || { name: "Użytkownik demo", email: "demo@fleetops.app" };
  const currentUser = FleetStore.state.currentUser || FleetPermissions.defaultUser;
  const safeRoleLabel = escapeHtml(getRoleLabel(currentUser?.role));

  accountCard.innerHTML = `
    <h3 class="setting-card__title">Konto</h3>
    <p class="setting-card__description">Dane aktualnego użytkownika demo</p>
    <dl class="setting-card__details">
      <div class="setting-card__detail">
        <dt class="setting-card__detail-label">Nazwa</dt>
        <dd class="setting-card__detail-value">${escapeHtml(user.name)}</dd>
      </div>
      <div class="setting-card__detail">
        <dt class="setting-card__detail-label">E-mail</dt>
        <dd class="setting-card__detail-value">${escapeHtml(user.email)}</dd>
      </div>
      <div class="setting-card__detail">
        <dt class="setting-card__detail-label">Rola</dt>
        <dd class="setting-card__detail-value">${safeRoleLabel}</dd>
      </div>
      <div class="setting-card__detail">
        <dt class="setting-card__detail-label">ID</dt>
        <dd class="setting-card__detail-value">${escapeHtml(currentUser ? currentUser.id : "u_admin_1")}</dd>
      </div>
    </dl>
  `;
  grid.appendChild(accountCard);

  root.appendChild(grid);

  themeCard.querySelector("#lightBtn").addEventListener("click", () => FleetStore.setTheme("light"));
  themeCard.querySelector("#darkBtn").addEventListener("click", () => FleetStore.setTheme("dark"));

  const compactToggle = compactCard.querySelector("#compactToggle");
  const pageSizeButton = tableCard.querySelector("[data-list-page-size]");
  const denseListButton = tableCard.querySelector("[data-dense-list]");
  const syncDenseControls = () => {
    const isDense = hasDenseView();
    if (compactToggle) compactToggle.checked = isDense;
    syncPressedState(denseListButton, isDense);
  };
  const syncPageSizeControl = () => {
    syncPressedState(pageSizeButton, hasExpandedListPageSize());
  };

  compactToggle.addEventListener("change", (e) => {
    FleetStore.setCompact(e.target.checked);
    syncDenseControls();
  });

  startCard.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.hash = button.dataset.route;
    });
  });

  rangeCard.querySelectorAll("[data-range-days]").forEach((button) => {
    button.addEventListener("click", () => {
      const dashboardRangeDays = Number(button.dataset.rangeDays);

      if (typeof FleetStore.setDashboardRange === "function") {
        FleetStore.setDashboardRange(dashboardRangeDays);
      } else if (typeof FleetStore.setState === "function") {
        FleetStore.setState({
          preferences: {
            ...FleetStore.state.preferences,
            dashboardRangeDays,
          },
        });
      }

      Toast.show(`Zakres przeglądu ustawiony na ${dashboardRangeDays} dni`, "success");
      window.location.hash = "#/app";
    });
  });

  pageSizeButton?.addEventListener("click", () => {
    const nextPageSize = hasExpandedListPageSize() ? defaultListPageSize : expandedListPageSize;
    listModules.forEach((moduleKey) => {
      FleetStore.setListPrefs(moduleKey, {
        pageSize: nextPageSize,
        visibleCount: nextPageSize,
      });
    });
    syncPageSizeControl();
    Toast.show(`Listy pokazują teraz ${nextPageSize} wierszy`, "success");
  });

  denseListButton?.addEventListener("click", () => {
    const nextDense = !hasDenseView();
    FleetStore.setCompact(nextDense);
    syncDenseControls();
    Toast.show(nextDense ? "Gęsty widok list włączony" : "Gęsty widok list wyłączony", "success");
  });

  resetCard.querySelector("#resetDemo").addEventListener("click", () => {
    const body = dom.h("div");
    body.innerHTML = `
      <p>Czy na pewno zresetować demo? Tej operacji nie można cofnąć.</p>
      <p>Do stanu początkowego wrócą:</p>
      <ul class="modal-scope-list">
        <li>zlecenia, pojazdy i kierowcy - razem z rekordami dodanymi w demo</li>
        <li>historia aktywności</li>
        <li>filtry oraz preferencje list i tabel</li>
        <li>motyw i tryb kompaktowy</li>
        <li>zakres przeglądu</li>
      </ul>
      <p>Bez zmian pozostaną aktualna sesja i wybrana rola.</p>
      <div class="modal-actions modal-actions--confirm">
        <button class="button button--ghost" type="button" data-modal-cancel>Anuluj</button>
        <button class="button button--primary" type="button" data-modal-confirm>Resetuj dane demo</button>
      </div>
    `;

    body.querySelector("[data-modal-cancel]").addEventListener("click", (e) => {
      e.preventDefault();
      Modal.close();
    });

    body.querySelector("[data-modal-confirm]").addEventListener("click", (e) => {
      e.preventDefault();
      FleetStore.resetDemo();
      syncPageSizeControl();
      syncDenseControls();
      Toast.show("Demo przywrócone do stanu początkowego", "success");
      Modal.close();
      window.location.hash = "#/app";
    });

    Modal.open({ title: "Potwierdzenie resetu demo", body });
  });

  return root;
}

export { settingsView };
