import { FleetPermissions } from "../../core/permissions.js";
import { FleetStore } from "../../state/store.js";
import { CleanupRegistry } from "../../utils/cleanup.js";
import { clearFormErrors, connectFieldErrors, dom, escapeHtml, FleetUI, setFieldError } from "../../utils/dom.js";
import { format } from "../../utils/format.js";
import { Dropdown } from "../components/dropdown.js";
import { Modal } from "../components/modal.js";
import { RecordDrawer } from "../components/recordDrawer.js";
import { Table } from "../components/table.js";
import { Toast } from "../components/toast.js";

function ordersView() {
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
      <h2 class="module-header__title">Zlecenia</h2>
      <p class="module-header__meta">Monitoruj status dostaw</p>
    </div>

    <div class="toolbar">
      <select class="input toolbar__select" id="ordersSortBy" aria-label="Sortuj">
        <option value="updated">Aktualizacja</option>
        <option value="client">Klient</option>
        <option value="status">Status</option>
        <option value="priority">Priorytet</option>
      </select>

      <select class="input toolbar__select" id="ordersSortDir" aria-label="Kierunek">
        <option value="asc">Rosnąco</option>
        <option value="desc">Malejąco</option>
      </select>
    </div>
  `;

  root.appendChild(header);

  const ordersActions = dom.h("div", "app-actions");
  ordersActions.innerHTML = `
    <button class="button button--primary app-actions__button" id="addOrder" type="button">
      Dodaj zlecenie
    </button>

    <button class="button button--secondary app-actions__button" id="ordersCsvExport" type="button">
      Eksportuj CSV
    </button>
  `;

  root.appendChild(ordersActions);

  const filterBar = dom.h("div", "table-filter");

  const statusSelect = dom.h("select");
  statusSelect.id = "ordersStatusFilter";
  statusSelect.name = "status";
  statusSelect.setAttribute("aria-label", "Filtr statusu zlecenia");
  statusSelect.innerHTML = `
  <option value="all">Status: wszystkie</option>
  <option value="in-progress">W realizacji</option>
  <option value="delayed">Opóźnione</option>
  <option value="delivered">Dostarczone</option>
  <option value="pending">Oczekujące</option>`;

  const prioritySelect = dom.h("select");
  prioritySelect.id = "ordersPriorityFilter";
  prioritySelect.name = "priority";
  prioritySelect.setAttribute("aria-label", "Filtr priorytetu zlecenia");
  prioritySelect.innerHTML = `
  <option value="all">Priorytet: wszystkie</option>
  <option value="high">Wysoki</option>
  <option value="medium">Średni</option>
  <option value="low">Niski</option>`;

  const searchInput = dom.h("input");
  searchInput.id = "ordersSearchFilter";
  searchInput.name = "search";
  searchInput.type = "search";
  searchInput.placeholder = "Szukaj klienta / trasy";
  searchInput.setAttribute("aria-label", "Szukaj klienta lub trasy");
  searchInput.autocomplete = "off";

  [statusSelect, prioritySelect].forEach((el) => {
    el.classList.add("input", "table-filter__field");
  });

  searchInput.classList.add("input", "search");

  const filterSelects = dom.h("div", "table-filter__selects");
  filterSelects.appendChild(statusSelect);
  filterSelects.appendChild(prioritySelect);

  filterBar.appendChild(filterSelects);
  filterBar.appendChild(searchInput);
  root.appendChild(filterBar);

  const tableWrap = dom.h("div", "panel table-responsive");
  tableWrap.id = "ordersTable";
  root.appendChild(tableWrap);

  const loadMoreWrap = dom.h("div", "load-more");
  const loadMoreBtn = dom.h("button", "button button--secondary", "Załaduj więcej");
  loadMoreBtn.type = "button";
  loadMoreWrap.appendChild(loadMoreBtn);
  root.appendChild(loadMoreWrap);

  const filters = FleetStore.state.filters.orders;
  statusSelect.value = filters.status;
  prioritySelect.value = filters.priority;
  searchInput.value = filters.search;

  const sortBySelect = header.querySelector("#ordersSortBy");
  const sortDirSelect = header.querySelector("#ordersSortDir");
  const listPrefsFallback = { sortBy: "updated", sortDir: "desc", pageSize: 10, visibleCount: 10 };
  const getListPrefs = () => FleetStore.state.listPrefs?.orders || listPrefsFallback;
  const syncSortControls = () => {
    const prefs = getListPrefs();
    if (sortBySelect) sortBySelect.value = prefs.sortBy || listPrefsFallback.sortBy;
    if (sortDirSelect) sortDirSelect.value = prefs.sortDir || listPrefsFallback.sortDir;
  };

  syncSortControls();
  if (sortBySelect) {
    sortBySelect.addEventListener("change", () => {
      const prefs = getListPrefs();
      FleetStore.setListPrefs("orders", { sortBy: sortBySelect.value, visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
      renderRows();
    });
  }
  if (sortDirSelect) {
    sortDirSelect.addEventListener("change", () => {
      const prefs = getListPrefs();
      FleetStore.setListPrefs("orders", { sortDir: sortDirSelect.value, visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
      renderRows();
    });
  }

  let isLoading = true;
  let filterTimer = null;
  let searchDebounceTimer = null;
  let searchLoadingTimer = null;
  let initialLoadTimer = null;
  const FILTER_DELAY = 160;
  const priorityLabel = (value) => ({ high: "Wysoki", medium: "Średni", low: "Niski" })[value] || value;
  const statusOrder = { "in-progress": 1, delayed: 2, pending: 3, delivered: 4 };
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  const getOrderSortValue = (order, sortBy) => {
    if (sortBy === "updated") return Date.parse(order.updated || order.updatedAt || "");
    if (sortBy === "client") return String(order.client || "").toLowerCase();
    if (sortBy === "status") return statusOrder[order.status] || 99;
    if (sortBy === "priority") return priorityOrder[order.priority] || 99;
    return String(order.id || "").toLowerCase();
  };
  const debounce =
    (fn, wait = 250) =>
    (...args) => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => fn(...args), wait);
    };
  const statusOptions = [
    { value: "in-progress", label: "W realizacji" },
    { value: "delayed", label: "Opóźnione" },
    { value: "delivered", label: "Dostarczone" },
    { value: "pending", label: "Oczekujące" },
  ];
  const priorityOptions = [
    { value: "high", label: "Wysoki" },
    { value: "medium", label: "Średni" },
    { value: "low", label: "Niski" },
  ];
  const etaPattern = /^(\d{4}-\d{2}-\d{2}|\d+h\s?\d+m|Dostarczono)$/i;
  const nowIso = () => new Date().toISOString();
  const buildActivityEntry = (action, order) => {
    const verb = { created: "dodane", updated: "zaktualizowane", deleted: "usunięte" }[action] || "zaktualizowane";
    const detail = order ? `${order.client} - ${order.route}` : "";
    FleetStore.addActivity({
      title: order ? `Zlecenie ${order.id} ${verb}` : `Zlecenie ${verb}`,
      detail,
      time: new Date().toISOString(),
    });
  };

  const renderOrdersSkeleton = () => {
    loadMoreWrap.style.display = "none";
    tableWrap.innerHTML = `
      <div class="skeleton-table">
        ${Array.from({ length: 6 })
          .map(
            () => `
          <div class="skeleton-row">
            <div class="skeleton skeleton-cell lg"></div>
            <div class="skeleton skeleton-cell"></div>
            <div class="skeleton skeleton-cell"></div>
            <div class="skeleton skeleton-cell"></div>
            <div class="skeleton skeleton-cell"></div>
            <div class="skeleton skeleton-cell"></div>
            <div class="skeleton skeleton-cell"></div>
          </div>`,
          )
          .join("")}
      </div>
    `;
  };

  const startFilterLoading = () => {
    if (filterTimer) clearTimeout(filterTimer);

    isLoading = true;
    renderOrdersSkeleton();

    filterTimer = setTimeout(() => {
      isLoading = false;

      renderRows();
    }, FILTER_DELAY);
  };


  const getOrderFormValues = (form) => {
    const data = new FormData(form);
    return {
      client: String(data.get("client") || "").trim(),
      route: String(data.get("route") || "").trim(),
      status: String(data.get("status") || "").trim(),
      eta: String(data.get("eta") || "").trim(),
      priority: String(data.get("priority") || "").trim(),
      updated: String(data.get("updated") || "").trim(),
    };
  };

  const validateOrderForm = (values) => {
    const errors = {};
    if (!values.client) errors.client = "Wymagane";
    else if (values.client.length > 80) errors.client = "Maks. 80 znaków";

    if (!values.route) errors.route = "Wymagane";
    else if (values.route.length > 120) errors.route = "Maks. 120 znaków";

    if (!values.status) errors.status = "Wybierz status";
    if (!values.priority) errors.priority = "Wybierz priorytet";

    if (!values.eta) errors.eta = "Wymagane";
    else if (!etaPattern.test(values.eta)) {
      errors.eta = "Format: 2025-12-31 lub 2h 30m";
    }

    return errors;
  };

  const openOrderForm = ({ mode = "add", order = null } = {}) => {
    const isEdit = mode === "edit";
    const form = dom.h("form", "modal-form");
    form.noValidate = true;
    form.innerHTML = `
      <label class="form-control">
        <span class="label">Klient</span>
        <input class="input" name="client" maxlength="80" placeholder="np. Nordic Retail" required />
        <span class="form-error" data-error-for="client"></span>
      </label>
      <label class="form-control">
        <span class="label">Trasa</span>
        <input class="input" name="route" maxlength="120" placeholder="np. Gdańsk - Poznań" required />
        <span class="form-error" data-error-for="route"></span>
      </label>
      <label class="form-control">
        <span class="label">Status</span>
        <select class="input" name="status" required>
          ${statusOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
        </select>
        <span class="form-error" data-error-for="status"></span>
      </label>
      <label class="form-control">
        <span class="label">ETA</span>
        <input class="input" name="eta" maxlength="20" placeholder="np. 2025-12-31 lub 2h 30m" required />
        <span class="form-hint">Akceptuje format daty lub czasu trwania.</span>
        <span class="form-error" data-error-for="eta"></span>
      </label>
      <label class="form-control">
        <span class="label">Priorytet</span>
        <select class="input" name="priority" required>
          ${priorityOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
        </select>
        <span class="form-error" data-error-for="priority"></span>
      </label>
      <label class="form-control">
        <span class="label">Ostatnia aktualizacja</span>
        <input class="input" name="updated" readonly />
        <span class="form-hint">Ustawiane automatycznie.</span>
      </label>
      <div class="modal-actions modal-actions--form">
        <button class="button button--ghost" type="button" data-modal-cancel>Anuluj</button>
        <button class="button button--primary" type="submit">${isEdit ? "Zapisz zmiany" : "Dodaj zlecenie"}</button>
      </div>
    `;
    connectFieldErrors(form, "orders-form");

    const defaultValues = {
      client: "",
      route: "",
      status: "in-progress",
      eta: "",
      priority: "medium",
      updated: nowIso(),
    };
    const values = order ? { ...defaultValues, ...order } : defaultValues;
    form.elements.client.value = values.client || "";
    form.elements.route.value = values.route || "";
    form.elements.status.value = values.status || defaultValues.status;
    form.elements.eta.value = values.eta || "";
    form.elements.priority.value = values.priority || defaultValues.priority;
    form.elements.updated.value = values.updated || values.updatedAt || nowIso();

    form.querySelector("[data-modal-cancel]").addEventListener("click", (e) => {
      e.preventDefault();
      Modal.close();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearFormErrors(form);
      const action = isEdit ? Actions.ORDERS_EDIT : Actions.ORDERS_CREATE;
      const context = getPermissionContext(order);
      if (!guard(action, context)) return;
      const formValues = getOrderFormValues(form);
      const errors = validateOrderForm(formValues);
      Object.keys(errors).forEach((name) => setFieldError(form, name, errors[name]));
      if (Object.keys(errors).length) return;

      const updated = nowIso();
      form.elements.updated.value = updated;
      const payload = {
        client: formValues.client,
        route: formValues.route,
        status: formValues.status,
        eta: formValues.eta,
        priority: formValues.priority,
        updated,
      };

      if (isEdit && order) {
        if (!FleetStore.updateOrder(order.id, payload)) return;
        const updatedOrder = FleetStore.state.domain.orders.find((o) => o.id === order.id);
        buildActivityEntry("updated", updatedOrder || order);
        Toast.show("Zlecenie zaktualizowane", "success");
      } else {
        if (!FleetStore.addOrder(payload)) return;
        const createdOrder = FleetStore.state.domain.orders[FleetStore.state.domain.orders.length - 1];
        buildActivityEntry("created", createdOrder || payload);
        Toast.show("Zlecenie dodane", "success");
      }

      Modal.close();

      renderRows();
    });

    Modal.open({ title: isEdit && order ? `Edytuj ${escapeHtml(order.id)}` : "Dodaj zlecenie", body: form });
  };

  const openDeleteConfirm = (order) => {
    if (!guard(Actions.ORDERS_DELETE, getPermissionContext(order))) return;
    const body = dom.h("div");
    body.innerHTML = `
      <p>Czy na pewno usunąć zlecenie <strong>${escapeHtml(order.id)}</strong>?</p>
      <p>${escapeHtml(order.client)} - ${escapeHtml(order.route)}</p>
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
      if (!guard(Actions.ORDERS_DELETE, getPermissionContext(order))) return;
      if (!FleetStore.deleteOrder(order.id)) return;
      buildActivityEntry("deleted", order);
      Toast.show("Zlecenie usunięte", "success");
      Modal.close();

      renderRows();
    });

    Modal.open({ title: "Potwierdzenie usunięcia", body });
  };

  const renderRows = () => {
    if (isLoading) {
      renderOrdersSkeleton();
      return;
    }

    const { status, priority, search } = FleetStore.state.filters.orders;
    const rows = FleetStore.state.domain.orders
      .filter((o) => (status === "all" ? true : o.status === status))
      .filter((o) => (priority === "all" ? true : o.priority === priority))
      .filter((o) => `${o.client} ${o.route}`.toLowerCase().includes(search.toLowerCase()));

    const prefs = getListPrefs();
    const sortBy = prefs.sortBy || listPrefsFallback.sortBy;
    const sortDir = prefs.sortDir === "desc" ? -1 : 1;
    const sortedRows = rows
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const aVal = getOrderSortValue(a.item, sortBy);
        const bVal = getOrderSortValue(b.item, sortBy);
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
            <p>Zmień filtry lub wyszukiwanie, żeby zobaczyć zlecenia.</p>
            <button class="button button--secondary" id="clearOrdersFilters" type="button">Wyczyść filtry</button>
          </div>
        </div>
      `;

      tableWrap.querySelector("#clearOrdersFilters")?.addEventListener("click", () => {
        FleetStore.setOrderFilters({ status: "all", priority: "all", search: "" });
        const prefs = getListPrefs();
        FleetStore.setListPrefs("orders", { visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
        statusSelect.value = "all";
        prioritySelect.value = "all";
        searchInput.value = "";

        startFilterLoading();
      });

      return;
    }

    const renderedRows = visibleRows.map((order, index) => {
      const safeId = escapeHtml(order.id);
      const safeClient = escapeHtml(order.client);
      const safeRoute = escapeHtml(order.route);
      const safeStatus = escapeHtml(format.statusLabel(order.status));
      const safeEta = escapeHtml(order.eta);
      const safePriority = escapeHtml(priorityLabel(order.priority));
      const menuId = `order-actions-${index}`;

      return `
      <tr class="record-row order-row" data-id="${safeId}">
        <td><button class="record-detail-trigger" type="button" data-record-detail aria-label="Pokaż szczegóły zlecenia ${safeId}">${safeId}</button></td>
        <td>${safeClient}</td>
        <td>${safeRoute}</td>
        <td><span class="${format.badgeClass(order.status)}">${safeStatus}</span></td>
        <td>${safeEta}</td>
        <td><span class="badge">${safePriority}</span></td>
        <td>
          <div class="dropdown" data-order-menu>
            <button class="button button--ghost dropdown-trigger" type="button" aria-label="Akcje zlecenia ${safeId}" aria-expanded="false" aria-controls="${menuId}">...</button>
            <div class="dropdown-menu" id="${menuId}">
              <button class="dropdown-item" type="button" data-order-action="edit">Edytuj</button>
              <button class="dropdown-item" type="button" data-order-action="delete">Usuń</button>
            </div>
          </div>
        </td>
      </tr>`;
    });

    tableWrap.innerHTML = Table.render(
      ["ID", "Klient", "Trasa", "Status", "ETA", "Priorytet", "Akcje"],
      renderedRows,
      { className: "table--app" }
    );

    loadMoreWrap.style.display = canLoadMore ? "flex" : "none";
    loadMoreBtn.disabled = !canLoadMore;

    tableWrap.querySelectorAll("tr.order-row").forEach((row) => {
      const order = FleetStore.state.domain.orders.find((o) => o.id === row.dataset.id);
      const editBtn = row.querySelector('[data-order-action="edit"]');
      const deleteBtn = row.querySelector('[data-order-action="delete"]');
      const editAllowed = can(Actions.ORDERS_EDIT, getPermissionContext(order));
      const deleteAllowed = can(Actions.ORDERS_DELETE, getPermissionContext(order));
      applyDisabledState(editBtn, editAllowed, explainDeny(Actions.ORDERS_EDIT, getPermissionContext(order)));
      applyDisabledState(deleteBtn, deleteAllowed, explainDeny(Actions.ORDERS_DELETE, getPermissionContext(order)));
      row.addEventListener("click", (event) => {
        if (event.target.closest("[data-record-detail]")) return;
        if (event.target.closest("[data-order-menu]")) return;
        openOrder(row.dataset.id, row.querySelector("[data-record-detail]"));
      });

      const detailTrigger = row.querySelector("[data-record-detail]");
      detailTrigger?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openOrder(row.dataset.id, detailTrigger);
      });

      const trigger = row.querySelector(".dropdown-trigger");
      const menu = row.querySelector(".dropdown-menu");

      if (trigger && menu) {
        trigger.addEventListener("click", (event) => {
          event.stopPropagation();
          Dropdown.toggle(trigger, menu);
        });

        menu.addEventListener("click", (event) => {
          const action = event.target.closest("[data-order-action]");
          if (!action) return;
          event.preventDefault();
          event.stopPropagation();
          const order = FleetStore.state.domain.orders.find((o) => o.id === row.dataset.id);
          if (!order) return;

          if (action.dataset.orderAction === "edit") {
            if (!guard(Actions.ORDERS_EDIT, getPermissionContext(order))) return;
            openOrderForm({ mode: "edit", order });
          } else if (action.dataset.orderAction === "delete") {
            if (!guard(Actions.ORDERS_DELETE, getPermissionContext(order))) return;
            openDeleteConfirm(order);
          }

          Dropdown.toggle(trigger, menu);
        });
      }
    });
  };

  const openOrder = (id, trigger = null) => {
    const order = FleetStore.state.domain.orders.find((o) => o.id === id);
    if (!order) return;
    const body = RecordDrawer.createDetailList([
      { label: "Klient", value: order.client },
      { label: "Trasa", value: order.route },
      { label: "Status", value: format.statusLabel(order.status) },
      { label: "ETA", value: order.eta },
      { label: "Priorytet", value: priorityLabel(order.priority) },
      { label: "Ostatnia aktualizacja", value: format.dateShort(order.updated) },
    ]);

    RecordDrawer.open({
      title: `Zlecenie ${order.id}`,
      subtitle: `${order.client} - ${order.route}`,
      body,
      trigger,
      fullDetailsLabel: "Pełny widok zlecenia - wkrótce",
    });
  };

  const pushFilters = () => {
    FleetStore.setOrderFilters({
      status: statusSelect.value,
      priority: prioritySelect.value,
      search: searchInput.value,
    });
  };

  const applySelectFilters = () => {
    pushFilters();
    const prefs = getListPrefs();
    FleetStore.setListPrefs("orders", { visibleCount: prefs.pageSize || listPrefsFallback.pageSize });
    startFilterLoading();
  };

  statusSelect.addEventListener("change", applySelectFilters);
  prioritySelect.addEventListener("change", applySelectFilters);

  const applySearch = () => {
    pushFilters();
    const prefs = getListPrefs();
    FleetStore.setListPrefs("orders", { visibleCount: prefs.pageSize || listPrefsFallback.pageSize });

    isLoading = true;

    renderRows();

    if (searchLoadingTimer) clearTimeout(searchLoadingTimer);
    searchLoadingTimer = setTimeout(() => {
      isLoading = false;

      renderRows();
    }, 140);
  };

  const applySearchDebounced = debounce(applySearch, 250);
  searchInput.addEventListener("input", applySearchDebounced);

  const exportBtn = ordersActions.querySelector("#ordersCsvExport");
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.title = "Eksport CSV jest niedostępny w wersji demo";
  }

  const addBtn = ordersActions.querySelector("#addOrder");
  if (addBtn) {
    const allowCreate = can(Actions.ORDERS_CREATE, getPermissionContext());
    applyDisabledState(addBtn, allowCreate, explainDeny(Actions.ORDERS_CREATE, getPermissionContext()));
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!guard(Actions.ORDERS_CREATE, getPermissionContext())) return;
      openOrderForm({ mode: "add" });
    });
  }

  loadMoreBtn.addEventListener("click", () => {
    const prefs = getListPrefs();
    const pageSize = prefs.pageSize || listPrefsFallback.pageSize;
    const nextCount = (prefs.visibleCount || pageSize) + pageSize;
    FleetStore.setListPrefs("orders", { visibleCount: nextCount });
    renderRows();
  });

  renderRows();
  initialLoadTimer = setTimeout(() => {
    isLoading = false;
    renderRows();
  }, 180);

  CleanupRegistry.add(() => {
    if (filterTimer) clearTimeout(filterTimer);
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (searchLoadingTimer) clearTimeout(searchLoadingTimer);
    if (initialLoadTimer) clearTimeout(initialLoadTimer);
  });

  return root;
}

export { ordersView };
