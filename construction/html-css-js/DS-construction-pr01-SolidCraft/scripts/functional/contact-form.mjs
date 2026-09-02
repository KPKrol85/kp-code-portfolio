/* Contact-form scenarios — validation, anti-spam timing, and the two
   submission outcomes.

   The four paths are kept apart on purpose: each one is a separate page in a
   separate context, so a failure names the path that broke instead of a step
   inside one long chain.

   Nothing here talks to Netlify. The form posts to its own relative action, so
   the request cannot leave 127.0.0.1 in the first place; on top of that the
   submission paths intercept it inside Playwright and answer it locally, which
   is also how the failure path gets a deterministic non-2xx response. The
   harness fails any scenario that issues an off-origin request. */

import {
  ANTI_SPAM_WINDOW_MS,
  AssertionError,
  DESKTOP_VIEWPORT,
  assert,
  assertEqual,
  assertFocusOn,
  assertIncludes,
  openPage,
  waitOutAntiSpamWindow,
  withPage,
} from "./harness.mjs";

const FORM = "section#kontakt .form";
const NOTE = `${FORM} .form-note`;
const SUBMIT = `${FORM} button[type="submit"]`;
const SUBMIT_URL = "**/thank-you.html";

const MESSAGES = {
  validation: "Uzupełnij poprawnie wszystkie pola i zaznacz zgodę.",
  tooFast: "Odczekaj chwilę i spróbuj ponownie.",
  success: "Dziękujemy! Skontaktujemy się wkrótce.",
  failure: "Nie udało się wysłać formularza. Spróbuj ponownie.",
};

const VALID_INPUT = {
  name: "Jan Kowalski",
  phone: "533537091",
  formattedPhone: "533 537 091",
  msg: "Proszę o wycenę remontu łazienki w bloku.",
};

/* Answers the form's own POST locally and records what was sent. Non-POST
   traffic to the same URL is left alone, so the thank-you page keeps working
   as a normal document. */
async function interceptSubmission(context, { status }) {
  const submissions = [];

  await context.route(SUBMIT_URL, async (route) => {
    const request = route.request();

    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    submissions.push({
      method: request.method(),
      contentType: request.headers()["content-type"] || "",
      body: request.postData() || "",
    });

    await route.fulfill({
      status,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><title>Intercepted submission</title>",
    });
  });

  return submissions;
}

/* initContactForm() upgrades the status paragraph to role="status"; waiting
   for that is how a scenario knows the module — and its anti-spam timer — has
   started. The returned timestamp is therefore at or after the timer's start. */
async function openContactForm(page, { waitUntil = "load" } = {}) {
  await openPage(page, "/index.html", { waitUntil });
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector(
          'section#kontakt .form .form-note[role="status"]',
        ),
      ),
    null,
    { timeout: 5000 },
  );
  return Date.now();
}

async function fillValidForm(page) {
  await page.locator("#f-name").fill(VALID_INPUT.name);
  await page.locator("#f-phone").fill(VALID_INPUT.phone);
  await page.locator("#f-msg").fill(VALID_INPUT.msg);
  await page.locator("#f-consent").check();
}

async function readFormState(page) {
  return page.evaluate(() => {
    const form = document.querySelector("section#kontakt .form");
    const note = form.querySelector(".form-note");
    const field = (id) => document.getElementById(id);
    const error = (id) => {
      const el = document.getElementById(id);
      return {
        text: (el.textContent || "").trim(),
        clipped: el.classList.contains("visually-hidden"),
        height: Math.round(el.getBoundingClientRect().height),
      };
    };

    return {
      nativeValidationDisabled: form.noValidate,
      busy: form.getAttribute("aria-busy"),
      submitDisabled: form.querySelector('button[type="submit"]').disabled,
      note: {
        text: (note.textContent || "").trim(),
        ok: note.classList.contains("is-ok"),
        err: note.classList.contains("is-err"),
        live: note.getAttribute("aria-live"),
      },
      values: {
        name: field("f-name").value,
        phone: field("f-phone").value,
        msg: field("f-msg").value,
        consent: field("f-consent").checked,
      },
      invalid: {
        name: field("f-name").getAttribute("aria-invalid"),
        phone: field("f-phone").getAttribute("aria-invalid"),
        msg: field("f-msg").getAttribute("aria-invalid"),
        consent: field("f-consent").getAttribute("aria-invalid"),
      },
      errors: {
        name: error("f-name-error"),
        phone: error("f-phone-error"),
        msg: error("f-msg-error"),
        consent: error("f-consent-error"),
      },
    };
  });
}

