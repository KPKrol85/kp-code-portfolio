import { qs, on } from "./dom.js";
import {
  initFormFieldUX,
  setFormStatus,
  setSubmitState,
  validateFormFields,
} from "./form-ux.js";

const getSuccessUrl = (form) =>
  new URL(form.getAttribute("action") || window.location.href, window.location.href);

export const initNewsletterForm = () => {
  const form = qs("[data-newsletter-form]");
  if (!form) return;

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) setSubmitState(form, false);
  });

  form.noValidate = true;
  initFormFieldUX(form);

  on(form, "submit", (event) => {
    event.preventDefault();

    const { firstInvalidField } = validateFormFields(form);

    if (firstInvalidField) {
      setFormStatus(
        form,
        "Podaj poprawny adres e-mail, aby zapisać się do newslettera.",
        "error",
      );
      firstInvalidField.focus();
      return;
    }

    setSubmitState(form, true, "Zapisywanie...");
    setFormStatus(form, "Zapisywanie do listy pokazowej...", "info");

    window.setTimeout(() => {
      window.location.assign(getSuccessUrl(form));
    }, 500);
  });
};
