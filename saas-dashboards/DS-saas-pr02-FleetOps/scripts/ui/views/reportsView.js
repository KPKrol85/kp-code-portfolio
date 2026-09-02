import { FleetSeed } from "../../data/seed.js";
import { dom, escapeHtml, FleetUI } from "../../utils/dom.js";
import { Table } from "../components/table.js";
import { Toast } from "../components/toast.js";

function reportsView() {
  const root = dom.h("div");
  const header = dom.h("div", "module-header");

  header.innerHTML = `
    <div>
      <h2 class="module-header__title">Raporty</h2>
      <p class="module-header__meta">Wydajność i SLA</p>
    </div>

    <div class="toolbar">
      <button class="button button--secondary app-actions__button" id="exportReports" type="button">
        Eksportuj JSON
      </button>
    </div>
  `;

  root.appendChild(header);

  const chart = dom.h("div", "panel");
  chart.innerHTML = '<h3 class="panel__heading">Miks wydajności</h3><div class="grid report-mix-grid"></div>';
  const bars = chart.querySelector(".report-mix-grid");
  FleetSeed.reports.performance.forEach((item) => {
    const wrap = dom.h("div", "report-mix-grid__item");
    const value = Number(item.value) || 0;
  wrap.innerHTML = `
    <p class="report-mix-grid__label">${escapeHtml(item.label)}</p>
    <div class="progress-bar"><span style="width:${value}%;"></span></div>
    <strong class="report-mix-grid__value">${escapeHtml(value)}%</strong>
  `;
    bars.appendChild(wrap);
  });
  root.appendChild(chart);

  const summary = dom.h("div", "panel table-responsive table--app table--reports");
  const rows = FleetSeed.reports.summary.map((row) => `<tr><td>${escapeHtml(row.metric)}</td><td>${escapeHtml(row.value)}</td></tr>`);
  summary.innerHTML = Table.render(["Metryka", "Wartość"], rows, { className: "table--app" });
  root.appendChild(summary);

  header.querySelector("#exportReports").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(FleetSeed.reports, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fleetops-reports.json";
    a.click();
    URL.revokeObjectURL(url);
    Toast.show("Raport wyeksportowany", "success");
  });

  return root;
}

export { reportsView };
