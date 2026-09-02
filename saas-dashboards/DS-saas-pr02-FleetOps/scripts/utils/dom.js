const h = (tag, className, content) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content !== undefined) {
    if (typeof content === 'string') el.innerHTML = content;
    else el.appendChild(content);
  }
  return el;
};

const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };

const mount = (selector, content) => {
  const target = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!target) return;
  clear(target);
  if (typeof content === 'string') target.innerHTML = content; else target.appendChild(content);
};

const dom = { h, clear, mount };

// Shared UI namespace. This module owns the object and other UI modules extend
// it through the exported binding.
const FleetUI = {};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

FleetUI.escapeHtml = escapeHtml;

const getMotionSafeScrollBehavior = () => {
  if (typeof window.matchMedia !== "function") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
};

FleetUI.getMotionSafeScrollBehavior = getMotionSafeScrollBehavior;

const getNamedFormField = (form, name) => {
  const field = form && form.elements ? form.elements.namedItem(name) : null;
  if (!field) return null;
  if (field.nodeType === 1) return field;
  return field[0] || null;
};

const syncDescribedBy = (field, id) => {
  if (!field || !id) return;
  const ids = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
  if (!ids.includes(id)) ids.push(id);
  field.setAttribute("aria-describedby", ids.join(" "));
};

const connectFieldErrors = (form, idPrefix) => {
  if (!form || !idPrefix) return;
  form.querySelectorAll("[data-error-for]").forEach((error) => {
    const name = error.dataset.errorFor;
    const field = getNamedFormField(form, name);
    if (!name || !field) return;

    const fieldId = field.id || `${idPrefix}-${name}`;
    const errorId = error.id || `${fieldId}-error`;
    field.id = fieldId;
    error.id = errorId;
    syncDescribedBy(field, errorId);
  });
};

const clearFormErrors = (form) => {
  if (!form) return;
  form.querySelectorAll("[data-error-for]").forEach((el) => {
    el.textContent = "";
  });
  form.querySelectorAll("[aria-invalid]").forEach((el) => {
    el.removeAttribute("aria-invalid");
  });
};

const setFieldError = (form, name, message) => {
  const field = getNamedFormField(form, name);
  const error = form ? form.querySelector(`[data-error-for="${name}"]`) : null;
  if (field) {
    if (message) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }
  if (error) error.textContent = message || "";
};

FleetUI.connectFieldErrors = connectFieldErrors;
FleetUI.clearFormErrors = clearFormErrors;
FleetUI.setFieldError = setFieldError;

// ===== Scroll-to-top binding =====
function bindLogoScroll(kind, getContainer) {
  const links = document.querySelectorAll(`[data-scroll-top="${kind}"]`);
  if (!links.length) return () => {};

  const cleanups = [];

  links.forEach((link) => {
    if (link.dataset.scrollBound === "true") {
      cleanups.push(() => {});
      return;
    }

    const handleClick = (event) => {
      const targetHash = kind === "app" ? "#/app" : "#/";
      const href = link.getAttribute("href") || "";
      const isStaticHomeLink = kind === "home" && href === "/";
      const currentHash = window.location.hash || "";
      const isCurrentStaticHome = isStaticHomeLink && window.location.pathname === "/" && (!currentHash || currentHash === "#/");
      const isCurrentHashTarget = !isStaticHomeLink && (currentHash || "#/") === targetHash;

      if (isCurrentStaticHome || isCurrentHashTarget) {
        event.preventDefault();
      } else if (isStaticHomeLink) {
        return;
      }

      window.setTimeout(() => {
        const container = getContainer ? getContainer() : null;
        const behavior = getMotionSafeScrollBehavior();
        if (container && typeof container.scrollTo === "function") {
          container.scrollTo({ top: 0, left: 0, behavior });
        } else {
          window.scrollTo({ top: 0, left: 0, behavior });
        }
      }, 0);
    };

    link.addEventListener("click", handleClick);
    link.dataset.scrollBound = "true";
    cleanups.push(() => {
      link.removeEventListener("click", handleClick);
      delete link.dataset.scrollBound;
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

FleetUI.bindLogoScroll = bindLogoScroll;

// ===== Theme-aware asset swapping =====
// The theme travels in as a value so the caller that owns it can apply the
// document attribute and the assets from the same one; reading it back off the
// document would make the result depend on when the attribute was written.
function syncThemeImages(theme = document.documentElement.getAttribute("data-theme"), root = document) {
  const useDark = (theme || "light") === "dark";

  root.querySelectorAll("[data-theme-src-light][data-theme-src-dark]").forEach((el) => {
    const next = useDark ? el.dataset.themeSrcDark : el.dataset.themeSrcLight;
    if (next && el.getAttribute("src") !== next) {
      el.setAttribute("src", next);
    }
  });

  root.querySelectorAll("[data-theme-srcset-light][data-theme-srcset-dark]").forEach((el) => {
    const next = useDark ? el.dataset.themeSrcsetDark : el.dataset.themeSrcsetLight;
    if (next && el.getAttribute("srcset") !== next) {
      el.setAttribute("srcset", next);
    }
  });
}

FleetUI.syncThemeImages = syncThemeImages;


// ===== Empty state =====
function emptyState({ title = "Brak danych", description = "", actionLabel = "", actionHref = "" } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "empty-state";
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionHref = escapeHtml(actionHref);

  wrap.innerHTML = `
    <div class="empty-state__card">
      <p class="tag">Brak</p>
      <h3 class="empty-state__title">${safeTitle}</h3>
      ${description ? `<p>${safeDescription}</p>` : ""}
      ${
        actionLabel && actionHref
          ? `<a class="button button--secondary" href="${safeActionHref}">${safeActionLabel}</a>`
          : ""
      }
    </div>
  `;

  return wrap;
}

FleetUI.emptyState = emptyState;

export {
  dom,
  FleetUI,
  escapeHtml,
  getMotionSafeScrollBehavior,
  connectFieldErrors,
  clearFormErrors,
  setFieldError,
  bindLogoScroll,
  syncThemeImages,
  emptyState,
};
