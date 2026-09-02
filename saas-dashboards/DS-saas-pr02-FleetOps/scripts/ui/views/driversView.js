import { FleetPermissions } from "../../core/permissions.js";
import { FleetStore } from "../../state/store.js";
import { CleanupRegistry } from "../../utils/cleanup.js";
import { clearFormErrors, connectFieldErrors, dom, escapeHtml, FleetUI, setFieldError } from "../../utils/dom.js";
import { format } from "../../utils/format.js";
import { Dropdown } from "../components/dropdown.js";
import { Modal } from "../components/modal.js";
import { RecordDrawer } from "../components/recordDrawer.js";
import { Toast } from "../components/toast.js";

function driversView() {
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
      <h2 class="module-header__title">Kierowcy</h2>
      <p class="module-header__meta">Status i ostatnie kursy</p>
    </div>

    <div class="toolbar">
      <select class="input toolbar__select" id="driversSortBy" aria-label="Sortuj">
        <option value="name">Imię i nazwisko</option>
        <option value="status">Status</option>
        <option value="phone">Telefon</option>
        <option value="lastTrip">Ostatni kurs</option>
      </select>

      <select class="input toolbar__select" id="driversSortDir" aria-label="Kierunek">
        <option value="asc">Rosnąco</option>
        <option value="desc">Malejąco</option>
      </select>
    </div>
  `;

  root.appendChild(header);

  const driversActions = dom.h("div", "app-actions");
  driversActions.innerHTML = `
    <button class="button button--primary app-actions__button" id="addDriver" type="button">
      Dodaj kierowcę
    </button>
  `;

  root.appendChild(driversActions);

  const filterBar = dom.h("div", "table-filter");

  const statusSelect = dom.h("select");
  statusSelect.id = "driversStatusFilter";
  statusSelect.name = "status";
  statusSelect.setAttribute("aria-label", "Filtr statusu kierowcy");
  statusSelect.innerHTML = `
    <option value="all">Status: wszystkie</option>
    <option value="available">Dostępny</option>
    <option value="on-route">W trasie</option>
    <option value="maintenance">Serwis</option>`;

  const searchInput = dom.h("input");
  searchInput.id = "driversSearchFilter";
  searchInput.name = "search";
  searchInput.type = "search";
  searchInput.placeholder = "Szukaj kierowcy";
  searchInput.setAttribute("aria-label", "Szukaj kierowcy");
  searchInput.autocomplete = "off";

  statusSelect.classList.add("input", "table-filter__field");
  searchInput.classList.add("input", "search");

  const filterSelects = dom.h("div", "table-filter__selects");
  filterSelects.appendChild(statusSelect);

  filterBar.appendChild(filterSelects);
  filterBar.appendChild(searchInput);
  root.appendChild(filterBar);

  const list = dom.h("div", "panel table--app table--drivers");
  list.innerHTML = `
    <div class="table-responsive">
      <table class="table table--app table--drivers">
        <thead>
          <tr>
            <th>Imię i nazwisko</th>
            <th>Status</th>
            <th>Ostatni kurs</th>
            <th>Telefon</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  root.appendChild(list);

  const loadMoreWrap = dom.h("div", "load-more");
  const loadMoreBtn = dom.h("button", "button button--secondary", "Załaduj więcej");
  loadMoreBtn.type = "button";
  loadMoreWrap.appendChild(loadMoreBtn);
  root.appendChild(loadMoreWrap);

  const tableWrap = list.querySelector(".table-responsive");

  const filters = FleetStore.state.filters.drivers;
  statusSelect.value = filters.status;
  searchInput.value = filters.search;

  const sortBySelect = header.querySelector("#driversSortBy");
  const sortDirSelect = header.querySelector("#driversSortDir");
  const listPrefsFallback = { sortBy: "name", sortDir: "asc", pageSize: 10, visibleCount: 10 };
  const getListPrefs = () => FleetStore.state.listPrefs?.drivers || listPrefsFallback;
  const syncSortControls = () => {
    const prefs = getListPrefs();
    if (sortBySelect) sortBySelect.value = prefs.sortBy || listPrefsFallback.sortBy;
    if (sortDirSelect) sortDirSelect.value = prefs.sortDir || listPrefsFallback.sortDir;
  };

  syncSortControls();
  if (sortBySelect) {
    sortBySelect.addEventListener("change", () => {
      const prefs = getListPrefs();
      FleetStore.setListPrefs("drivers", { sortBy: sortBySelect.value, visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
      renderRows();
    });
  }
  if (sortDirSelect) {
    sortDirSelect.addEventListener("change", () => {
      const prefs = getListPrefs();
      FleetStore.setListPrefs("drivers", { sortDir: sortDirSelect.value, visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
      renderRows();
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
  const getDriverSortValue = (driver, sortBy) => {
    if (sortBy === "name") return String(driver.name || "").toLowerCase();
    if (sortBy === "status") return statusOrder[driver.status] || 99;
    if (sortBy === "phone") return normalizePhone(driver.phone);
    if (sortBy === "lastTrip") return String(driver.lastTrip || "").toLowerCase();
    return String(driver.name || "").toLowerCase();
  };
  const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
  const buildActivityEntry = (action, driver) => {
    const verb = { created: "dodany", updated: "zaktualizowany", deleted: "usunięty" }[action] || "zaktualizowany";
    const label = driver ? `${driver.name || "Kierowca"} (${driver.id || "nowy"})` : "";
    FleetStore.addActivity({
      title: `Kierowca ${verb}: ${label}`.trim(),
      detail: driver && driver.phone ? `Telefon: ${driver.phone}` : "",
      time: new Date().toISOString(),
    });
  };

  const startFilterLoading = () => {
    if (filterTimer) clearTimeout(filterTimer);

    isLoading = true;
    renderSkeleton();

    filterTimer = setTimeout(() => {
      isLoading = false;
      renderRows();
    }, FILTER_DELAY);
  };

  const renderSkeleton = () => {
    loadMoreWrap.style.display = "none";
    tableWrap.innerHTML = `
      <div class="skeleton-table">
        ${Array.from({ length: 6 })
          .map(
            () => `
          <div class="skeleton-row skeleton-row--drivers">
            <div class="skeleton skeleton-cell lg"></div>
            <div class="skeleton skeleton-cell"></div>
            <div class="skeleton skeleton-cell"></div>
            <div class="skeleton skeleton-cell"></div>
            <div class="skeleton skeleton-cell"></div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  };

  const startLoading = () => {
    isLoading = true;
    renderSkeleton();

    if (loadingTimer) clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      isLoading = false;
      renderRows();
    }, 180);
  };


  const getDriverFormValues = (form) => {
    const data = new FormData(form);
    return {
      name: String(data.get("name") || "").trim(),
      status: String(data.get("status") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      lastTrip: String(data.get("lastTrip") || "").trim(),
    };
  };

  const validateDriverForm = (values, { isEdit = false, currentId = null } = {}) => {
    const errors = {};
    if (!values.name) errors.name = "Wymagane";
    else if (values.name.length > 80) errors.name = "Maks. 80 znaków";

    if (!values.status) errors.status = "Wybierz status";

    if (!values.phone) errors.phone = "Wymagane";
    const phoneDigits = normalizePhone(values.phone);
    if (!errors.phone && phoneDigits.length < 9) errors.phone = "Min. 9 cyfr";
    if (!errors.phone) {
      const duplicates = FleetStore.state.domain.drivers.filter((d) => (isEdit ? d.id !== currentId : true)).some((d) => normalizePhone(d.phone) === phoneDigits);
      if (duplicates) errors.phone = "Telefon już istnieje";
    }

    if (values.lastTrip.length > 80) errors.lastTrip = "Maks. 80 znaków";
    return errors;
  };

  const openDriverForm = ({ mode = "add", driver = null } = {}) => {
    const isEdit = mode === "edit";
    const form = dom.h("form", "modal-form");
    form.noValidate = true;
    form.innerHTML = `
      <label class="form-control">
        <span class="label">Imię i nazwisko</span>
        <input class="input" name="name" maxlength="80" placeholder="np. Anna Lewandowska" required />
        <span class="form-error" data-error-for="name"></span>
      </label>
      <label class="form-control">
        <span class="label">Status</span>
        <select class="input" name="status" required>
          ${statusOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
        </select>
        <span class="form-error" data-error-for="status"></span>
      </label>
      <label class="form-control">
        <span class="label">Telefon</span>
        <input class="input" name="phone" maxlength="20" placeholder="np. +48 600 200 111" required />
        <span class="form-error" data-error-for="phone"></span>
      </label>
      <label class="form-control">
        <span class="label">Ostatni kurs</span>
        <input class="input" name="lastTrip" maxlength="80" placeholder="np. Warszawa - Rzeszów" />
        <span class="form-error" data-error-for="lastTrip"></span>
      </label>
      <div class="modal-actions modal-actions--form">
        <button class="button button--ghost" type="button" data-modal-cancel>Anuluj</button>
        <button class="button button--primary" type="submit">${isEdit ? "Zapisz zmiany" : "Dodaj kierowcę"}</button>
      </div>
    `;
    connectFieldErrors(form, "drivers-form");

    const defaultValues = {
      name: "",
      status: "available",
      phone: "",
      lastTrip: "",
    };
    const values = driver ? { ...defaultValues, ...driver } : defaultValues;
    form.elements.name.value = values.name || "";
    form.elements.status.value = values.status || defaultValues.status;
    form.elements.phone.value = values.phone || "";
    form.elements.lastTrip.value = values.lastTrip || "";

    form.querySelector("[data-modal-cancel]").addEventListener("click", (e) => {
      e.preventDefault();
      Modal.close();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearFormErrors(form);
      const action = isEdit ? Actions.DRIVERS_EDIT : Actions.DRIVERS_CREATE;
      const context = getPermissionContext(driver);
      if (!guard(action, context)) return;
      const formValues = getDriverFormValues(form);
      const errors = validateDriverForm(formValues, { isEdit, currentId: driver ? driver.id : null });
      Object.keys(errors).forEach((name) => setFieldError(form, name, errors[name]));
      if (Object.keys(errors).length) return;

      const payload = {
        name: formValues.name,
        status: formValues.status,
        phone: formValues.phone,
        lastTrip: formValues.lastTrip,
      };

      if (isEdit && driver) {
        if (!FleetStore.updateDriver(driver.id, payload)) return;
        const updatedDriver = FleetStore.state.domain.drivers.find((d) => d.id === driver.id);
        buildActivityEntry("updated", updatedDriver || driver);
        Toast.show("Kierowca zaktualizowany", "success");
      } else {
        if (!FleetStore.addDriver(payload)) return;
        const createdDriver = FleetStore.state.domain.drivers[FleetStore.state.domain.drivers.length - 1];
        buildActivityEntry("created", createdDriver || payload);
        Toast.show("Kierowca dodany", "success");
      }

      Modal.close();
      renderRows();
    });

    Modal.open({ title: isEdit && driver ? `Edytuj ${escapeHtml(driver.name)}` : "Dodaj kierowcę", body: form });
  };

  const openDeleteConfirm = (driver) => {
    if (!guard(Actions.DRIVERS_DELETE, getPermissionContext(driver))) return;
    const body = dom.h("div");
    body.innerHTML = `
      <p>Usunąć kierowcę <strong>${escapeHtml(driver.name)}</strong>?</p>
      <p>${escapeHtml(driver.phone)}</p>
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
      if (!guard(Actions.DRIVERS_DELETE, getPermissionContext(driver))) return;
      if (!FleetStore.deleteDriver(driver.id)) return;
      buildActivityEntry("deleted", driver);
      Toast.show("Kierowca usunięty", "success");
      Modal.close();
      renderRows();
    });

    Modal.open({ title: "Potwierdzenie usunięcia", body });
  };

  const openDriver = (driver, trigger = null) => {
    const body = RecordDrawer.createDetailList([
      { label: "Imię i nazwisko", value: driver.name },
      { label: "Status", value: format.statusLabel(driver.status) },
      { label: "Ostatni kurs", value: driver.lastTrip || "Brak danych" },
      { label: "Telefon", value: driver.phone },
    ]);

    RecordDrawer.open({
      title: "Szczegóły kierowcy",
      subtitle: driver.name,
      body,
      trigger,
      fullDetailsLabel: "Pełny widok kierowcy - wkrótce",
    });
  };

  const saveFilters = () => {
    FleetStore.setDriverFilters({
      status: statusSelect.value,
      search: searchInput.value,
    });
  };

  const ensureTable = () => {
    if (list.querySelector("tbody")) return;

    tableWrap.innerHTML = '<table class="table"><thead><tr><th>Imię i nazwisko</th><th>Status</th><th>Ostatni kurs</th><th>Telefon</th><th>Akcje</th></tr></thead><tbody></tbody></table>';
  };

  const renderRows = () => {
    if (isLoading) {
      renderSkeleton();
      return;
    }

    const { status, search } = FleetStore.state.filters.drivers;

    const rows = FleetStore.state.domain.drivers.filter((d) => (status === "all" ? true : d.status === status)).filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

    const prefs = getListPrefs();
    const sortBy = prefs.sortBy || listPrefsFallback.sortBy;
    const sortDir = prefs.sortDir === "desc" ? -1 : 1;
    const sortedRows = rows
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const aVal = getDriverSortValue(a.item, sortBy);
        const bVal = getDriverSortValue(b.item, sortBy);
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

      tableWrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__card">
            <p class="tag">Brak</p>
            <h3 class="empty-state__title">Brak wyników</h3>
            <p>Zmień filtry lub wyszukiwanie, żeby zobaczyć kierowców.</p>
            <button class="button button--secondary" id="clearDriversFilters" type="button">Wyczyść filtry</button>
          </div>
        </div>
      `;

      tableWrap.querySelector("#clearDriversFilters")?.addEventListener("click", () => {
        FleetStore.setDriverFilters({ status: "all", search: "" });
        const prefs = getListPrefs();
        FleetStore.setListPrefs("drivers", { visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
        statusSelect.value = "all";
        searchInput.value = "";

        startFilterLoading();
      });

      return;
    }

    ensureTable();
    const tbody = list.querySelector("tbody");
    tbody.innerHTML = "";

    loadMoreWrap.style.display = canLoadMore ? "flex" : "none";
    loadMoreBtn.disabled = !canLoadMore;

    visibleRows.forEach((driver, index) => {
      const tr = dom.h("tr", "record-row driver-row");
      const safeName = escapeHtml(driver.name);
      const safeStatus = escapeHtml(format.statusLabel(driver.status));
      const safeLastTrip = escapeHtml(driver.lastTrip);
      const safePhone = escapeHtml(driver.phone);
      const menuId = `driver-actions-${index}`;
      tr.innerHTML = `
        <td><button class="record-detail-trigger" type="button" data-record-detail aria-label="Pokaż szczegóły kierowcy ${safeName}">${safeName}</button></td>
        <td><span class="badge">${safeStatus}</span></td>
        <td>${safeLastTrip}</td>
        <td>${safePhone}</td>
        <td>
          <div class="dropdown" data-driver-menu>
            <button class="button button--ghost dropdown-trigger" type="button" aria-label="Akcje kierowcy ${safeName}" aria-expanded="false" aria-controls="${menuId}">...</button>
            <div class="dropdown-menu" id="${menuId}">
              <button class="dropdown-item" type="button" data-driver-action="edit">Edytuj</button>
              <button class="dropdown-item" type="button" data-driver-action="delete">Usuń</button>
            </div>
          </div>
        </td>`;

      tr.addEventListener("click", (event) => {
        if (event.target.closest("[data-record-detail]")) return;
        if (event.target.closest("[data-driver-menu]")) return;
        openDriver(driver, tr.querySelector("[data-record-detail]"));
      });

      const detailTrigger = tr.querySelector("[data-record-detail]");
      detailTrigger?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openDriver(driver, detailTrigger);
      });

      const trigger = tr.querySelector(".dropdown-trigger");
      const menu = tr.querySelector(".dropdown-menu");

      const editBtn = tr.querySelector('[data-driver-action="edit"]');
      const deleteBtn = tr.querySelector('[data-driver-action="delete"]');
      const editAllowed = can(Actions.DRIVERS_EDIT, getPermissionContext(driver));
      const deleteAllowed = can(Actions.DRIVERS_DELETE, getPermissionContext(driver));
      applyDisabledState(editBtn, editAllowed, explainDeny(Actions.DRIVERS_EDIT, getPermissionContext(driver)));
      applyDisabledState(deleteBtn, deleteAllowed, explainDeny(Actions.DRIVERS_DELETE, getPermissionContext(driver)));

      if (trigger && menu) {
        trigger.addEventListener("click", (event) => {
          event.stopPropagation();
          Dropdown.toggle(trigger, menu);
        });

        menu.addEventListener("click", (event) => {
          const action = event.target.closest("[data-driver-action]");
          if (!action) return;
          event.preventDefault();
          event.stopPropagation();

          if (action.dataset.driverAction === "edit") {
            if (!guard(Actions.DRIVERS_EDIT, getPermissionContext(driver))) return;
            openDriverForm({ mode: "edit", driver });
          } else if (action.dataset.driverAction === "delete") {
            if (!guard(Actions.DRIVERS_DELETE, getPermissionContext(driver))) return;
            openDeleteConfirm(driver);
          }

          Dropdown.toggle(trigger, menu);
        });
      }

      tbody.appendChild(tr);
    });
  };

  statusSelect.addEventListener("change", () => {
    saveFilters();
    const prefs = getListPrefs();
    FleetStore.setListPrefs("drivers", { visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
    startFilterLoading();
  });

  searchInput.addEventListener("input", () => {
    saveFilters();
    const prefs = getListPrefs();
    FleetStore.setListPrefs("drivers", { visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
    startFilterLoading();
  });

  const addBtn = driversActions.querySelector("#addDriver");
  if (addBtn) {
    const allowCreate = can(Actions.DRIVERS_CREATE, getPermissionContext());
    applyDisabledState(addBtn, allowCreate, explainDeny(Actions.DRIVERS_CREATE, getPermissionContext()));
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!guard(Actions.DRIVERS_CREATE, getPermissionContext())) return;
      openDriverForm({ mode: "add" });
    });
  }

  loadMoreBtn.addEventListener("click", () => {
    const prefs = getListPrefs();
    const pageSize = prefs.pageSize || listPrefsFallback.pageSize;
    const nextCount = (prefs.visibleCount || pageSize) + pageSize;
    FleetStore.setListPrefs("drivers", { visibleCount: nextCount });
    renderRows();
  });

  startLoading();

  CleanupRegistry.add(() => {
    if (loadingTimer) clearTimeout(loadingTimer);
    if (filterTimer) clearTimeout(filterTimer);
  });

  return root;
}

export { driversView };
