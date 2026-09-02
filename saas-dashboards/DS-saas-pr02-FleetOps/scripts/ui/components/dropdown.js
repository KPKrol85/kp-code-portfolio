import { CleanupRegistry } from "../../utils/cleanup.js";

const Dropdown = (() => {
  const activeHandlers = new WeakMap();
  const registeredForCleanup = new WeakSet();

  const detach = (menu, returnFocus = true) => {
    const entry = activeHandlers.get(menu);
    if (entry) {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      document.removeEventListener("click", entry.handler);
      if (entry.keydownHandler) {
        document.removeEventListener("keydown", entry.keydownHandler);
      }
      activeHandlers.delete(menu);
      if (entry.trigger) {
        entry.trigger.setAttribute("aria-expanded", "false");
        if (returnFocus && document.contains(entry.trigger)) {
          entry.trigger.focus();
        }
      }
    }
    menu.classList.remove("open");
  };

  const toggle = (trigger, menu) => {
    const isOpen = menu.classList.contains("open");

    if (isOpen) {
      detach(menu, true);
      return;
    }

    detach(menu, false);

    const handler = (event) => {
      if (!menu.contains(event.target) && !trigger.contains(event.target)) {
        detach(menu, true);
      }
    };

    const keydownHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        detach(menu, true);
      }
    };

    const timeoutId = setTimeout(() => {
      const entry = activeHandlers.get(menu);
      if (!entry || entry.handler !== handler) return;
      entry.timeoutId = null;
      document.addEventListener("click", handler);
    }, 0);

    if (!trigger.hasAttribute("aria-expanded")) {
      trigger.setAttribute("aria-expanded", "false");
    }
    trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", keydownHandler);

    activeHandlers.set(menu, { handler, keydownHandler, trigger, timeoutId });
    menu.classList.add("open");

    if (!registeredForCleanup.has(menu)) {
      CleanupRegistry.add(() => detach(menu));
      registeredForCleanup.add(menu);
    }
  };

  return { toggle };
})();

export { Dropdown };
