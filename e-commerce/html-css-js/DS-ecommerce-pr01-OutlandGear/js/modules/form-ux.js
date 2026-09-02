import { qs, qsa, on } from "./dom.js";

const FIELD_SELECTOR = "input, select, textarea";

const isEligibleField = (input) => {
  const type = input.type ? input.type.toLowerCase() : "";
  return (
    !input.disabled &&
    type !== "hidden" &&
    type !== "submit" &&
    type !== "button" &&
    type !== "reset"
  );
};

const getErrorTarget = (form, input) => {
  const key = input.name || input.id;
  if (!key) return null;
  return qs(`[data-error-for="${key}"]`, form);
};

const getFriendlyMessage = (input) => {
  const validity = input.validity;
  if (validity.valueMissing) return "To pole jest wymagane.";
  if (validity.typeMismatch && input.type === "email")
    return "Podaj poprawny adres e-mail.";
  if (validity.patternMismatch && input.name === "zip")
    return "Użyj formatu kodu pocztowego 00-000.";
  if (validity.tooShort) return `Wpisz co najmniej ${input.minLength} znaki.`;
  return input.validationMessage || "Sprawdź poprawność tego pola.";
};

export const showFieldError = (form, input, message = getFriendlyMessage(input)) => {
  const error = getErrorTarget(form, input);
  if (error) {
    if (!error.id) {
      const key = input.name || input.id;
      error.id = `${key}-error`;
    }
    error.textContent = message;
  }

  input.setAttribute("aria-invalid", "true");

  if (error && error.id) {
    const describedBy = new Set(
      (input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean),
    );
    describedBy.add(error.id);
    input.setAttribute("aria-describedby", Array.from(describedBy).join(" "));
  }
};

export const clearFieldError = (form, input) => {
  const error = getErrorTarget(form, input);
  if (error) {
    error.textContent = "";
  }
  input.removeAttribute("aria-invalid");
};

export const setFormStatus = (form, message, state = "info") => {
  const status = qs("[data-form-status]", form);
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
};

export const setSubmitState = (form, isBusy, busyLabel = "Wysyłanie...") => {
  const submitButton = qs('button[type="submit"]', form);
  if (!submitButton) return;

  if (!submitButton.dataset.defaultLabel) {
    submitButton.dataset.defaultLabel = submitButton.textContent.trim();
  }

  submitButton.disabled = isBusy;
  submitButton.setAttribute("aria-busy", String(isBusy));
  submitButton.textContent = isBusy ? busyLabel : submitButton.dataset.defaultLabel;
};

export const validateFormFields = (form) => {
  const fields = qsa(FIELD_SELECTOR, form).filter(isEligibleField);
  let firstInvalidField = null;

  fields.forEach((input) => {
    if (!input.checkValidity()) {
      showFieldError(form, input);
      if (!firstInvalidField) firstInvalidField = input;
      return;
    }

    clearFieldError(form, input);
  });

  return { fields, firstInvalidField };
};

export const initFormFieldUX = (form) => {
  if (!form) return;

  const fields = qsa(FIELD_SELECTOR, form).filter(isEligibleField);
  fields.forEach((input) => {
    on(input, "input", () => {
      if (input.checkValidity()) {
        clearFieldError(form, input);
      }
    });

    on(input, "blur", () => {
      if (!input.checkValidity()) {
        showFieldError(form, input);
      }
    });
  });
};
