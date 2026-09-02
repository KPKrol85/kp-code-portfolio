import { dom } from "../../utils/dom.js";

const Modal = (() => {
  let backdrop;
  let keydownHandler = null;
  let lastActiveElement = null;
  let titleCounter = 0;

  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  const getFocusable = (modal) => Array.from(modal.querySelectorAll(focusableSelector));

  const trapFocus = (event, modal) => {
    if (event.key !== "Tab") return;
    const focusables = getFocusable(modal);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !modal.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const close = () => {
    if (!backdrop) return;

    if (keydownHandler) {
      document.removeEventListener("keydown", keydownHandler);
      keydownHandler = null;
    }

    backdrop.remove();
    backdrop = null;

    if (lastActiveElement && document.contains(lastActiveElement)) {
      lastActiveElement.focus();
    }
    lastActiveElement = null;
  };

  const open = ({ title, body }) => {
    close();
    lastActiveElement = document.activeElement;

    backdrop = dom.h("div", "modal-backdrop");
    const modal = dom.h("div", "modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const header = dom.h("div", "modal-header");
    const titleEl = dom.h("h3", "", title || "");
    if (title) {
      const titleId = `modal-title-${++titleCounter}`;
      titleEl.setAttribute("id", titleId);
      modal.setAttribute("aria-labelledby", titleId);
    } else {
      modal.setAttribute("aria-label", "Dialog");
    }
    header.appendChild(titleEl);

    const closeBtn = dom.h("button", "modal-close", "x");
    closeBtn.setAttribute("aria-label", "Zamknij");
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const content = dom.h("div", "modal-body");
    if (typeof body === "string") content.innerHTML = body;
    else content.appendChild(body);
    modal.appendChild(content);

    backdrop.appendChild(modal);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });

    keydownHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      trapFocus(event, modal);
    };
    document.addEventListener("keydown", keydownHandler);

    document.body.appendChild(backdrop);

    window.requestAnimationFrame(() => {
      const focusables = getFocusable(modal);
      if (focusables.length) {
        focusables[0].focus();
      } else {
        modal.setAttribute("tabindex", "-1");
        modal.focus();
      }
    });
  };

  return { open, close };
})();

export { Modal };
