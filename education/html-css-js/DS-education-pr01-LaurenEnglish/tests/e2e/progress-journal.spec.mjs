import { expect, test } from "@playwright/test";

import { DEFAULT_GOALS, STORAGE_KEY } from "../../js/data/progress.js";
import {
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
} from "./helpers/runtime.mjs";

const FROZEN_TIMESTAMP = new Date(2026, 6, 26, 15, 30, 45).getTime();
const TODAY_KEY = "2026-07-26";

const freezeDate = (page) =>
  page.addInitScript((timestamp) => {
    const NativeDate = Date;

    class FrozenDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [timestamp]));
      }

      static now() {
        return timestamp;
      }
    }

    globalThis.Date = FrozenDate;
  }, FROZEN_TIMESTAMP);

const seedProgress = (page, state) =>
  page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: state },
  );

const openJournal = (page) =>
  page.goto("/postepy.html", { waitUntil: "domcontentloaded" });

test.beforeEach(async ({ page }) => {
  await freezeDate(page);
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
});

test("persists goal and check-in changes while preserving focus and live status", async ({
  page,
}) => {
  await seedProgress(page, {
    goals: { ...DEFAULT_GOALS },
    checkIns: {},
    updatedAt: new Date(FROZEN_TIMESTAMP).toISOString(),
  });
  const diagnostics = collectRuntimeDiagnostics(page);
  await openJournal(page);

  const goal = page.getByLabel("Cel na ten tydzień").first();
  await goal.focus();
  await expect(goal).toBeFocused();
  await goal.selectOption("5");
  await expect(goal).toHaveValue("5");
  await expect(goal).toBeFocused();
  await expect(page.getByRole("status")).toHaveText(
    "Zaktualizowano cel na ten tydzień.",
  );

  const checkIn = page.getByRole("button", {
    name: /Dzisiejsza sesja — Słownictwo/,
  });
  await checkIn.click();
  await expect(checkIn).toHaveAttribute("aria-pressed", "true");
  await expect(checkIn).toBeFocused();
  await expect(page.getByRole("status")).toHaveText(
    "Zaznaczono dzisiejszą sesję.",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Cel na ten tydzień").first()).toHaveValue("5");
  await expect(
    page.getByRole("button", { name: /Dzisiejsza sesja — Słownictwo/ }),
  ).toHaveAttribute("aria-pressed", "true");

  const persisted = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    STORAGE_KEY,
  );
  expect(persisted.goals.vocab).toBe(5);
  expect(persisted.checkIns[TODAY_KEY].vocab).toBe(true);
  expectCleanDiagnostics(diagnostics);
});

test("retains exactly the latest fourteen valid local dates across reload and export", async ({
  page,
}) => {
  const retainedKeys = Array.from({ length: 14 }, (_, offset) => {
    const date = new Date(2026, 6, 26 - offset, 12);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  const seededCheckIns = Object.fromEntries(
    retainedKeys.map((key, index) => [
      key,
      { grammar: index % 2 === 0, speaking: true, vocab: false },
    ]),
  );
  Object.assign(seededCheckIns, {
    "2026-07-12": { vocab: true },
    "2026-07-27": { vocab: true },
    "2026-02-29": { vocab: true },
    malformed: { vocab: true },
  });
  await seedProgress(page, {
    goals: { grammar: 4, speaking: 3, vocab: 6 },
    checkIns: seededCheckIns,
    updatedAt: "not-a-contract-value",
  });
  await openJournal(page);

  await page.getByLabel("Cel na ten tydzień").first().selectOption("7");
  const storedKeys = await page.evaluate(
    (key) => Object.keys(JSON.parse(localStorage.getItem(key)).checkIns),
    STORAGE_KEY,
  );
  expect(storedKeys).toEqual(retainedKeys);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Cel na ten tydzień").first()).toHaveValue("7");
  const downloadPromise = page.waitForEvent("download");
  const exportButton = page.getByRole("button", {
    name: "Eksportuj kopię JSON",
  });
  await exportButton.click();
  const download = await downloadPromise;
  const exported = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile(await download.path(), "utf8"),
  );

  expect(exported.goals).toEqual({ grammar: 4, speaking: 3, vocab: 7 });
  expect(Object.keys(exported.checkIns)).toEqual(retainedKeys);
  expect(exported.checkIns[retainedKeys.at(-1)]).toEqual({
    grammar: false,
    speaking: true,
    vocab: false,
  });
  expect(new Date(exported.updatedAt).toISOString()).toBe(exported.updatedAt);
  expect(new Date(exported.exportedAt).toISOString()).toBe(exported.exportedAt);
  await expect(exportButton).toBeFocused();
  await expect(page.getByRole("status")).toHaveText(
    "Wyeksportowano dane do pliku JSON.",
  );
});

test("reset clears persisted data and restores the initial journal contract", async ({
  page,
}) => {
  await seedProgress(page, {
    goals: { grammar: 6, speaking: 5, vocab: 7 },
    checkIns: { [TODAY_KEY]: { grammar: true, speaking: true, vocab: true } },
  });
  await openJournal(page);

  page.once("dialog", (dialog) => dialog.accept());
  const resetButton = page.getByRole("button", {
    name: "Wyczyść dane dziennika",
  });
  await resetButton.click();
  await expect(resetButton).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("Usunięto dane dziennika.");
  await expect(page.getByLabel("Cel na ten tydzień").first()).toHaveValue(
    String(DEFAULT_GOALS.vocab),
  );
  await expect(
    page.getByRole("button", { name: /Dzisiejsza sesja — Słownictwo/ }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBeNull();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Cel na ten tydzień").first()).toHaveValue(
    String(DEFAULT_GOALS.vocab),
  );
  await expect(
    page.getByRole("button", { name: /Dzisiejsza sesja — Słownictwo/ }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBeNull();
});

test("remains usable with blocked local storage and uses the in-memory fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  const diagnostics = collectRuntimeDiagnostics(page);
  await openJournal(page);

  const goal = page.getByLabel("Cel na ten tydzień").first();
  await goal.selectOption("4");
  await expect(goal).toHaveValue("4");
  const checkIn = page.getByRole("button", {
    name: /Dzisiejsza sesja — Słownictwo/,
  });
  await checkIn.click();
  await expect(checkIn).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toHaveText(
    "Zaznaczono dzisiejszą sesję.",
  );
  await expect(
    page.getByRole("button", { name: "Eksportuj kopię JSON" }),
  ).toBeEnabled();
  expectCleanDiagnostics(diagnostics);
});
