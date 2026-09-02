import { CleanupRegistry } from "../../utils/cleanup.js";
import { dom } from "../../utils/dom.js";

const RecordDrawer = (() => {
  let root = null;
  let panel = null;
  let keydownHandler = null;
  let resizeHandler = null;
  let lastActiveElement = null;
  let titleCounter = 0;
  let cleanupRegistered = false;

  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  const getFocusable = () => (panel ? Array.from(panel.querySelectorAll(focusableSelector)) : []);

  const getViewportMetrics = () => {
    const visualViewport = window.visualViewport;
    const width = visualViewport ? visualViewport.width : window.innerWidth;
    return {
      width: Math.max(0, Math.floor(width || document.documentElement.clientWidth || 0)),
    };
  };

  const syncPanelViewport = () => {
    if (!panel) return;
    const viewport = getViewportMetrics();
    const maxPanelWidth = viewport.width >= 760 ? 480 : 440;
    const width = Math.min(viewport.width, maxPanelWidth);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(0, viewport.width - width)}px`;
    panel.style.right = "auto";
  };

  const addResizeListeners = () => {
    resizeHandler = syncPanelViewport;
    window.addEventListener("resize", resizeHandler);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", resizeHandler);
      window.visualViewport.addEventListener("scroll", resizeHandler);
    }
  };

  const removeResizeListeners = () => {
    if (!resizeHandler) return;
    window.removeEventListener("resize", resizeHandler);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", resizeHandler);
      window.visualViewport.removeEventListener("scroll", resizeHandler);
    }
    resizeHandler = null;
  };

  const trapFocus = (event) => {
    if (event.key !== "Tab" || !panel) return;
    const focusables = getFocusable();
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const registerCleanup = () => {
    if (cleanupRegistered) return;

    cleanupRegistered = true;
    CleanupRegistry.add(() => {
      close({ restoreFocus: false });
      cleanupRegistered = false;
    });
  };

  function close({ restoreFocus = true } = {}) {
    if (!root) return;

    if (keydownHandler) {
      document.removeEventListener("keydown", keydownHandler);
      keydownHandler = null;
    }
    removeResizeListeners();

    root.remove();
    root = null;
    panel = null;
    document.body.classList.remove("record-drawer-open");

    if (restoreFocus && lastActiveElement && document.contains(lastActiveElement)) {
      lastActiveElement.focus();
    }
    lastActiveElement = null;
  }

  const createDetailList = (items = []) => {
    const list = dom.h("dl", "record-drawer__details");
    items.forEach(({ label, value }) => {
      const group = dom.h("div", "record-drawer__detail");
      const term = dom.h("dt", "record-drawer__term");
      const description = dom.h("dd", "record-drawer__description");
      term.textContent = label;
      description.textContent = value;
      group.appendChild(term);
      group.appendChild(description);
      list.appendChild(group);
    });
    return list;
  };

  const open = ({ title, subtitle = "", body, trigger = null, fullDetailsLabel = "Pełny widok szczegółów - wkrótce" } = {}) => {
    close({ restoreFocus: false });
    lastActiveElement = trigger || document.activeElement;
    registerCleanup();

    root = dom.h("div", "record-drawer");
    root.setAttribute("data-record-drawer", "");

    const backdrop = dom.h("div", "record-drawer__backdrop");
    backdrop.setAttribute("aria-hidden", "true");

    panel = dom.h("aside", "record-drawer__panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    syncPanelViewport();

    const header = dom.h("div", "record-drawer__header");
    const headingWrap = dom.h("div", "record-drawer__heading");
    const titleEl = dom.h("h2", "record-drawer__title");
    titleEl.textContent = title || "Szczegóły rekordu";
    const titleId = `record-drawer-title-${++titleCounter}`;
    titleEl.id = titleId;
    panel.setAttribute("aria-labelledby", titleId);
    headingWrap.appendChild(titleEl);

    if (subtitle) {
      const subtitleEl = dom.h("p", "record-drawer__subtitle");
      subtitleEl.textContent = subtitle;
      headingWrap.appendChild(subtitleEl);
    }

    const closeButton = dom.h("button", "record-drawer__close");
    closeButton.textContent = "Zamknij";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Zamknij szczegóły");
    closeButton.addEventListener("click", () => close());

    header.appendChild(headingWrap);
    header.appendChild(closeButton);

    const content = dom.h("div", "record-drawer__body");
    if (typeof body === "string") {
      content.innerHTML = body;
    } else if (body) {
      content.appendChild(body);
    }

    const actions = dom.h("div", "record-drawer__actions");
    const fullDetailsButton = dom.h("button", "button button--ghost record-drawer__future-action");
    fullDetailsButton.textContent = fullDetailsLabel;
    fullDetailsButton.type = "button";
    fullDetailsButton.disabled = true;
    fullDetailsButton.setAttribute("aria-disabled", "true");
    actions.appendChild(fullDetailsButton);

    panel.appendChild(header);
    panel.appendChild(content);
    panel.appendChild(actions);
    root.appendChild(backdrop);
    root.appendChild(panel);

    backdrop.addEventListener("click", () => close());
    keydownHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      trapFocus(event);
    };
    document.addEventListener("keydown", keydownHandler);
    addResizeListeners();

    document.body.appendChild(root);
    document.body.classList.add("record-drawer-open");

    window.requestAnimationFrame(() => {
      const focusables = getFocusable();
      if (focusables.length) {
        focusables[0].focus();
      } else if (panel) {
        panel.setAttribute("tabindex", "-1");
        panel.focus();
      }
    });
  };

  return { open, close, createDetailList };
})();

export { RecordDrawer };
