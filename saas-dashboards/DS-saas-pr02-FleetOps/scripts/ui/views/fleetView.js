import { FleetPermissions } from "../../core/permissions.js";
import { FleetStore } from "../../state/store.js";
import { CleanupRegistry } from "../../utils/cleanup.js";
import { clearFormErrors, connectFieldErrors, dom, escapeHtml, FleetUI, setFieldError } from "../../utils/dom.js";
import { format } from "../../utils/format.js";
import { Dropdown } from "../components/dropdown.js";
import { Modal } from "../components/modal.js";
import { RecordDrawer } from "../components/recordDrawer.js";
import { Toast } from "../components/toast.js";

function fleetView() {
  const root = dom.h("div");
  const permissions = FleetPermissions;
  const Actions = permissions.Actions || {};
  const can = permissions.can || (() => true);
  const explainDeny = permissions.explainDeny || (() => "");
  const applyDisabledState = permissions.applyDisabledState || ((el) => el && el.setAttribute("aria-disabled", "false"));
  const guard = permissions.guard || (() => true);
  const getPermissionContext = (record) => ({ user: FleetStore.state.currentUser, record });

  const header = dom.h("div", "module-header");
  header.innerHTML = `
    <div>
      <h2 class="module-header__title">Flota</h2>
      <p class="module-header__meta">Zarządzaj pojazdami</p>
    </div>

    <div class="toolbar">
      <select class="input toolbar__select" id="fleetSortBy" aria-label="Sortuj">
        <option value="id">Rejestracja</option>
        <option value="status">Status</option>
        <option value="lastCheck">Ostatni przegląd</option>
        <option value="type">Typ</option>
      </select>

      <select class="input toolbar__select" id="fleetSortDir" aria-label="Kierunek">
        <option value="asc">Rosnąco</option>
        <option value="desc">Malejąco</option>
      </select>
    </div>
  `;

  root.appendChild(header);

  const fleetActions = dom.h("div", "app-actions");
  fleetActions.innerHTML = `
    <button class="button button--primary app-actions__button" id="addVehicle" type="button">
      Dodaj pojazd
    </button>
  `;

  root.appendChild(fleetActions);

  const filterBar = dom.h("div", "table-filter");

  const statusSelect = dom.h("select");
  statusSelect.id = "fleetStatusFilter";
  statusSelect.name = "status";
  statusSelect.setAttribute("aria-label", "Filtr statusu pojazdu");
  statusSelect.innerHTML = `
    <option value="all">Status: wszystkie</option>
    <option value="available">Dostępny</option>
    <option value="on-route">W trasie</option>
    <option value="maintenance">Serwis</option>`;

  const searchInput = dom.h("input");
  searchInput.id = "fleetSearchFilter";
  searchInput.name = "search";
  searchInput.type = "search";
  searchInput.placeholder = "Szukaj rejestracji / typu";
  searchInput.setAttribute("aria-label", "Szukaj rejestracji lub typu pojazdu");
  searchInput.autocomplete = "off";

  statusSelect.classList.add("input", "table-filter__field");
  searchInput.classList.add("input", "search");

  const filterSelects = dom.h("div", "table-filter__selects");
  filterSelects.appendChild(statusSelect);

  filterBar.appendChild(filterSelects);
  filterBar.appendChild(searchInput);
  root.appendChild(filterBar);

  const cards = dom.h("div", "card-list");
  root.appendChild(cards);

  const loadMoreWrap = dom.h("div", "load-more");
  const loadMoreBtn = dom.h("button", "button button--secondary", "Załaduj więcej");
  loadMoreBtn.type = "button";
  loadMoreWrap.appendChild(loadMoreBtn);
  root.appendChild(loadMoreWrap);

  const filters = FleetStore.state.filters.fleet;
  statusSelect.value = filters.status;
  searchInput.value = filters.search;

  const sortBySelect = header.querySelector("#fleetSortBy");
  const sortDirSelect = header.querySelector("#fleetSortDir");
  const listPrefsFallback = { sortBy: "id", sortDir: "asc", pageSize: 10, visibleCount: 10 };
  const getListPrefs = () => FleetStore.state.listPrefs?.fleet || listPrefsFallback;
  const syncSortControls = () => {
    const prefs = getListPrefs();
    if (sortBySelect) sortBySelect.value = prefs.sortBy || listPrefsFallback.sortBy;
    if (sortDirSelect) sortDirSelect.value = prefs.sortDir || listPrefsFallback.sortDir;
  };

  syncSortControls();
  if (sortBySelect) {
    sortBySelect.addEventListener("change", () => {
      const prefs = getListPrefs();
      FleetStore.setListPrefs("fleet", { sortBy: sortBySelect.value, visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
      renderCards();
    });
  }
  if (sortDirSelect) {
    sortDirSelect.addEventListener("change", () => {
      const prefs = getListPrefs();
      FleetStore.setListPrefs("fleet", { sortDir: sortDirSelect.value, visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
      renderCards();
    });
  }

  let isLoading = true;
  let loadingTimer = null;

  let filterTimer = null;
  const FILTER_DELAY = 160;
  const statusOptions = [
    { value: "available", label: "Dostępny" },
    { value: "on-route", label: "W trasie" },
    { value: "maintenance", label: "Serwis" },
  ];
  const statusOrder = { available: 1, "on-route": 2, maintenance: 3 };
  const getFleetSortValue = (vehicle, sortBy) => {
    if (sortBy === "id") return String(vehicle.id || "").toLowerCase();
    if (sortBy === "status") return statusOrder[vehicle.status] || 99;
    if (sortBy === "lastCheck") return Date.parse(vehicle.lastCheck || "");
    if (sortBy === "type") return String(vehicle.type || "").toLowerCase();
    return String(vehicle.id || "").toLowerCase();
  };
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const buildActivityEntry = (action, vehicle) => {
    const verb = { created: "dodany", updated: "zaktualizowany", deleted: "usunięty" }[action] || "zaktualizowany";
    const detail = vehicle ? `${vehicle.type || "Pojazd"} (${vehicle.id || "nowy"})` : "";
    FleetStore.addActivity({
      title: vehicle && vehicle.id ? `Pojazd ${vehicle.id} ${verb}` : `Pojazd ${verb}`,
      detail,
      time: new Date().toISOString(),
    });
  };

  const startFilterLoading = () => {
    if (filterTimer) clearTimeout(filterTimer);

    isLoading = true;
    renderSkeletonCards();

    filterTimer = setTimeout(() => {
      isLoading = false;
      renderCards();
    }, FILTER_DELAY);
  };

  const renderSkeletonCards = () => {
    loadMoreWrap.style.display = "none";
    cards.innerHTML = `
      ${Array.from({ length: 6 })
        .map(
          () => `
        <div class="panel skeleton-card">
          <div class="flex-between">
            <div class="skeleton line skeleton-line--vehicle-id"></div>
            <div class="skeleton skeleton-pill--vehicle-status"></div>
          </div>

          <div class="skeleton line skeleton-line--vehicle-type"></div>
          <div class="skeleton line skeleton-line--vehicle-driver"></div>
          <div class="skeleton line skeleton-line--vehicle-check"></div>
          <div class="skeleton skeleton-button--vehicle"></div>
        </div>
      `,
        )
        .join("")}
    `;
  };

  const startLoading = () => {
    isLoading = true;
    renderSkeletonCards();

    if (loadingTimer) clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      isLoading = false;
      renderCards();
    }, 180);
  };


  const getVehicleFormValues = (form) => {
    const data = new FormData(form);
    return {
      id: String(data.get("id") || "").trim(),
      type: String(data.get("type") || "").trim(),
      status: String(data.get("status") || "").trim(),
      lastCheck: String(data.get("lastCheck") || "").trim(),
      driver: String(data.get("driver") || "").trim(),
    };
  };

  const validateVehicleForm = (values, { isEdit = false, existingIds = [] } = {}) => {
    const errors = {};
    if (!values.id) errors.id = "Wymagane";
    else if (values.id.length > 20) errors.id = "Maks. 20 znaków";
    else if (!isEdit && existingIds.includes(values.id)) errors.id = "ID pojazdu już istnieje";

    if (!values.type) errors.type = "Wymagane";
    else if (values.type.length > 40) errors.type = "Maks. 40 znaków";

    if (!values.status) errors.status = "Wybierz status";

    if (!values.lastCheck) errors.lastCheck = "Wymagane";
    else if (!datePattern.test(values.lastCheck)) errors.lastCheck = "Format: YYYY-MM-DD";

    if (values.driver.length > 40) errors.driver = "Maks. 40 znaków";
    return errors;
  };

  const openVehicleForm = ({ mode = "add", vehicle = null } = {}) => {
    const isEdit = mode === "edit";
    const form = dom.h("form", "modal-form");
    form.noValidate = true;
    form.innerHTML = `
      <label class="form-control">
        <span class="label">Rejestracja</span>
        <input class="input" name="id" maxlength="20" placeholder="np. GD-5402N" required ${isEdit ? "readonly" : ""} />
        <span class="form-error" data-error-for="id"></span>
      </label>
      <label class="form-control">
        <span class="label">Typ</span>
        <input class="input" name="type" maxlength="40" placeholder="np. Chłodnia" required />
        <span class="form-error" data-error-for="type"></span>
      </label>
      <label class="form-control">
        <span class="label">Status</span>
        <select class="input" name="status" required>
          ${statusOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
        </select>
        <span class="form-error" data-error-for="status"></span>
      </label>
      <label class="form-control">
        <span class="label">Ostatni przegląd</span>
        <input class="input" name="lastCheck" maxlength="10" placeholder="YYYY-MM-DD" required />
        <span class="form-error" data-error-for="lastCheck"></span>
      </label>
      <label class="form-control">
        <span class="label">Kierowca</span>
        <input class="input" name="driver" maxlength="40" placeholder="np. K. Mazur" />
        <span class="form-error" data-error-for="driver"></span>
      </label>
      <div class="modal-actions modal-actions--form">
        <button class="button button--ghost" type="button" data-modal-cancel>Anuluj</button>
        <button class="button button--primary" type="submit">${isEdit ? "Zapisz zmiany" : "Dodaj pojazd"}</button>
      </div>
    `;
    connectFieldErrors(form, "fleet-form");

    const defaultValues = {
      id: "",
      type: "",
      status: "available",
      lastCheck: "",
      driver: "",
    };
    const values = vehicle ? { ...defaultValues, ...vehicle } : defaultValues;
    form.elements.id.value = values.id || "";
    form.elements.type.value = values.type || "";
    form.elements.status.value = values.status || defaultValues.status;
    form.elements.lastCheck.value = values.lastCheck || "";
    form.elements.driver.value = values.driver || "";

    form.querySelector("[data-modal-cancel]").addEventListener("click", (e) => {
      e.preventDefault();
      Modal.close();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearFormErrors(form);
      const action = isEdit ? Actions.FLEET_EDIT : Actions.FLEET_CREATE;
      const context = getPermissionContext(vehicle);
      if (!guard(action, context)) return;
      const formValues = getVehicleFormValues(form);
      const existingIds = FleetStore.state.domain.fleet.map((v) => v.id);
      const errors = validateVehicleForm(formValues, { isEdit, existingIds });
      Object.keys(errors).forEach((name) => setFieldError(form, name, errors[name]));
      if (Object.keys(errors).length) return;

      const payload = {
        id: formValues.id,
        type: formValues.type,
        status: formValues.status,
        lastCheck: formValues.lastCheck,
        driver: formValues.driver,
      };

      if (isEdit && vehicle) {
        if (!FleetStore.updateVehicle(vehicle.id, payload)) return;
        const updatedVehicle = FleetStore.state.domain.fleet.find((v) => v.id === vehicle.id);
        buildActivityEntry("updated", updatedVehicle || vehicle);
        Toast.show("Pojazd zaktualizowany", "success");
      } else {
        if (!FleetStore.addVehicle(payload)) return;
        const createdVehicle = FleetStore.state.domain.fleet.find((v) => v.id === payload.id);
        buildActivityEntry("created", createdVehicle || payload);
        Toast.show("Pojazd dodany", "success");
      }

      Modal.close();
      renderCards();
    });

    Modal.open({ title: isEdit && vehicle ? `Edytuj ${escapeHtml(vehicle.id)}` : "Dodaj pojazd", body: form });
  };

  const openDeleteConfirm = (vehicle) => {
    if (!guard(Actions.FLEET_DELETE, getPermissionContext(vehicle))) return;
    const body = dom.h("div");
    body.innerHTML = `
      <p>Usunąć pojazd <strong>${escapeHtml(vehicle.id)}</strong>?</p>
      <p>${escapeHtml(vehicle.type)}</p>
      <div class="modal-actions modal-actions--confirm">
        <button class="button button--ghost" type="button" data-modal-cancel>Anuluj</button>
        <button class="button button--primary" type="button" data-modal-confirm>Usuń</button>
      </div>
    `;

    body.querySelector("[data-modal-cancel]").addEventListener("click", (e) => {
      e.preventDefault();
      Modal.close();
    });

    body.querySelector("[data-modal-confirm]").addEventListener("click", (e) => {
      e.preventDefault();
      if (!guard(Actions.FLEET_DELETE, getPermissionContext(vehicle))) return;
      if (!FleetStore.deleteVehicle(vehicle.id)) return;
      buildActivityEntry("deleted", vehicle);
      Toast.show("Pojazd usunięty", "success");
      Modal.close();
      renderCards();
    });

    Modal.open({ title: "Potwierdzenie usunięcia", body });
  };

  const openVehicle = (vehicle, trigger = null) => {
    const body = RecordDrawer.createDetailList([
      { label: "Rejestracja", value: vehicle.id },
      { label: "Typ", value: vehicle.type },
      { label: "Status", value: format.statusLabel(vehicle.status) },
      { label: "Kierowca", value: vehicle.driver || "Brak przypisania" },
      { label: "Ostatni przegląd", value: format.dateShort(vehicle.lastCheck) },
    ]);

    RecordDrawer.open({
      title: "Szczegóły pojazdu",
      subtitle: vehicle.id,
      body,
      trigger,
      fullDetailsLabel: "Pełny widok pojazdu - wkrótce",
    });
  };

  const saveFilters = () => {
    FleetStore.setFleetFilters({ status: statusSelect.value, search: searchInput.value });
  };

  const renderCards = () => {
    if (isLoading) {
      renderSkeletonCards();
      return;
    }

    const { status, search } = FleetStore.state.filters.fleet;

    const rows = FleetStore.state.domain.fleet.filter((v) => (status === "all" ? true : v.status === status)).filter((v) => `${v.id} ${v.type}`.toLowerCase().includes(search.toLowerCase()));

    const prefs = getListPrefs();
    const sortBy = prefs.sortBy || listPrefsFallback.sortBy;
    const sortDir = prefs.sortDir === "desc" ? -1 : 1;
    const sortedRows = rows
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const aVal = getFleetSortValue(a.item, sortBy);
        const bVal = getFleetSortValue(b.item, sortBy);
        let diff = 0;
        if (typeof aVal === "string" || typeof bVal === "string") {
          diff = String(aVal).localeCompare(String(bVal));
        } else {
          diff = (aVal || 0) - (bVal || 0);
        }
        if (diff === 0) return a.index - b.index;
        return diff * sortDir;
      })
      .map((entry) => entry.item);

    const pageSize = prefs.pageSize || listPrefsFallback.pageSize;
    const visibleCount = prefs.visibleCount || pageSize;
    const visibleRows = sortedRows.slice(0, visibleCount);
    const canLoadMore = sortedRows.length > visibleRows.length;

    if (rows.length === 0) {
      loadMoreWrap.style.display = "none";

      cards.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__card">
            <p class="tag">Brak</p>
            <h3 class="empty-state__title">Brak pojazdów</h3>
            <p>Zmień filtry lub wyszukiwanie, żeby zobaczyć pojazdy we flocie.</p>
            <button class="button button--secondary" id="clearFleetFilters" type="button">Wyczyść filtry</button>
          </div>
        </div>
      `;

      cards.querySelector("#clearFleetFilters")?.addEventListener("click", () => {
        FleetStore.setFleetFilters({ status: "all", search: "" });
        const prefs = getListPrefs();
        FleetStore.setListPrefs("fleet", { visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
        statusSelect.value = "all";
        searchInput.value = "";

        startFilterLoading();
      });

      return;
    }

    dom.clear(cards);
    loadMoreWrap.style.display = canLoadMore ? "flex" : "none";
    loadMoreBtn.disabled = !canLoadMore;
    visibleRows.forEach((vehicle, index) => {
      const card = dom.h("div", "panel vehicle-card");
      const safeId = escapeHtml(vehicle.id);
      const safeType = escapeHtml(vehicle.type);
      const safeStatus = escapeHtml(format.statusLabel(vehicle.status));
      const safeDriver = escapeHtml(vehicle.driver);
      const menuId = `vehicle-actions-${index}`;

    card.innerHTML = `
      <div class="vehicle-card__header">
        <div class="vehicle-card__toolbar">
          <span class="badge">${safeStatus}</span>
          <div class="dropdown" data-vehicle-menu>
            <button class="button button--ghost dropdown-trigger" type="button" aria-label="Akcje pojazdu ${safeId}" aria-expanded="false" aria-controls="${menuId}">...</button>
            <div class="dropdown-menu" id="${menuId}">
              <button class="dropdown-item" type="button" data-vehicle-action="edit">Edytuj</button>
              <button class="dropdown-item" type="button" data-vehicle-action="delete">Usuń</button>
            </div>
          </div>
        </div>

        <h3 class="vehicle-card__title">${safeId}</h3>
      </div>

      <div class="vehicle-card__body">
        <ul class="vehicle-card__meta">
          <li><span class="vehicle-card__meta-label">Typ:</span> ${safeType}</li>
          <li><span class="vehicle-card__meta-label">Kierowca:</span> ${safeDriver}</li>
          <li><span class="vehicle-card__meta-label">Ostatni przegląd:</span> ${format.dateShort(vehicle.lastCheck)}</li>
        </ul>
      </div>

      <div class="vehicle-card__actions">
        <button class="button button--ghost" type="button">Szczegóły</button>
      </div>
    `;

      const detailsBtn = card.querySelector(".vehicle-card__actions > .button.button--ghost");
      detailsBtn.addEventListener("click", (event) => {
        event.preventDefault();
        openVehicle(vehicle, detailsBtn);
      });

      const trigger = card.querySelector(".dropdown-trigger");
      const menu = card.querySelector(".dropdown-menu");

      const editBtn = card.querySelector('[data-vehicle-action="edit"]');
      const deleteBtn = card.querySelector('[data-vehicle-action="delete"]');
      const editAllowed = can(Actions.FLEET_EDIT, getPermissionContext(vehicle));
      const deleteAllowed = can(Actions.FLEET_DELETE, getPermissionContext(vehicle));
      applyDisabledState(editBtn, editAllowed, explainDeny(Actions.FLEET_EDIT, getPermissionContext(vehicle)));
      applyDisabledState(deleteBtn, deleteAllowed, explainDeny(Actions.FLEET_DELETE, getPermissionContext(vehicle)));

      if (trigger && menu) {
        trigger.addEventListener("click", (event) => {
          event.stopPropagation();
          Dropdown.toggle(trigger, menu);
        });

        menu.addEventListener("click", (event) => {
          const action = event.target.closest("[data-vehicle-action]");
          if (!action) return;
          event.preventDefault();
          event.stopPropagation();

          if (action.dataset.vehicleAction === "edit") {
            if (!guard(Actions.FLEET_EDIT, getPermissionContext(vehicle))) return;
            openVehicleForm({ mode: "edit", vehicle });
          } else if (action.dataset.vehicleAction === "delete") {
            if (!guard(Actions.FLEET_DELETE, getPermissionContext(vehicle))) return;
            openDeleteConfirm(vehicle);
          }

          Dropdown.toggle(trigger, menu);
        });
      }
      cards.appendChild(card);
    });
  };

  statusSelect.addEventListener("change", () => {
    saveFilters();
    const prefs = getListPrefs();
    FleetStore.setListPrefs("fleet", { visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
    startFilterLoading();
  });

  searchInput.addEventListener("input", () => {
    saveFilters();
    const prefs = getListPrefs();
    FleetStore.setListPrefs("fleet", { visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
    startFilterLoading();
  });

  const addBtn = fleetActions.querySelector("#addVehicle");
  if (addBtn) {
    const allowCreate = can(Actions.FLEET_CREATE, getPermissionContext());
    applyDisabledState(addBtn, allowCreate, explainDeny(Actions.FLEET_CREATE, getPermissionContext()));
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!guard(Actions.FLEET_CREATE, getPermissionContext())) return;
      openVehicleForm({ mode: "add" });
    });
  }

  loadMoreBtn.addEventListener("click", () => {
    const prefs = getListPrefs();
    const pageSize = prefs.pageSize || listPrefsFallback.pageSize;
    const nextCount = (prefs.visibleCount || pageSize) + pageSize;
    FleetStore.setListPrefs("fleet", { visibleCount: nextCount });
    renderCards();
  });

  startLoading();

  CleanupRegistry.add(() => {
    if (loadingTimer) clearTimeout(loadingTimer);
    if (filterTimer) clearTimeout(filterTimer);
  });

  return root;
}

export { fleetView };
