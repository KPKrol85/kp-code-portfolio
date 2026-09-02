"use strict";

function initContactForm() {
  if (initContactForm._abort) initContactForm._abort.abort();
  const ac = new AbortController();
  const { signal } = ac;
  initContactForm._abort = ac;
  const form = document.querySelector("section#kontakt .form");
  if (!form) return;
  const note = form.querySelector(".form-note");
  const btnSubmit = form.querySelector('button[type="submit"]');
  const hpInput = form.querySelector('input[name="bot-field"]');
  const nameInput = form.querySelector("#f-name");
  const phoneInput = form.querySelector("#f-phone");
  const msgInput = form.querySelector("#f-msg");
  const consentInput = form.querySelector("#f-consent");
  const isDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (note) {
    note.setAttribute("role", "status");
    note.setAttribute("aria-atomic", "true");
    note.setAttribute("aria-live", "polite");
    if (!note.hasAttribute("tabindex")) note.setAttribute("tabindex", "-1");
  }
  if (hpInput) {
    const wrap = hpInput.closest("label, div") || hpInput;
    Object.assign(wrap.style, {
      position: "absolute",
      left: "-9999px",
      width: "1px",
      height: "1px",
      overflow: "hidden",
    });
    wrap.setAttribute("aria-hidden", "true");
    hpInput.setAttribute("tabindex", "-1");
    hpInput.setAttribute("autocomplete", "off");
  }

  const startedAt = Date.now();
  const isTooFast = () => Date.now() - startedAt < 2000;
  const looksSpammy = (text) => {
    const t = String(text || "").toLowerCase();
    const links = (t.match(/https?:\/\//g) || []).length;
    return links >= 2 || /viagra|bitcoin|casino/.test(t);
  };

  const setBusy = (busy) => {
    form.setAttribute("aria-busy", busy ? "true" : "false");
    if (btnSubmit) btnSubmit.disabled = !!busy;
  };

  const showNote = (msg, ok = false) => {
    if (!note) return;
    note.textContent = msg || "";
    note.classList.toggle("is-ok", !!ok);
    note.classList.toggle("is-err", !ok && !!msg);
  };

  const encodeForm = (formEl) =>
    new URLSearchParams(new FormData(formEl)).toString();

  const errSpan = (el) => {
    const ids = (el.getAttribute("aria-describedby") || "").split(/\s+/);
    const id = ids.find((x) => x.endsWith("-error"));
    return id ? document.getElementById(id) : null;
  };

  const setFieldError = (el, msg) => {
    if (!el) return;
    el.setAttribute("aria-invalid", "true");
    el.setCustomValidity(msg || "");
    const span = errSpan(el);
    if (span) {
      span.textContent = msg || "";
      span.classList.toggle("visually-hidden", !msg);
    }
  };

  const clearFieldError = (el) => {
    if (!el) return;
    el.removeAttribute("aria-invalid");
    el.setCustomValidity("");
    const span = errSpan(el);
    if (span) {
      span.textContent = "";
      span.classList.add("visually-hidden");
    }
  };

  const formatPLPhone = (raw) => {
    raw = String(raw || "");
    const hasPlus48 = raw.trim().startsWith("+48");
    let digits = raw.replace(/\D/g, "");
    let prefix = "";
    if (hasPlus48) {
      if (digits.startsWith("48")) digits = digits.slice(2);
      prefix = "+48 ";
    }
    digits = digits.slice(0, 9);
    const g1 = digits.slice(0, 3);
    const g2 = digits.slice(3, 6);
    const g3 = digits.slice(6, 9);
    const grouped = [g1, g2, g3].filter(Boolean).join(" ");
    return (prefix + grouped).trim();
  };

  const isValidPLPhone = (val) => {
    const digits = String(val || "").replace(/\D/g, "");
    if (digits.length === 9) return true;
    if (digits.length === 11 && digits.startsWith("48")) return true;
    return false;
  };

  const applyPhoneMask = () => {
    if (!phoneInput) return;
    const active = document.activeElement === phoneInput;
    const before = phoneInput.value;
    const after = formatPLPhone(before);
    if (after !== before) {
      phoneInput.value = after;
      if (active && phoneInput.setSelectionRange) {
        phoneInput.setSelectionRange(after.length, after.length);
      }
    }
  };
  form.addEventListener(
    "input",
    (e) => {
      const t = e.target;
      if (note?.textContent) showNote("", true);
      if (t.matches("input, textarea")) clearFieldError(t);

      if (t === phoneInput) {
        applyPhoneMask();
        const raw = phoneInput.value.trim();
        if (raw === "" || isValidPLPhone(raw)) clearFieldError(phoneInput);
      }
    },
    { signal },
  );
  phoneInput?.addEventListener(
    "paste",
    () => requestAnimationFrame(applyPhoneMask),
    { signal },
  );
  phoneInput?.addEventListener("blur", applyPhoneMask, { signal });
  form.addEventListener(
    "blur",
    (e) => {
      const t = e.target;
      if (t.matches('input[type="text"], textarea')) t.value = t.value.trim();
    },
    { capture: true, signal },
  );
  form.addEventListener(
    "reset",
    () => {
      showNote("", true);
      form
        .querySelectorAll('[aria-invalid="true"]')
        .forEach((el) => clearFieldError(el));
    },
    { signal },
  );

  let submitting = false;
  form.addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      if (submitting) return;

      if (
        (hpInput && hpInput.value.trim() !== "") ||
        looksSpammy(msgInput?.value)
      ) {
        form.reset();
        return;
      }
      if (isTooFast()) {
        showNote("Odczekaj chwilę i spróbuj ponownie.", false);
        return;
      }
      if (!form.checkValidity()) {
        if (nameInput && nameInput.validity.valueMissing) {
          setFieldError(nameInput, "Podaj imię i nazwisko (min. 2 znaki).");
        } else if (nameInput && nameInput.validity.tooShort) {
          setFieldError(
            nameInput,
            "Imię i nazwisko powinno mieć co najmniej 2 znaki.",
          );
        }
        if (phoneInput && phoneInput.validity.valueMissing) {
          setFieldError(phoneInput, "Podaj numer telefonu.");
        }
        if (msgInput && msgInput.validity.valueMissing) {
          setFieldError(msgInput, "Napisz krótki opis prac.");
        } else if (msgInput && msgInput.validity.tooLong) {
          setFieldError(msgInput, "Opis może mieć maksymalnie 1000 znaków.");
        }
        if (consentInput && !consentInput.checked) {
          setFieldError(
            consentInput,
            "Wymagana zgoda na kontakt w celu wyceny.",
          );
        }
        form
          .querySelector(':invalid, [aria-invalid="true"]')
          ?.focus({ preventScroll: true });
        showNote("Uzupełnij poprawnie wszystkie pola i zaznacz zgodę.", false);
        return;
      }

      if (phoneInput) {
        applyPhoneMask();
        const raw = phoneInput.value.trim();
        if (!isValidPLPhone(raw)) {
          setFieldError(
            phoneInput,
            "Podaj poprawny numer (np. 533 537 091 lub +48 533 537 091).",
          );
          phoneInput.focus({ preventScroll: true });
          showNote("Sprawdź format numeru telefonu.", false);
          return;
        }
        clearFieldError(phoneInput);
      }

      submitting = true;
      setBusy(true);
      showNote("Wysyłanie…", true);

      const submitUrl = form.getAttribute("action") || "/";
      const timeoutMs = 10000;
      const fetchController = new AbortController();
      const timeoutId = window.setTimeout(
        () => fetchController.abort(),
        timeoutMs,
      );

      try {
        const response = await fetch(submitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: encodeForm(form),
          signal: fetchController.signal,
        });

        if (!response.ok) {
          throw new Error(`Form submit failed: ${response.status}`);
        }

        form
          .querySelectorAll('[aria-invalid="true"]')
          .forEach((el) => el.removeAttribute("aria-invalid"));
        form.reset();
        showNote("Dziękujemy! Skontaktujemy się wkrótce.", true);
        note?.focus?.();
      } catch (err) {
        if (isDev) console.error(err);
        const message = fetchController.signal.aborted
          ? "Przekroczono limit czasu. Spróbuj ponownie."
          : "Nie udało się wysłać formularza. Spróbuj ponownie.";
        showNote(message, false);
      } finally {
        window.clearTimeout(timeoutId);
        setBusy(false);
        submitting = false;
      }
    },
    { signal },
  );
}

export { initContactForm };
