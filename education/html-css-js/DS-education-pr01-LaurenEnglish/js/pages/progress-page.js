import { TRACKS, WEEKDAY_LABELS } from "../data/progress.js";
import {
  exportProgressState,
  loadProgressState,
  resetProgressState,
  saveProgressState,
} from "../state/storage.js";

const MAX_STREAK_DAYS = 60;

const toLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatShortDate = (date) =>
  date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });

const getWeekStart = (date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getWeekDates = (date) => {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
};

const countWeekCheckIns = (checkIns, weekDates, trackId) =>
  weekDates.reduce((total, date) => {
    const key = toLocalDateKey(date);
    return total + (checkIns[key]?.[trackId] ? 1 : 0);
  }, 0);

const hasAnyActivity = (checkIns, dateKey) => {
  const entry = checkIns[dateKey];
  if (!entry) return false;
  return Object.values(entry).some(Boolean);
};

const calculateStreak = (checkIns) => {
  let streak = 0;
  const today = new Date();
  for (let offset = 0; offset < MAX_STREAK_DAYS; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = toLocalDateKey(date);
    if (!hasAnyActivity(checkIns, key)) break;
    streak += 1;
  }
  return streak;
};

const getPolishPlural = (value, singular, few, many) => {
  const normalized = Math.abs(Number(value));
  const lastTwoDigits = normalized % 100;
  const lastDigit = normalized % 10;

  if (normalized === 1) return singular;
  if (lastTwoDigits >= 12 && lastTwoDigits <= 14) return many;
  if (lastDigit >= 2 && lastDigit <= 4) return few;
  return many;
};

const formatSessionCount = (value) =>
  `${value} ${getPolishPlural(value, "sesja", "sesje", "sesji")}`;

const formatStreak = (value) =>
  `${value} ${getPolishPlural(value, "dzień", "dni", "dni")}`;

const formatCompletedGoal = (completed, goal) =>
  goal > 0 ? `${completed} z ${goal} sesji` : "Brak ustawionego celu";

const buildGoalOptions = (selected) =>
  [0, ...Array.from({ length: 7 }, (_, index) => index + 1)]
    .map((value) => {
      const label = value === 0 ? "Brak celu" : formatSessionCount(value);
      return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
    })
    .join("");

const renderProgressMeter = ({ completed, goal, label }) => {
  if (goal <= 0) {
    return `<div class="progress-meter is-empty" role="img" aria-label="${label}: Brak ustawionego celu"></div>`;
  }

  const value = Math.min(completed, goal);
  return `<progress class="progress-meter" value="${value}" max="${goal}" aria-label="${label}: ${formatCompletedGoal(completed, goal)}"></progress>`;
};

const renderTracks = ({ state, todayKey, weekDates }) =>
  TRACKS.map((track) => {
    const goal = state.goals[track.id];
    const todayDone = state.checkIns[todayKey]?.[track.id] === true;
    const weekCount = countWeekCheckIns(state.checkIns, weekDates, track.id);
    const progressText =
      goal > 0
        ? `W tym tygodniu: ${formatCompletedGoal(weekCount, goal)}`
        : "Brak ustawionego celu";

    return `
      <article class="card card--soft progress-card">
        <div class="progress-card__header">
          <h3 class="card__title">${track.label}</h3>
          <p class="card__text">${track.description}</p>
        </div>
        <div class="progress-card__controls">
          <div class="progress-card__goal">
            <label class="form__label" for="goal-${track.id}">Cel na ten tydzień</label>
            <span class="form__select progress-card__select">
              <select
                id="goal-${track.id}"
                class="form__input"
                data-goal-select
                data-track-id="${track.id}"
                data-focus-id="goal-${track.id}"
              >
                ${buildGoalOptions(goal)}
              </select>
            </span>
          </div>
          <div class="progress-card__checkin">
            <span class="progress-card__label">Dzisiejsza sesja:</span>
            <button
              class="button button--ghost progress-card__toggle"
              type="button"
              aria-label="Dzisiejsza sesja — ${track.label}: ${todayDone ? "Wykonane" : "Do zrobienia"}"
              aria-pressed="${todayDone}"
              data-checkin-toggle
              data-track-id="${track.id}"
              data-focus-id="checkin-${track.id}"
            >
              <span class="progress-card__toggle-indicator" aria-hidden="true">${todayDone ? "✓" : ""}</span>
              <span>${todayDone ? "Wykonane" : "Do zrobienia"}</span>
            </button>
          </div>
        </div>
        <div class="progress-card__progress">
          ${renderProgressMeter({
            completed: weekCount,
            goal,
            label: `Postęp tygodniowy: ${track.label}`,
          })}
          <p class="progress-card__summary">${progressText}</p>
        </div>
      </article>
    `;
  }).join("");

const renderWeekGrid = ({ state, weekDates }) => {
  const todayKey = toLocalDateKey(new Date());
  const headerCells = weekDates
    .map((date, index) => {
      const label = WEEKDAY_LABELS[index];
      const isToday = toLocalDateKey(date) === todayKey;
      return `
        <th scope="col" class="progress-week__header${isToday ? " is-today" : ""}"${isToday ? ' aria-current="date"' : ""}>
          <span class="progress-week__day">${label}</span>
          <span class="progress-week__date">${formatShortDate(date)}</span>
        </th>
      `;
    })
    .join("");

  const bodyRows = TRACKS.map((track) => {
    const cells = weekDates
      .map((date) => {
        const key = toLocalDateKey(date);
        const done = state.checkIns[key]?.[track.id] === true;
        const isToday = key === todayKey;
        return `
          <td class="progress-week__cell${isToday ? " is-today" : ""}">
            <span class="progress-week__marker ${done ? "is-done" : ""}" aria-hidden="true"></span>
            <span class="sr-only">${done ? "Wykonane" : "Brak aktywności"}</span>
          </td>
        `;
      })
      .join("");

    return `
      <tr>
        <th scope="row" class="progress-week__track">${track.label}</th>
        ${cells}
      </tr>
    `;
  }).join("");

  return `
    <div class="progress-week">
      <div class="progress-week__scroll">
        <table class="progress-week__table">
          <thead>
            <tr>
              <th scope="col">Obszar</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
      <ul class="progress-week__legend" aria-label="Legenda aktywności">
        <li><span class="progress-week__marker is-done" aria-hidden="true"></span>Wykonane</li>
        <li><span class="progress-week__marker" aria-hidden="true"></span>Brak aktywności</li>
      </ul>
    </div>
  `;
};

const renderStats = ({ state, weekDates }) => {
  const trackCards = TRACKS.map((track) => {
    const goal = state.goals[track.id];
    const count = countWeekCheckIns(state.checkIns, weekDates, track.id);
    const percent = goal > 0 ? Math.min(Math.round((count / goal) * 100), 100) : null;
    const detail = formatCompletedGoal(count, goal);

    return `
      <article class="card card--soft progress-stat">
        <h3 class="card__title">${track.label}</h3>
        ${
          percent === null
            ? '<p class="progress-stat__empty">Brak ustawionego celu</p>'
            : `<p class="progress-stat__value">${percent}%</p>`
        }
        <p class="card__text">${detail}</p>
        ${renderProgressMeter({
          completed: count,
          goal,
          label: `Realizacja celu: ${track.label}`,
        })}
      </article>
    `;
  }).join("");

  const streak = calculateStreak(state.checkIns);

  return `
    <div class="grid grid--cards">
      ${trackCards}
      <article class="card card--soft progress-stat">
        <h3 class="card__title">Seria nauki</h3>
        <p class="progress-stat__value">${formatStreak(streak)}</p>
        <p class="card__text">Kolejne dni z przynajmniej jedną wykonaną sesją.</p>
      </article>
    </div>
  `;
};

export const initProgressPage = () => {
  const root = document.querySelector("#progress-root");
  if (!root) return;

  const statusEl = root.querySelector("[data-progress-status]");
  const tracksContainer = root.querySelector("[data-progress-tracks]");
  const weekContainer = root.querySelector("[data-progress-week]");
  const statsContainer = root.querySelector("[data-progress-stats]");
  const actionButtons = Array.from(
    root.querySelectorAll("[data-progress-action]"),
  );
  if (
    !statusEl ||
    !tracksContainer ||
    !weekContainer ||
    !statsContainer ||
    actionButtons.length !== 2
  ) {
    return;
  }

  let state = loadProgressState();
  let statusTimeout;

  const setStatus = (message) => {
    if (!statusEl) return;
    statusEl.textContent = message;
    if (statusTimeout) window.clearTimeout(statusTimeout);
    statusTimeout = window.setTimeout(() => {
      statusEl.textContent = "";
    }, 2500);
  };

  const render = () => {
    const todayKey = toLocalDateKey(new Date());
    const weekDates = getWeekDates(new Date());
    const activeFocusId = document.activeElement?.dataset?.focusId;
    const tracksMarkup = renderTracks({ state, todayKey, weekDates });
    const weekMarkup = renderWeekGrid({ state, weekDates });
    const statsMarkup = renderStats({ state, weekDates });

    tracksContainer.innerHTML = tracksMarkup;
    weekContainer.innerHTML = weekMarkup;
    statsContainer.innerHTML = statsMarkup;

    if (activeFocusId) {
      const nextFocus = root.querySelector(
        `[data-focus-id="${activeFocusId}"]`,
      );
      if (nextFocus) nextFocus.focus();
    }
  };

  const handleGoalChange = (event) => {
    const select = event.target.closest("[data-goal-select]");
    if (!select) return;
    const trackId = select.dataset.trackId;
    const value = Number(select.value);
    if (!trackId || !Number.isInteger(value)) return;
    state = saveProgressState({
      ...state,
      goals: {
        ...state.goals,
        [trackId]: value,
      },
    });
    render();
    setStatus("Zaktualizowano cel na ten tydzień.");
  };

  const handleToggle = (event) => {
    const button = event.target.closest("[data-checkin-toggle]");
    if (!button) return;
    const trackId = button.dataset.trackId;
    if (!trackId) return;
    const todayKey = toLocalDateKey(new Date());
    const currentEntry = state.checkIns[todayKey] ?? {};
    const isDone = currentEntry[trackId] === true;

    const nextCheckIns = {
      ...state.checkIns,
      [todayKey]: {
        ...currentEntry,
        [trackId]: !isDone,
      },
    };

    state = saveProgressState({
      ...state,
      checkIns: nextCheckIns,
    });
    render();
    setStatus(
      isDone
        ? "Cofnięto dzisiejszą sesję."
        : "Zaznaczono dzisiejszą sesję.",
    );
  };

  const handleReset = () => {
    const confirmed = window.confirm(
      "Czy na pewno chcesz usunąć wszystkie cele, aktywności i statystyki dziennika? Tej operacji nie można cofnąć.",
    );
    if (!confirmed) return;
    resetProgressState();
    state = loadProgressState();
    render();
    setStatus("Usunięto dane dziennika.");
  };

  const handleExport = () => {
    const json = exportProgressState(state);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `postepy-${toLocalDateKey(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Wyeksportowano dane do pliku JSON.");
  };

  root.addEventListener("change", handleGoalChange);
  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-progress-action]");
    if (action) {
      if (action.dataset.progressAction === "reset") {
        handleReset();
      }
      if (action.dataset.progressAction === "export") {
        handleExport();
      }
    }
    handleToggle(event);
  });

  render();
  actionButtons.forEach((button) => {
    button.disabled = false;
  });
};
