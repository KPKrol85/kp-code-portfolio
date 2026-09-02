import { configurePermissionStoreAccess, FleetPermissions } from "../core/permissions.js";
import { FleetSeed } from "../data/seed.js";
import { Toast } from "../ui/components/toast.js";
import { FleetUI } from "../utils/dom.js";
import { FleetStorage } from "../utils/storage.js";

const defaultPreferences = {
  theme: FleetStorage.get("fleet-theme", "light"),
  compact: FleetStorage.get("fleet-compact", false),
  dashboardRangeDays: FleetStorage.get("fleet-dashboard-range", 30),
};

const defaultAuth = FleetStorage.get("fleet-auth", { isAuthenticated: false, user: null });
const DOMAIN_STORAGE_KEY = "fleet-domain-v1";
const ACTIVITY_STORAGE_KEY = "fleet-activity-v1";
const LIST_PREFS_STORAGE_KEY = "fleet-list-prefs-v1";
const CURRENT_USER_STORAGE_KEY = "fleet-current-user";
// Legacy key from the discarded offline-queue prototype (see AUDIT.md P1-06); purged so no stale demo data lingers.
const LEGACY_OFFLINE_QUEUE_KEY = "fleet-offline-queue";
FleetStorage.remove(LEGACY_OFFLINE_QUEUE_KEY);
const defaultCurrentUser = FleetStorage.get(
  CURRENT_USER_STORAGE_KEY,
  FleetPermissions.defaultUser
);

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);
const cloneList = (items = []) => items.map((item) => ({ ...item }));
const ensureIds = (items = [], prefix) =>
  items.map((item, index) => (item.id ? { ...item } : { ...item, id: `${prefix}-${String(index + 1).padStart(3, "0")}` }));
const isValidDomain = (data) =>
  data &&
  Array.isArray(data.orders) &&
  Array.isArray(data.fleet) &&
  Array.isArray(data.drivers);
const normalizeDomain = (data) => ({
  orders: ensureIds(cloneList(data.orders || []), "FO"),
  fleet: ensureIds(cloneList(data.fleet || []), "VH"),
  drivers: ensureIds(cloneList(data.drivers || []), "DRV"),
});
const buildDomainFromSeed = () =>
  normalizeDomain({
    orders: FleetSeed.orders || [],
    fleet: FleetSeed.vehicles || [],
    drivers: FleetSeed.drivers || [],
  });
const buildActivityFromSeed = () => cloneList(FleetSeed.activities || []);
const generateId = (prefix) => {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
};

const defaultFiltersFallback = {
  orders: { status: "all", priority: "all", search: "" },
  fleet: { status: "all", search: "" },
  drivers: { status: "all", search: "" },
};

const defaultFilters = FleetStorage.get("fleet-filters", defaultFiltersFallback);
const defaultListPrefsFallback = {
  orders: { sortBy: "updated", sortDir: "desc", pageSize: 10, visibleCount: 10 },
  fleet: { sortBy: "id", sortDir: "asc", pageSize: 10, visibleCount: 10 },
  drivers: { sortBy: "name", sortDir: "asc", pageSize: 10, visibleCount: 10 },
};
const defaultListPrefs = FleetStorage.get(LIST_PREFS_STORAGE_KEY, defaultListPrefsFallback);

