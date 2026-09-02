const ALLOWED_TYPES = new Set(["loading", "empty", "error", "success", "info"]);

const getType = (type) => (ALLOWED_TYPES.has(type) ? type : "info");

export const clearUiState = (container) => {
  if (!container) return;
  container.hidden = true;
  container.textContent = "";
  container.className = "ui-state";
  container.removeAttribute("role");
  container.removeAttribute("aria-live");
};

export const setUiState = (container, options = {}) => {
  if (!container) return;
  const type = getType(options.type);
  const titleText = options.title?.trim() || "";
  const messageText = options.message?.trim() || "";
  const shouldAnnounce = options.announce !== false;

  container.hidden = false;
  container.className = `ui-state ui-state--${type}`;
  if (shouldAnnounce) {
    container.setAttribute("role", type === "error" ? "alert" : "status");
    container.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  } else {
    container.removeAttribute("role");
    container.removeAttribute("aria-live");
  }
  container.textContent = "";

  if (titleText) {
    const title = document.createElement("p");
    title.className = "ui-state__title";
    title.textContent = titleText;
    container.appendChild(title);
  }

  if (messageText) {
    const message = document.createElement("p");
    message.className = "ui-state__message";
    message.textContent = messageText;
    container.appendChild(message);
  }
};
