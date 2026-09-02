import { CONFIG } from "../config.js";
import { qs, on } from "./dom.js";
import { clearCart } from "./storage.js";
import { initFormFieldUX, setSubmitState, validateFormFields } from "./form-ux.js";
import { clearUiState, setUiState } from "./ui-state.js";

const getSuccessUrl = (form) =>
  new URL(form.getAttribute("action") || window.location.href, window.location.href);

export const initCheckout = () => {
  const form = qs(CONFIG.selectors.checkoutForm);
  if (!form) return;

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) setSubmitState(form, false);
  });

  const status =
    qs(CONFIG.selectors.checkoutStatus) || qs("[data-checkout-status]", form);

  form.noValidate = true;
  initFormFieldUX(form);

  on(form, "submit", (event) => {
    event.preventDefault();

    const { firstInvalidField } = validateFormFields(form);

    if (firstInvalidField) {
      setUiState(status, {
        type: "error",
        title: "Formularz zawiera błędy",
        message: "Uzupełnij wymagane pola i popraw oznaczone wartości.",
      });
      firstInvalidField.focus();
      return;
    }

    setSubmitState(form, true, "Składanie zamówienia...");

    clearCart();
    window.location.assign(getSuccessUrl(form));
  });

  on(form, "input", () => {
    clearUiState(status);
  });
};
