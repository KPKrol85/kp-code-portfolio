export function initProjectBanner() {
  const banner = document.getElementById("projectBanner");
  const acceptBtn = document.getElementById("projectBannerAccept");

  if (!banner || !acceptBtn) return;

  const storageKey = "project-banner-accepted";
  const content = banner.querySelector(".project-modal__content");

  let accepted = null;

  try {
    accepted = localStorage.getItem(storageKey);
  } catch {}

  if (accepted) return;

  let lastFocus = null;

  const focusables = () =>
    Array.from(
      banner.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("hidden"));

  const dismiss = () => {
    banner.hidden = true;
    banner.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-project-modal");

    acceptBtn.removeEventListener("click", dismiss);
    document.removeEventListener("keydown", onKeydown);

    try {
      localStorage.setItem(storageKey, "true");
    } catch {}

    const restore =
      lastFocus?.isConnected && typeof lastFocus.focus === "function"
        ? lastFocus
        : document.body;

    restore.focus({ preventScroll: true });
    lastFocus = null;
  };

  const onKeydown = (e) => {
    if (e.key === "Escape") {
      dismiss();
      return;
    }

    if (e.key !== "Tab") return;

    const list = focusables();
    if (!list.length) return;

    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;

    if (!list.includes(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus({ preventScroll: true });
      return;
    }

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  const open = () => {
    lastFocus = document.activeElement;

    document.body.classList.add("has-project-modal");
    banner.hidden = false;
    banner.setAttribute("aria-hidden", "false");

    acceptBtn.addEventListener("click", dismiss);
    document.addEventListener("keydown", onKeydown);

    (content || focusables()[0] || banner).focus({ preventScroll: true });
  };

  open();
}
