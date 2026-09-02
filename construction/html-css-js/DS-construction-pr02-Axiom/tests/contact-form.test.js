// PH4-02 — focused coverage for js/components/forms.js.
//
// The suite drives the real module through a minimal but realistic copy of the
// contact-form markup from index.html and only asserts observable behavior:
// attributes, classes, focus, counter text, status text and localStorage.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initContactForm } from "../js/components/forms.js";
import { CONTACT_FORM } from "../js/core/config.js";

const FORM_FIXTURE = `
  <form id="contactForm" name="contact" method="POST" action="/success.html" class="contact-form" aria-describedby="formNote formStatus">
    <div id="errorSummary" class="visually-hidden" role="status" aria-live="assertive" aria-atomic="true"></div>
    <a id="skipToError" class="visually-hidden-focusable" href="#errorSummary">Przejdź do pierwszego błędu</a>
    <input type="hidden" name="form-name" value="contact" />
    <div class="form__group">
      <label for="name">Imię i nazwisko</label>
      <input type="text" id="name" name="name" required autocomplete="name" />
    </div>
    <div class="form__group">
      <label for="email">Adres e-mail</label>
      <input type="email" id="email" name="email" required autocomplete="email" />
    </div>
    <div class="form__group">
      <label for="phone">Telefon (opcjonalnie)</label>
      <input type="tel" id="phone" name="phone" pattern="^[0-9 +()-]{7,20}$" />
    </div>
    <div class="form__group">
      <label for="subject">Temat</label>
      <input type="text" id="subject" name="subject" required />
    </div>
    <div class="form__group">
      <label for="service">Rodzaj usługi</label>
      <select id="service" name="service" required>
        <option value="">-- Wybierz usługę --</option>
        <option value="remont">Remont mieszkania</option>
      </select>
    </div>
    <div class="form__group">
      <label for="message">Wiadomość</label>
      <textarea id="message" name="message" rows="5" required maxlength="500" aria-describedby="messageCounter"></textarea>
      <div id="messageCounter" class="form__char-counter" aria-live="polite">0/500</div>
    </div>
    <div class="form__group form__consent">
      <label class="form__consent-label" for="consent">
        <input type="checkbox" id="consent" name="consent" required />
        <span>Wyrażam zgodę na przetwarzanie moich danych osobowych.</span>
      </label>
    </div>
    <p id="formNote" class="form__note">Pola powyżej są wymagane.</p>
    <div id="formStatus" class="form__status" role="status" aria-live="polite"></div>
    <button type="submit" class="btn btn-primary">Wyślij wiadomość</button>
  </form>
`;

let fetchMock;

const mountForm = () => {
  document.body.innerHTML = FORM_FIXTURE;
  initContactForm();
  return document.querySelector("#contactForm");
};

const fillValidForm = (form) => {
  form.querySelector("#name").value = "Jan Kowalski";
  form.querySelector("#email").value = "jan@example.com";
  form.querySelector("#subject").value = "Wycena remontu";
  form.querySelector("#service").value = "remont";
  form.querySelector("#message").value = "Proszę o wycenę remontu mieszkania.";
  form.querySelector("#consent").checked = true;
};

const typeInto = (field, value) => {
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
};

