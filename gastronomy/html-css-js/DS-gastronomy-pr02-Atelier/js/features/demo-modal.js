export function initDemoLegalModal() {
  var modal = document.getElementById("demo-legal-modal");
  if (!modal) return;
  var panel = modal.querySelector(".demo-legal-modal__panel");
  var acceptButton = modal.querySelector("[data-demo-legal-accept]");
  var closeTargets = modal.querySelectorAll("[data-demo-legal-close]");
  var storageKey = "kp-demo-accepted";
  var legacyStorageKey = "kp_demo_legal_ack";
  var lastActive = null;
  var isOpen = false;
  var prevBodyOverflow = "";

  function getStoredAck() {
    try {
      if (localStorage.getItem(storageKey) === "1") return true;
      if (localStorage.getItem(legacyStorageKey) === "1") {
        localStorage.setItem(storageKey, "1");
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  }

  function setStoredAck() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch (err) {}
  }

  function setModalInert(state) {
    if (!modal || typeof modal.setAttribute !== "function") return;
    if (state) {
      modal.setAttribute("inert", "");
    } else {
      modal.removeAttribute("inert");
    }
  }

  function lockBodyScroll() {
    prevBodyOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
  }

  function unlockBodyScroll() {
    document.body.style.overflow = prevBodyOverflow;
  }

  function getFocusableElements() {
    if (!panel) return [];
    var selectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(panel.querySelectorAll(selectors)).filter(function (el) {
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    });
  }

  function trapFocus(event) {
    if (!isOpen || event.key !== "Tab") return;
    var focusables = getFocusableElements();
    if (!focusables.length) {
      panel && panel.focus();
      event.preventDefault();
      return;
    }
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }

  function handleEscape(event) {
    if (!isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal(false);
    }
  }

  function openModal() {
    if (isOpen || getStoredAck()) return;
    isOpen = true;
    lastActive = document.activeElement;
    modal.hidden = false;
    setModalInert(false);
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    requestAnimationFrame(function () {
      modal.classList.add("is-open");
    });
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", trapFocus);
    var focusTarget = acceptButton || panel;
    focusTarget && focusTarget.focus && focusTarget.focus();
  }

  function closeModal(setAck) {
    if (!isOpen) return;
    if (setAck) setStoredAck();
    isOpen = false;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
    setModalInert(true);
    unlockBodyScroll();
    document.removeEventListener("keydown", handleEscape);
    document.removeEventListener("keydown", trapFocus);
    window.setTimeout(function () {
      modal.hidden = true;
    }, 200);
    if (lastActive && lastActive.focus) {
      lastActive.focus();
    }
  }

  closeTargets.forEach(function (el) {
    el.addEventListener("click", function () {
      closeModal(false);
    });
  });

  if (acceptButton) {
    acceptButton.addEventListener("click", function () {
      closeModal(true);
    });
  }

  openModal();
}
