import { $, byTestId, log } from "./utils.js";

const normalizeDigits = (value) => value.replace(/\D/g, "");

const normalizePhone = (value) => {
  const digits = normalizeDigits(value);
  if (!digits) return "";

  let local = digits;
  if (local.startsWith("0048")) local = local.slice(4);
  if (local.startsWith("48") && local.length > 9) local = local.slice(2);
  return local.slice(0, 9);
};

const formatPhone = (value) => {
  const local = normalizePhone(value);
  if (!local) return "";

  const parts = [];
  for (let i = 0; i < local.length; i += 3) {
    parts.push(local.slice(i, i + 3));
  }

  return `+48 ${parts.join(" ")}`.trim();
};

const isValidPhone = (value) => normalizePhone(value).length === 9;

export function initReservationForm() {
  const form = byTestId("booking-form") || $(".booking-form") || $("#booking-form");
  const formMsg = $("#form-msg") || form?.querySelector(".booking-form__message--status");
  if (!form || !formMsg) return;

  const submitBtn = form.querySelector(".site-button--form");
  const phoneInput = form.querySelector("#phone");
  const phoneError = form.querySelector("#phone-error");
  const consentInput = form.querySelector("#consent");
  const consentError = form.querySelector("#consent-error");

  if (!formMsg.hasAttribute("aria-live")) formMsg.setAttribute("aria-live", "polite");
  if (!formMsg.hasAttribute("role")) formMsg.setAttribute("role", "status");

  const setLoading = (loading) => {
    if (!submitBtn) return;
    if (loading) {
      if (!submitBtn.dataset.label) submitBtn.dataset.label = submitBtn.textContent.trim();
      submitBtn.textContent = "Wysyłanie…";
      submitBtn.classList.add("site-button--loading");
      submitBtn.setAttribute("aria-busy", "true");
      submitBtn.disabled = true;
      return;
    }

    submitBtn.textContent = submitBtn.dataset.label || "Wyślij rezerwację";
    submitBtn.classList.remove("site-button--loading");
    submitBtn.removeAttribute("aria-busy");
    submitBtn.disabled = false;
  };

  const clearErrors = () => {
    if (phoneError) phoneError.textContent = "";
    if (consentError) consentError.textContent = "";
    phoneInput?.removeAttribute("aria-invalid");
    consentInput?.removeAttribute("aria-invalid");
    if (phoneInput) phoneInput.setCustomValidity("");
    if (consentInput) consentInput.setCustomValidity("");
  };

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      const formatted = formatPhone(phoneInput.value);
      phoneInput.value = formatted;
      if (phoneError) phoneError.textContent = "";
      phoneInput.removeAttribute("aria-invalid");
      phoneInput.setCustomValidity("");
    });
  }

  consentInput?.addEventListener("change", () => {
    if (consentInput.checked) {
      consentInput.removeAttribute("aria-invalid");
      if (consentError) consentError.textContent = "";
      consentInput.setCustomValidity("");
    }
  });

  form.addEventListener("submit", (event) => {
    if (submitBtn && submitBtn.classList.contains("site-button--loading")) {
      event.preventDefault();
      return;
    }

    if (form.company && form.company.value.trim() !== "") {
      event.preventDefault();
      formMsg.textContent = "Wykryto bota - zgłoszenie odrzucone.";
      return;
    }

    clearErrors();

    let valid = true;

    if (consentInput && !consentInput.checked) {
      valid = false;
      consentInput.setCustomValidity("Wyraź zgodę na przetwarzanie danych.");
      consentInput.setAttribute("aria-invalid", "true");
      if (consentError) {
        consentError.textContent = "Aby wysłać formularz, zaznacz zgodę.";
      }
    }

    if (phoneInput && !isValidPhone(phoneInput.value)) {
      valid = false;
      phoneInput.setCustomValidity("Podaj poprawny numer telefonu.");
      phoneInput.setAttribute("aria-invalid", "true");
      if (phoneError) {
        phoneError.textContent = "Podaj poprawny numer telefonu (np. +48 123 456 789).";
      }
    }

    if (!form.checkValidity()) valid = false;

    if (!valid) {
      event.preventDefault();
      form.reportValidity?.();
      formMsg.textContent = "Uzupełnij wymagane pola.";
      return;
    }

    if (window.fetch && window.FormData) {
      event.preventDefault();
      setLoading(true);
      formMsg.textContent = "";

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString()
      })
        .then(() => {
          formMsg.textContent = "Dziękujemy! Oddzwonimy, aby potwierdzić rezerwację.";
          form.reset();
          if (phoneInput) phoneInput.value = "";
          clearErrors();
        })
        .catch(() => {
          form.submit();
        })
        .finally(() => {
          setLoading(false);
        });
    }
  });

  log();
}