const submitForm = (form) => {
  const event = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  // A real request would be a test defect, so fetch is replaced by a stub that
  // fails loudly and can be asserted on.
  fetchMock = vi.fn(() => Promise.reject(new Error("Network access is not allowed in tests")));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("contact form validation", () => {
  it("blocks submission and marks every empty required field as invalid", () => {
    const form = mountForm();

    const event = submitForm(form);

    expect(event.defaultPrevented).toBe(true);
    CONTACT_FORM.requiredFields.forEach((id) => {
      const field = form.querySelector(`#${id}`);
      expect(field.classList.contains("is-invalid")).toBe(true);
      expect(field.getAttribute("aria-invalid")).toBe("true");
    });
    const consent = form.querySelector("#consent");
    expect(consent.classList.contains("is-invalid")).toBe(true);
    expect(consent.getAttribute("aria-invalid")).toBe("true");
  });

  it("moves focus to the first invalid field", () => {
    const form = mountForm();

    submitForm(form);

    expect(document.activeElement).toBe(form.querySelector("#name"));
  });

  it("rejects a malformed e-mail address and reports it in the status region", () => {
    const form = mountForm();
    fillValidForm(form);
    form.querySelector("#email").value = "jan(at)example.com";

    const event = submitForm(form);

    expect(event.defaultPrevented).toBe(true);
    expect(form.querySelector("#email").classList.contains("is-invalid")).toBe(true);
    const status = form.querySelector("#formStatus");
    expect(status.classList.contains("err")).toBe(true);
    expect(status.textContent.trim().length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the invalid state once the field is corrected", () => {
    const form = mountForm();
    submitForm(form);
    const name = form.querySelector("#name");
    expect(name.classList.contains("is-invalid")).toBe(true);

    typeInto(name, "Jan Kowalski");

    expect(name.classList.contains("is-invalid")).toBe(false);
    expect(name.hasAttribute("aria-invalid")).toBe(false);
  });
});

describe("contact form error summary", () => {
  it("reveals the accessible summary and names every invalid field", () => {
    const form = mountForm();
    const summary = form.querySelector("#errorSummary");
    const skipLink = form.querySelector("#skipToError");
    expect(summary.classList.contains("visually-hidden")).toBe(true);

    submitForm(form);

    expect(summary.classList.contains("visually-hidden")).toBe(false);
    expect(skipLink.classList.contains("visually-hidden")).toBe(false);
    const invalidFields = Array.from(form.querySelectorAll(".is-invalid"));
    expect(summary.textContent).toContain(String(invalidFields.length));
    invalidFields.forEach((field) => {
      const label = form.querySelector(`label[for="${field.id}"]`);
      expect(summary.textContent).toContain(label.textContent.trim());
    });
  });

  it("hides the summary again once no field is invalid", () => {
    const form = mountForm();
    submitForm(form);
    const summary = form.querySelector("#errorSummary");
    const skipLink = form.querySelector("#skipToError");
    expect(summary.classList.contains("visually-hidden")).toBe(false);

    fillValidForm(form);
    Array.from(form.querySelectorAll(".is-invalid")).forEach((field) => {
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(summary.classList.contains("visually-hidden")).toBe(true);
    expect(skipLink.classList.contains("visually-hidden")).toBe(true);
  });
});

describe("contact form message limit", () => {
  it("constrains the message to the configured maximum length", () => {
    const form = mountForm();
    const message = form.querySelector("#message");
    const counter = form.querySelector("#messageCounter");

    typeInto(message, "x".repeat(CONTACT_FORM.maxMessageLength + 120));

    expect(message.value).toHaveLength(CONTACT_FORM.maxMessageLength);
    expect(counter.textContent).toBe(`${CONTACT_FORM.maxMessageLength}/${CONTACT_FORM.maxMessageLength}`);
    expect(counter.classList.contains("limit")).toBe(true);
  });

  it("keeps a shorter message untouched and counts it", () => {
    const form = mountForm();
    const message = form.querySelector("#message");
    const counter = form.querySelector("#messageCounter");

    typeInto(message, "Dzień dobry");

    expect(message.value).toBe("Dzień dobry");
    expect(counter.textContent).toBe(`11/${CONTACT_FORM.maxMessageLength}`);
    expect(counter.classList.contains("limit")).toBe(false);
  });
});

describe("contact form draft persistence", () => {
  it("stores the typed message under the configured storage key", () => {
    const form = mountForm();

    typeInto(form.querySelector("#message"), "Szkic wiadomości");

    expect(localStorage.getItem(CONTACT_FORM.messageStorageKey)).toBe("Szkic wiadomości");
  });

  it("restores a saved draft when the form is initialised", () => {
    localStorage.setItem(CONTACT_FORM.messageStorageKey, "Wcześniejszy szkic");

    const form = mountForm();

    expect(form.querySelector("#message").value).toBe("Wcześniejszy szkic");
    expect(form.querySelector("#messageCounter").textContent).toBe(`18/${CONTACT_FORM.maxMessageLength}`);
  });

  it("removes the draft after a successful local submission", async () => {
    vi.useFakeTimers();
    localStorage.setItem(CONTACT_FORM.messageStorageKey, "Wcześniejszy szkic");
    const form = mountForm();
    fillValidForm(form);
    const status = form.querySelector("#formStatus");
    const submitBtn = form.querySelector('button[type="submit"]');

    const event = submitForm(form);
    expect(event.defaultPrevented).toBe(true);
    expect(form.getAttribute("aria-busy")).toBe("true");

    await vi.advanceTimersByTimeAsync(500);

    expect(localStorage.getItem(CONTACT_FORM.messageStorageKey)).toBeNull();
    expect(form.getAttribute("aria-busy")).toBe("false");
    expect(form.querySelector("#message").value).toBe("");
    expect(form.querySelector("#messageCounter").textContent).toBe(`0/${CONTACT_FORM.maxMessageLength}`);
    expect(status.classList.contains("ok")).toBe(true);
    expect(status.textContent.trim().length).toBeGreaterThan(0);
    expect(submitBtn.classList.contains("sent")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
