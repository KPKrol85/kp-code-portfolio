import { dom } from "../../utils/dom.js";

const Toast = (() => {
  let container;
  let statusRegion;
  let alertRegion;

  const ensureRegion = (id, role, live) => {
    let region = document.getElementById(id);
    if (!region) {
      region = dom.h("div", "sr-only");
      region.id = id;
      document.body.appendChild(region);
    }
    region.setAttribute("role", role);
    region.setAttribute("aria-live", live);
    region.setAttribute("aria-atomic", "true");
    return region;
  };

  const ensure = () => {
    if (!container) {
      container = dom.h("div", "toast-container");
      document.body.appendChild(container);
    }
    statusRegion = statusRegion || ensureRegion("fleetops-toast-status", "status", "polite");
    alertRegion = alertRegion || ensureRegion("fleetops-toast-alert", "alert", "assertive");
    return container;
  };

  const announce = (region, text) => {
    region.textContent = "";
    window.setTimeout(() => {
      region.textContent = text;
    }, 0);
  };

  const show = (message, tone = "default", options = {}) => {
    const c = ensure();
    const text = String(message ?? "");
    const toneClass = /^[a-z0-9_-]+$/i.test(String(tone)) ? String(tone) : "default";
    const toast = dom.h("div", "toast");
    const badge = dom.h("span", "badge");
    badge.classList.add(toneClass);
    badge.textContent = toneClass === "success" ? "✓" : "•";
    toast.appendChild(badge);
    toast.appendChild(document.createTextNode(text));
    c.appendChild(toast);
    announce(options && options.assertive ? alertRegion : statusRegion, text);
    setTimeout(() => toast.remove(), 2600);
  };
  return { show };
})();

export { Toast };