const Store = {
  state: {
    auth: defaultAuth,
    currentUser: defaultCurrentUser,
    preferences: defaultPreferences,
    filters: defaultFilters,
    listPrefs: defaultListPrefs,
    domain: { orders: [], fleet: [], drivers: [] },
    activity: [],
    offline: {
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    },
  },
  listeners: [],
  domainReady: false,

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.persist();
    this.listeners.forEach((cb) => cb(this.state));
  },

  onChange(cb) {
    this.listeners.push(cb);
  },

  persist() {
    FleetStorage.set("fleet-theme", this.state.preferences.theme);
    FleetStorage.set("fleet-compact", this.state.preferences.compact);
    FleetStorage.set("fleet-dashboard-range", this.state.preferences.dashboardRangeDays);
    FleetStorage.set("fleet-auth", this.state.auth);
    FleetStorage.set(CURRENT_USER_STORAGE_KEY, this.state.currentUser);
    FleetStorage.set("fleet-filters", this.state.filters);
    FleetStorage.set(LIST_PREFS_STORAGE_KEY, this.state.listPrefs);
    FleetStorage.set(ACTIVITY_STORAGE_KEY, this.state.activity);
    if (this.domainReady) {
      FleetStorage.set(DOMAIN_STORAGE_KEY, this.state.domain);
    }
  },

  initDomain() {
    const stored = FleetStorage.get(DOMAIN_STORAGE_KEY, null);
    const domain = isValidDomain(stored) ? normalizeDomain(stored) : buildDomainFromSeed();
    this.domainReady = true;
    this.setState({ domain });
  },

  initActivity() {
    const stored = FleetStorage.get(ACTIVITY_STORAGE_KEY, null);
    const activity = Array.isArray(stored) ? cloneList(stored) : buildActivityFromSeed();
    this.setState({ activity });
  },

  resetDomainData() {
    const domain = buildDomainFromSeed();
    this.domainReady = true;
    this.setState({ domain });
  },

  updateDomainList(key, updater) {
    const current = this.state.domain[key] || [];
    const next = updater(current);
    this.setState({ domain: { ...this.state.domain, [key]: next } });
  },

  addOrder(payload = {}) {
    if (!this.ensureOnline()) return false;
    const now = nowIso();
    const createdBy = payload.createdBy || this.state.currentUser?.id || "u_admin_1";
    const order = {
      ...payload,
      id: payload.id || generateId("FO"),
      createdBy,
      createdAt: payload.createdAt || now,
      updatedAt: now,
      updated: payload.updated || now,
    };
    this.updateDomainList("orders", (list) => [...list, order]);
    return true;
  },

  updateOrder(id, patch = {}) {
    if (!this.ensureOnline()) return false;
    const now = nowIso();
    this.updateDomainList("orders", (list) =>
      list.map((item) =>
        item.id === id
          ? { ...item, ...patch, updatedAt: now, updated: now }
          : item
      )
    );
    return true;
  },

  deleteOrder(id) {
    if (!this.ensureOnline()) return false;
    this.updateDomainList("orders", (list) => list.filter((item) => item.id !== id));
    return true;
  },

  addActivity(payload = {}) {
    const activity = {
      title: payload.title || "Nowe zdarzenie",
      detail: payload.detail || "",
      time: payload.time || nowIso(),
    };
    const next = [activity, ...(this.state.activity || [])];
    this.setState({ activity: next });
  },

  addVehicle(payload = {}) {
    if (!this.ensureOnline()) return false;
    const now = nowIso();
    const createdBy = payload.createdBy || this.state.currentUser?.id || "u_admin_1";
    const vehicle = {
      ...payload,
      id: payload.id || generateId("VH"),
      createdBy,
      createdAt: payload.createdAt || now,
      updatedAt: now,
      lastCheck: payload.lastCheck || todayIso(),
    };
    this.updateDomainList("fleet", (list) => [...list, vehicle]);
    return true;
  },

  updateVehicle(id, patch = {}) {
    if (!this.ensureOnline()) return false;
    const now = nowIso();
    this.updateDomainList("fleet", (list) =>
      list.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: now } : item))
    );
    return true;
  },

  deleteVehicle(id) {
    if (!this.ensureOnline()) return false;
    this.updateDomainList("fleet", (list) => list.filter((item) => item.id !== id));
    return true;
  },

  addDriver(payload = {}) {
    if (!this.ensureOnline()) return false;
    const now = nowIso();
    const createdBy = payload.createdBy || this.state.currentUser?.id || "u_admin_1";
    const driver = {
      ...payload,
      id: payload.id || generateId("DRV"),
      createdBy,
      createdAt: payload.createdAt || now,
      updatedAt: now,
    };
    this.updateDomainList("drivers", (list) => [...list, driver]);
    return true;
  },

  updateDriver(id, patch = {}) {
    if (!this.ensureOnline()) return false;
    const now = nowIso();
    this.updateDomainList("drivers", (list) =>
      list.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: now } : item))
    );
    return true;
  },

  deleteDriver(id) {
    if (!this.ensureOnline()) return false;
    this.updateDomainList("drivers", (list) => list.filter((item) => item.id !== id));
    return true;
  },

  // The single place a theme value reaches the document. The attribute the
  // stylesheets read and the theme-specific logo/hero sources are applied from
  // that same value, so no render can observe one without the other. Every
  // theme write below goes through here, including the first one at boot.
  applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    FleetUI.syncThemeImages(theme);
  },

  // Boot entry: the persisted preference is authoritative for the first render.
  // The maintained documents ship the light asset URLs in their markup, so this
  // is what makes a dark first load show its own logo and hero without a toggle.
  initTheme() {
    this.setTheme(this.state.preferences.theme || "light");
  },

  toggleTheme() {
    const next = this.state.preferences.theme === "light" ? "dark" : "light";
    this.setState({ preferences: { ...this.state.preferences, theme: next } });
    this.applyTheme(next);
  },

  setTheme(theme) {
    this.setState({ preferences: { ...this.state.preferences, theme } });
    this.applyTheme(theme);
  },

  setCompact(compact) {
    this.setState({ preferences: { ...this.state.preferences, compact } });
    if (compact) document.body.dataset.compact = "true";
    else delete document.body.dataset.compact;
  },

  setDashboardRangeDays(days) {
    this.setState({ preferences: { ...this.state.preferences, dashboardRangeDays: days } });
  },

  setOrderFilters(partial) {
    const nextOrders = { ...this.state.filters.orders, ...partial };
    this.setState({ filters: { ...this.state.filters, orders: nextOrders } });
  },

  setFleetFilters(partial) {
    const nextFleet = { ...this.state.filters.fleet, ...partial };
    this.setState({ filters: { ...this.state.filters, fleet: nextFleet } });
  },

  setDriverFilters(partial) {
    const nextDrivers = { ...this.state.filters.drivers, ...partial };
    this.setState({ filters: { ...this.state.filters, drivers: nextDrivers } });
  },

  setListPrefs(moduleKey, patch) {
    const current = this.state.listPrefs[moduleKey] || {};
    const nextModule = { ...current, ...patch };
    this.setState({ listPrefs: { ...this.state.listPrefs, [moduleKey]: nextModule } });
  },

  setCurrentUser(user) {
    this.setState({ currentUser: user });
  },

  login(user) {
    this.setState({ auth: { isAuthenticated: true, user } });
  },

  logout() {
    this.logoutFlow({ redirectTo: "/login" });
  },

  logoutFlow(options = {}) {
    const { redirectTo = "/login", clearIntended = true, resetFilters = false } = options;

    if (clearIntended) {
      FleetStorage.remove("fleet-intended-route");
      FleetStorage.remove("fleet-last-route");
    }

    this.setState({ auth: { isAuthenticated: false, user: null } });

    if (resetFilters) {
      this.setState({ filters: defaultFiltersFallback });
    }

    window.location.hash = `#${redirectTo}`;
  },

  resetDemo() {
    const preservedAuth = this.state.auth;
    const preservedCurrentUser = this.state.currentUser;

    FleetStorage.remove("fleet-theme");
    FleetStorage.remove("fleet-compact");
    FleetStorage.remove("fleet-dashboard-range");
    FleetStorage.remove("fleet-filters");
    FleetStorage.remove(DOMAIN_STORAGE_KEY);
    FleetStorage.remove(ACTIVITY_STORAGE_KEY);
    FleetStorage.remove(LIST_PREFS_STORAGE_KEY);

    this.setState({
      auth: preservedAuth,
      currentUser: preservedCurrentUser,
      preferences: { theme: "light", compact: false, dashboardRangeDays: 30 },
      filters: defaultFiltersFallback,
      listPrefs: defaultListPrefsFallback,
      activity: buildActivityFromSeed(),
      offline: {
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      },
    });

    this.applyTheme("light");
    delete document.body.dataset.compact;

    this.resetDomainData();
  },

  setOnlineStatus(isOnline) {
    const offline = this.state.offline || { isOnline: true };
    const wasOffline = offline.isOnline === false;
    const next = { ...offline, isOnline: Boolean(isOnline) };
    this.setState({ offline: next });
    if (next.isOnline && wasOffline) {
      Toast.show("Połączenie przywrócone", "success");
    }
  },

  ensureOnline() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      Toast.show(
        "Tryb offline - zmiana nie została zapisana. Powtórz akcję po przywróceniu połączenia.",
        "warning",
        { assertive: true }
      );
      return false;
    }
    return true;
  },
};

configurePermissionStoreAccess({
  getCurrentUser: () => Store.state.currentUser,
  addActivity: (activity) => Store.addActivity(activity),
});

export { Store as FleetStore };
