(function () {
  const btn = document.getElementById("retryBtn");
  if (btn) btn.addEventListener("click", () => location.reload());
  window.addEventListener("online", () => location.reload());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") location.reload();
  });
})();
