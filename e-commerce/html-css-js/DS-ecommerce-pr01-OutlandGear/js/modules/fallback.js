import { on } from "./dom.js";

export const createFallbackNotice = ({
  message,
  actionLabel,
  onAction,
  role = "alert",
  polite = false,
}) => {
  const notice = document.createElement("div");
  notice.className = "notice notice--error";
  notice.setAttribute("role", role);
  notice.setAttribute("aria-live", polite ? "polite" : "assertive");

  const text = document.createElement("p");
  text.className = "notice__message";
  text.textContent = message;
  notice.appendChild(text);

  if (actionLabel && onAction) {
    const actions = document.createElement("div");
    actions.className = "notice__actions";

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "btn btn--outline btn--small";
    retryButton.textContent = actionLabel;
    on(retryButton, "click", onAction);

    actions.appendChild(retryButton);
    notice.appendChild(actions);
  }

  return notice;
};
