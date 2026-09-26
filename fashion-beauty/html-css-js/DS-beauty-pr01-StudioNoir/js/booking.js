export const initBooking = () => {
  const root = document.querySelector("[data-booking]");
  if (!root) return;

  const serviceButtons = root.querySelectorAll("[data-booking-service]");
  const stylistButtons = root.querySelectorAll("[data-booking-stylist]");
  const summaryService = root.querySelector("[data-summary-service]");
  const summaryStylist = root.querySelector("[data-summary-stylist]");
  const summaryStatus = root.querySelector("[data-summary-status]");
  const cta = root.querySelector("[data-booking-cta]");

  let selectedService = null;
  let selectedStylist = null;

  const updateSummary = () => {
    summaryService.textContent = selectedService || "—";
    summaryStylist.textContent = selectedStylist || "—";

    if (selectedService && selectedStylist) {
      summaryStatus.textContent = "Gotowe do potwierdzenia";
      cta.removeAttribute("disabled");
    } else {
      summaryStatus.textContent = "Wybierz opcje";
      cta.setAttribute("disabled", "true");
    }
  };

  const handleSelect = (buttons, value, setter) => {
    buttons.forEach((btn) => btn.classList.remove("is-selected"));
    setter(value);
    buttons.forEach((btn) => {
      if (btn.textContent === value) {
        btn.classList.add("is-selected");
      }
    });
    updateSummary();
  };

  serviceButtons.forEach((button) => {
    button.addEventListener("click", () =>
      handleSelect(serviceButtons, button.textContent, (value) => {
        selectedService = value;
      })
    );
  });

  stylistButtons.forEach((button) => {
    button.addEventListener("click", () =>
      handleSelect(stylistButtons, button.textContent, (value) => {
        selectedStylist = value;
      })
    );
  });

  cta.addEventListener("click", () => {
    if (!selectedService || !selectedStylist) return;
    summaryStatus.textContent = "Rezerwacja wstępnie zapisana";
    cta.textContent = "Wysłano";
    cta.setAttribute("disabled", "true");
  });

  updateSummary();
};
