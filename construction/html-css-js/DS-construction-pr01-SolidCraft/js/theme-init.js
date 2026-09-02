(() => {
  const root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  try {
    const stored = localStorage.getItem("theme");

    const theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    root.dataset.theme = theme;
    root.classList.add("preload-theme");
  } catch {}

  window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() =>
      document.documentElement.classList.remove("preload-theme"),
    );
  });
})();
