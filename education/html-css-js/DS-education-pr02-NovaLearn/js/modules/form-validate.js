const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function initFormValidation() {
  const form = document.querySelector("[data-validate-form]");

  if (!form) {
    return;
  }

  const status = form.querySelector("[data-form-status]");

  const showError = (field, message) => {
    const error = field.parentElement.querySelector(".form__error");
    if (error) {
      error.textContent = message;
    }
    field.setAttribute("aria-invalid", "true");
  };

  const clearError = (field) => {
    const error = field.parentElement.querySelector(".form__error");
    if (error) {
      error.textContent = "";
    }
    field.removeAttribute("aria-invalid");
  };

  form.addEventListener("submit", (event) => {
    let isValid = true;

    const requiredFields = form.querySelectorAll("[data-required]");
    requiredFields.forEach((field) => {
      if (!field.value.trim()) {
        showError(field, "This field is required.");
        isValid = false;
        return;
      }

      if (field.type === "email" && !emailPattern.test(field.value)) {
        showError(field, "Please enter a valid email address.");
        isValid = false;
        return;
      }

      clearError(field);
    });

    if (!isValid) {
      event.preventDefault();
      if (status) {
        status.textContent = "Please review the highlighted fields.";
      }
      return;
    }

    if (status) {
      status.textContent = "Thanks! Your request is ready to be submitted.";
    }
  });
}
