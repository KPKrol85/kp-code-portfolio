import { Toast } from "../ui/components/toast.js";

const Roles = {
  ADMIN: "admin",
  DISPATCHER: "dispatcher",
  DRIVER: "driver",
};

const Actions = {
  ORDERS_CREATE: "orders:create",
  ORDERS_EDIT: "orders:edit",
  ORDERS_DELETE: "orders:delete",
  FLEET_CREATE: "fleet:create",
  FLEET_EDIT: "fleet:edit",
  FLEET_DELETE: "fleet:delete",
  DRIVERS_CREATE: "drivers:create",
  DRIVERS_EDIT: "drivers:edit",
  DRIVERS_DELETE: "drivers:delete",
};

const roleLabels = {
  [Roles.ADMIN]: "Administrator",
  [Roles.DISPATCHER]: "Dyspozytor",
  [Roles.DRIVER]: "Kierowca",
};

const getRoleLabel = (role) => roleLabels[role] || role || "Użytkownik";

const actionLabels = {
  [Actions.ORDERS_CREATE]: "tworzenie zleceń",
  [Actions.ORDERS_EDIT]: "edycja zleceń",
  [Actions.ORDERS_DELETE]: "usuwanie zleceń",
  [Actions.FLEET_CREATE]: "dodawanie pojazdów",
  [Actions.FLEET_EDIT]: "edycja pojazdów",
  [Actions.FLEET_DELETE]: "usuwanie pojazdów",
  [Actions.DRIVERS_CREATE]: "dodawanie kierowców",
  [Actions.DRIVERS_EDIT]: "edycja kierowców",
  [Actions.DRIVERS_DELETE]: "usuwanie kierowców",
};

const DemoUsers = [
  { id: "u_admin_1", role: Roles.ADMIN, displayName: "Administrator demo" },
  { id: "u_disp_1", role: Roles.DISPATCHER, displayName: "Dyspozytor demo" },
  { id: "u_drv_1", role: Roles.DRIVER, displayName: "Kierowca demo" },
];

const defaultUser = DemoUsers[0];

let storeAccess = null;

const configurePermissionStoreAccess = ({ getCurrentUser, addActivity }) => {
  if (typeof getCurrentUser !== "function" || typeof addActivity !== "function") {
    throw new TypeError("Permission store access requires getCurrentUser and addActivity callbacks.");
  }

  storeAccess = { getCurrentUser, addActivity };
};

// The store imports this module for the permission model, so importing the
// store back here would create a cycle. `store.js` registers these lazy accessors
// after constructing the store, keeping the dependency explicit without making
// module initialization order observable through a global fallback.
const requireStoreAccess = () => {
  if (!storeAccess) {
    throw new Error("Permission store access has not been configured.");
  }
  return storeAccess;
};

const resolveUser = (context = {}) =>
  context.user || requireStoreAccess().getCurrentUser() || defaultUser;

const isOwner = (record, user) => record && user && record.createdBy && record.createdBy === user.id;

const can = (action, context = {}) => {
  const user = resolveUser(context);
  if (!user || !action) return false;

  if (user.role === Roles.ADMIN) return true;

  if (user.role === Roles.DRIVER) {
    return false;
  }

  if (user.role === Roles.DISPATCHER) {
    if (action.endsWith(":create")) return true;
    if (action.endsWith(":delete")) return false;
    if (action.endsWith(":edit")) return isOwner(context.record, user);
  }

  return false;
};

const explainDeny = (action, context = {}) => {
  const user = resolveUser(context);
  const role = getRoleLabel(user && user.role);
  const actionLabel = actionLabels[action] || "akcja";

  if (user && user.role === Roles.DRIVER) {
    return `${role} ma tylko podgląd - ${actionLabel} zablokowane.`;
  }

  if (user && user.role === Roles.DISPATCHER && action && action.endsWith(":edit")) {
    return `Tylko własne rekordy - ${actionLabel} niedozwolone.`;
  }

  return `${role} nie ma uprawnień na ${actionLabel}.`;
};

const applyDisabledState = (el, allowed, message) => {
  if (!el) return;
  el.setAttribute("aria-disabled", allowed ? "false" : "true");
  const isDropdownItem = el.classList.contains("dropdown-item");
  if ("disabled" in el && !isDropdownItem) {
    el.disabled = !allowed;
  }
  if (!allowed) {
    if (message) el.setAttribute("title", message);
    el.classList.add("is-disabled");
  } else {
    el.removeAttribute("title");
    el.classList.remove("is-disabled");
  }
};

const guard = (action, context = {}) => {
  if (can(action, context)) return true;
  const message = explainDeny(action, context);
  Toast.show(`Brak uprawnień: ${message}`, "warning", { assertive: true });
  requireStoreAccess().addActivity({
    title: "Odmowa uprawnień",
    detail: message,
    time: new Date().toISOString(),
  });
  return false;
};

const FleetPermissions = {
  Roles,
  Actions,
  roleLabels,
  getRoleLabel,
  DemoUsers,
  defaultUser,
  can,
  explainDeny,
  applyDisabledState,
  guard,
};

export { configurePermissionStoreAccess, FleetPermissions };
