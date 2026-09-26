export const initTheme = () => {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  const applyTheme = (theme) => {
    document.body.classList.toggle("theme--light", theme === "light");
    document.body.classList.toggle("theme--dark", theme === "dark");
    toggle.textContent = theme === "light" ? "Tryb ciemny" : "Tryb jasny";
    localStorage.setItem("studio-noir-theme", theme);
  };

  const stored = localStorage.getItem("studio-noir-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = stored || (prefersDark ? "dark" : "light");

  applyTheme(initial);

  toggle.addEventListener("click", () => {
    const next = document.body.classList.contains("theme--light") ? "dark" : "light";
    applyTheme(next);
  });
};
