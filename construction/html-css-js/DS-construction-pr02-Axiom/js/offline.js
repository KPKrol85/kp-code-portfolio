(function () {
  const btn = document.getElementById("retryBtn");
  const status = document.getElementById("netStatus");
  const reload = () => window.location.reload();

  if (btn) btn.addEventListener("click", reload);
  window.addEventListener("online", () => {
    if (status) status.textContent = "Połączenie przywrócone. Odświeżam stronę.";
    reload();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") reload();
  });
})();
