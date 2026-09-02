import { qs, on } from "./dom.js";
import {
  initFormFieldUX,
  setFormStatus,
  setSubmitState,
  validateFormFields,
} from "./form-ux.js";

const encodeFormBody = (form) => new URLSearchParams(new FormData(form)).toString();

export const initContactForm = () => {
  const form = qs("[data-contact-form]");
  if (!form) return;

  form.noValidate = true;
  initFormFieldUX(form);

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) setSubmitState(form, false);
  });

  on(form, "submit", async (event) => {
    event.preventDefault();

    const { firstInvalidField } = validateFormFields(form);

    if (firstInvalidField) {
      setFormStatus(form, "Popraw pola oznaczone błędem przed wysyłką.", "error");
      firstInvalidField.focus();
      return;
    }

    setSubmitState(form, true, "Wysyłanie wiadomości...");
    setFormStatus(form, "Wiadomość jest wysyłana...", "info");

    try {
      const response = await fetch("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: encodeFormBody(form),
      });

      if (!response.ok) {
        throw new Error(`Contact form request failed with status ${response.status}`);
      }

      const successTarget = form.getAttribute("action") || "kontakt-wyslano.html";
      window.location.assign(successTarget);
    } catch (error) {
      setSubmitState(form, false);
      setFormStatus(
        form,
        "Nie udało się wysłać wiadomości. Sprawdź połączenie i spróbuj ponownie.",
        "error",
      );
      console.error("Contact form submission error", error);
    }
  });

  on(form, "input", () => {
    setFormStatus(form, "", "info");
  });
};
