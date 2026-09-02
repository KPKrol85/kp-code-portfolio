import { dom } from "../../utils/dom.js";

function notFoundView() {
  const root = dom.h("div", "panel not-found-panel");

  root.innerHTML = `
    <div class="module-header not-found-panel__header">
      <h2 class="module-header__title">Nie znaleziono</h2>
    </div>
    <p class="module-header__meta not-found-panel__copy">
      Ta sekcja nie istnieje w aplikacji.
    </p>
    <a class="button button--primary" href="#/app">Wróć do dashboardu</a>
  `;

  return root;
}

export { notFoundView };