/* The submission paths settle asynchronously, so the scenarios wait for the
   status region to reach its expected text instead of sleeping. */
async function waitForNote(page, expected, context) {
  try {
    await page.waitForFunction(
      (text) =>
        document
          .querySelector("section#kontakt .form .form-note")
          ?.textContent.trim() === text,
      expected,
      { timeout: 8000 },
    );
  } catch {
    const actual = await page.locator(NOTE).textContent();
    throw new AssertionError(
      `${context} — expected the status region to read ${JSON.stringify(expected)}, it reads ${JSON.stringify((actual || "").trim())}`,
    );
  }
}

function assertVisibleError(error, expected, context) {
  assertEqual(error.text, expected, `${context} — error text`);
  assert(
    !error.clipped,
    `${context} — the error message should leave its visually-hidden state`,
  );
  assert(
    error.height > 1,
    `${context} — the error message should be rendered, measured ${error.height} px tall`,
  );
}

const contactFormScenarios = [
  {
    name: "contact-form-rejects-an-empty-submission",
    async run({ browser, baseURL }) {
      await withPage(
        browser,
        { baseURL, viewport: DESKTOP_VIEWPORT },
        async ({ context, page }) => {
          const submissions = await interceptSubmission(context, {
            status: 200,
          });
          const initialisedAt = await openContactForm(page);
          await waitOutAntiSpamWindow(page, initialisedAt);

          await page.locator(SUBMIT).click();
          await waitForNote(
            page,
            MESSAGES.validation,
            "submitting the empty form",
          );

          const state = await readFormState(page);

          assert(
            state.nativeValidationDisabled,
            "the form should keep novalidate so the custom path owns validation",
          );
          assertEqual(
            state.invalid.name,
            "true",
            "the empty name field should be marked invalid",
          );
          assertEqual(
            state.invalid.phone,
            "true",
            "the empty phone field should be marked invalid",
          );
          assertEqual(
            state.invalid.msg,
            "true",
            "the empty message field should be marked invalid",
          );
          assertEqual(
            state.invalid.consent,
            "true",
            "the unchecked consent box should be marked invalid",
          );

          assertVisibleError(
            state.errors.name,
            "Podaj imię i nazwisko (min. 2 znaki).",
            "name field",
          );
          assertVisibleError(
            state.errors.phone,
            "Podaj numer telefonu.",
            "phone field",
          );
          assertVisibleError(
            state.errors.msg,
            "Napisz krótki opis prac.",
            "message field",
          );
          assertVisibleError(
            state.errors.consent,
            "Wymagana zgoda na kontakt w celu wyceny.",
            "consent field",
          );

          assertEqual(
            state.note.live,
            "polite",
            "the validation summary should be announced politely",
          );
          assert(
            state.note.err,
            "the validation summary should be styled as an error",
          );
          await assertFocusOn(
            page,
            "#f-name",
            "validation should move focus to the first invalid field",
          );
          assertEqual(
            submissions.length,
            0,
            "an invalid form should not be submitted",
          );
        },
      );
    },
  },

  {
    name: "contact-form-holds-a-submission-inside-the-anti-spam-window",
    async run({ browser, baseURL }) {
      await withPage(
        browser,
        { baseURL, viewport: DESKTOP_VIEWPORT },
        async ({ context, page }) => {
          const submissions = await interceptSubmission(context, {
            status: 200,
          });

          /* Measured before navigation, so the form's own timer can only have
             started later — everything below happens inside its window. */
          const beforeNavigation = Date.now();
          await openContactForm(page, { waitUntil: "domcontentloaded" });
          await fillValidForm(page);

          const elapsed = Date.now() - beforeNavigation;
          assert(
            elapsed < ANTI_SPAM_WINDOW_MS - 200,
            `harness setup took ${elapsed} ms, too slow to submit inside the ${ANTI_SPAM_WINDOW_MS} ms anti-spam window`,
          );

          await page.locator(SUBMIT).click();
          await waitForNote(
            page,
            MESSAGES.tooFast,
            "submitting inside the anti-spam window",
          );

          const state = await readFormState(page);

          assert(
            state.note.err,
            "the retry message should be styled as an error",
          );
          assertEqual(
            state.values.name,
            VALID_INPUT.name,
            "the entered name should survive the rejection",
          );
          assertEqual(
            state.values.phone,
            VALID_INPUT.formattedPhone,
            "the entered phone should survive the rejection",
          );
          assertEqual(
            state.values.msg,
            VALID_INPUT.msg,
            "the entered message should survive the rejection",
          );
          assertEqual(
            state.values.consent,
            true,
            "the given consent should survive the rejection",
          );
          assertEqual(
            state.busy,
            null,
            "a held submission should never enter the busy state",
          );
          assertEqual(
            state.submitDisabled,
            false,
            "the submit button should stay usable for the retry",
          );
          assertEqual(
            submissions.length,
            0,
            "a submission inside the anti-spam window should not be sent",
          );
        },
      );
    },
  },

  {
    name: "contact-form-posts-a-valid-submission",
    async run({ browser, baseURL }) {
      await withPage(
        browser,
        { baseURL, viewport: DESKTOP_VIEWPORT },
        async ({ context, page }) => {
          const submissions = await interceptSubmission(context, {
            status: 200,
          });
          const initialisedAt = await openContactForm(page);

          await fillValidForm(page);
          await waitOutAntiSpamWindow(page, initialisedAt);
          await page.locator(SUBMIT).click();
          await waitForNote(page, MESSAGES.success, "a valid submission");

          assertEqual(
            submissions.length,
            1,
            "a valid submission should send exactly one request",
          );

          const [submission] = submissions;
          assertEqual(submission.method, "POST", "the form should use POST");
          assertIncludes(
            submission.contentType,
            "application/x-www-form-urlencoded",
            "the form should post url-encoded data",
          );

          const body = new URLSearchParams(submission.body);
          assertEqual(
            body.get("form-name"),
            "contact",
            "the posted body should carry the Netlify form name",
          );
          assertEqual(
            body.get("name"),
            VALID_INPUT.name,
            "the posted body should carry the entered name",
          );
          assertEqual(
            body.get("phone"),
            VALID_INPUT.formattedPhone,
            "the posted body should carry the masked phone number",
          );
          assertEqual(
            body.get("msg"),
            VALID_INPUT.msg,
            "the posted body should carry the entered message",
          );
          assertEqual(
            body.get("consent"),
            "yes",
            "the posted body should carry the consent value",
          );

          const state = await readFormState(page);

          assert(
            state.note.ok,
            "the success message should be styled as a success",
          );
          assertEqual(
            state.values.name,
            "",
            "a successful submission should reset the name field",
          );
          assertEqual(
            state.values.phone,
            "",
            "a successful submission should reset the phone field",
          );
          assertEqual(
            state.values.msg,
            "",
            "a successful submission should reset the message field",
          );
          assertEqual(
            state.values.consent,
            false,
            "a successful submission should reset the consent box",
          );
          assertEqual(
            state.busy,
            "false",
            "the form should leave its busy state after a successful submission",
          );
          assertEqual(
            state.submitDisabled,
            false,
            "the submit button should be usable again after a successful submission",
          );
          await assertFocusOn(
            page,
            `${FORM} .form-note`,
            "a successful submission should move focus to the status region",
          );
        },
      );
    },
  },

  {
    name: "contact-form-reports-a-failed-submission",
    async run({ browser, baseURL }) {
      await withPage(
        browser,
        { baseURL, viewport: DESKTOP_VIEWPORT },
        async ({ context, page }) => {
          const submissions = await interceptSubmission(context, {
            status: 500,
          });
          const initialisedAt = await openContactForm(page);

          await fillValidForm(page);
          await waitOutAntiSpamWindow(page, initialisedAt);
          await page.locator(SUBMIT).click();
          await waitForNote(page, MESSAGES.failure, "a rejected submission");

          assertEqual(
            submissions.length,
            1,
            "a rejected submission should still have been attempted once",
          );

          const state = await readFormState(page);

          assert(
            state.note.err,
            "the failure message should be styled as an error",
          );
          assertEqual(
            state.values.name,
            VALID_INPUT.name,
            "a failed submission should keep the entered name",
          );
          assertEqual(
            state.values.msg,
            VALID_INPUT.msg,
            "a failed submission should keep the entered message",
          );
          assertEqual(
            state.values.consent,
            true,
            "a failed submission should keep the given consent",
          );
          assertEqual(
            state.busy,
            "false",
            "the form should leave its busy state after a failed submission",
          );
          assertEqual(
            state.submitDisabled,
            false,
            "the submit button should be usable again after a failed submission",
          );
        },
      );
    },
  },
];

export { contactFormScenarios };
