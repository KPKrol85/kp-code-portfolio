import { q } from "../core/dom.js";

export function initForm() {
  var form = q(".form");
  var status = q("#form-status");
  if (!form) return;
  var progress = q("#form-progress");

  var hostFallback = q("#form-host-fallback");

  function shouldShowHostFallback(hostname) {
    if (!hostname) return true;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
    return hostname !== "gastronomy-project-02.netlify.app";
  }

  if (hostFallback && shouldShowHostFallback(window.location.hostname)) {
    hostFallback.hidden = false;
  }
  var nameInput = form.querySelector("#name");
  var emailInput = form.querySelector("#email");
  var messageInput = form.querySelector("#message");
  var fields = [nameInput, emailInput, messageInput].filter(Boolean);
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function pluralize(n, one, few, many) {
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (n === 1) return one;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
    return many;
  }

  function getError(field, value) {
    if (!field) return "";
    if (field.id === "name") {
      return value.length >= 2 ? "" : "Podaj imię i nazwisko (min. 2 znaki).";
    }
    if (field.id === "email") {
      return emailPattern.test(value) ? "" : "Wpisz poprawny adres e-mail.";
    }
    if (field.id === "message") {
      return value.length >= 10 ? "" : "Wiadomość powinna mieć co najmniej 10 znaków.";
    }
    return "";
  }

  function setFieldState(field, message) {
    var errorEl = field ? q("#error-" + field.id) : null;
    if (errorEl) errorEl.textContent = message || "";
    if (!field) return;
    if (message) {
      field.setAttribute("aria-invalid", "true");
      field.classList.add("is-invalid");
    } else {
      field.removeAttribute("aria-invalid");
      field.classList.remove("is-invalid");
    }
  }

  function validateField(field, show) {
    if (!field) return true;
    var value = field.value.trim();
    var message = getError(field, value);
    if (show) setFieldState(field, message);
    return !message;
  }

  function validateAll(show) {
    var firstInvalid = null;
    var allValid = true;
    fields.forEach(function (field) {
      var shouldShow = show || field.dataset.touched === "true";
      var ok = validateField(field, shouldShow);
      if (!ok && !firstInvalid) firstInvalid = field;
      allValid = allValid && ok;
    });
    return { valid: allValid, firstInvalid: firstInvalid };
  }

  function updateProgress() {
    if (!progress) return;
    var validCount = 0;
    fields.forEach(function (field) {
      if (validateField(field, false)) validCount++;
    });
    var remaining = fields.length - validCount;
    if (remaining <= 0) {
      progress.textContent = "Formularz gotowy do wysłania.";
      return;
    }
    var label = pluralize(remaining, "pole", "pola", "pól");
    progress.textContent = "Uzupełnij " + remaining + " " + label + ", aby wysłać.";
  }

  fields.forEach(function (field) {
    field.addEventListener("blur", function () {
      field.dataset.touched = "true";
      validateField(field, true);
      updateProgress();
    });
    field.addEventListener("input", function () {
      if (field.dataset.touched === "true") validateField(field, true);
      updateProgress();
    });
  });

  updateProgress();

  form.addEventListener("submit", function (event) {
    if (!fields.length) return;
    var result = validateAll(true);
    if (!result.valid) {
      event.preventDefault();
      status && (status.classList.remove("visually-hidden"), (status.textContent = "Uzupełnij poprawnie wyróżnione pola."));
      result.firstInvalid && result.firstInvalid.focus();
      return;
    }
    status && (status.classList.remove("visually-hidden"), (status.textContent = "Wysyłanie…"));
  });
}
