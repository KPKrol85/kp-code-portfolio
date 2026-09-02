import { CONTACT_FORM, SELECTORS } from "../core/config.js";
import { qs, qsa } from "../utils/dom.js";
import { safeGetItem, safeRemoveItem, safeSetItem } from "../utils/storage.js";

export const initContactForm = () => {
  const form = qs(SELECTORS.contactForm);
  if (!form) return;
  const IS_LOCAL = /localhost|127\.0\.0\.1/.test(location.hostname);
  const statusBox = form.querySelector(SELECTORS.contactStatus);
  const submitBtn = form.querySelector('button[type="submit"], .btn[type="submit"], .btn-primary[type="submit"]');
  const supportsNativeValidation = typeof form.reportValidity === "function";
  let useNativeFallback = false;
  const originalBtnText = submitBtn ? submitBtn.textContent : "Wyślij wiadomość";
  const msg = form.querySelector(SELECTORS.contactMessage);
  const counter = qs(SELECTORS.contactCounter);
  const a11ySummary = form.querySelector(SELECTORS.contactErrorSummary);
  const skipLink = form.querySelector(SELECTORS.contactSkipLink);
  if (skipLink) {
    skipLink.addEventListener("click", (ev) => {
      ev.preventDefault();
      const firstInvalid = form.querySelector(".is-invalid");
      if (firstInvalid) firstInvalid.focus();
    });
  }
  form.addEventListener("keydown", (ev) => {
    const k = ev.key || ev.code;
    if (ev.altKey && ev.shiftKey && (k === "E" || k === "KeyE")) {
      const firstInvalid = form.querySelector(".is-invalid");
      if (firstInvalid) {
        ev.preventDefault();
        firstInvalid.focus();
      }
    }
  });
  const setInvalid = (el) => {
    if (!el) return;
    el.classList.add("is-invalid");
    el.setAttribute("aria-invalid", "true");
  };
  const clearInvalid = (el) => {
    if (!el) return;
    el.classList.remove("is-invalid");
    el.removeAttribute("aria-invalid");
  };
  const showStatus = (message, ok = false) => {
    if (!statusBox) return;
    statusBox.classList.toggle("ok", !!ok);
    statusBox.classList.toggle("err", !ok);
    statusBox.textContent = message;
  };

  function updateCounter() {
    if (!msg || !counter) return;
    if (msg.value.length > CONTACT_FORM.maxMessageLength) msg.value = msg.value.slice(0, CONTACT_FORM.maxMessageLength);
    const len = msg.value.length;
    counter.textContent = `${len}/${CONTACT_FORM.maxMessageLength}`;
    counter.classList.toggle("warn", len >= CONTACT_FORM.maxMessageLength - 50 && len < CONTACT_FORM.maxMessageLength);
    counter.classList.toggle("limit", len >= CONTACT_FORM.maxMessageLength);
  }
  updateCounter();
  if (msg) {
    const savedMsg = safeGetItem(CONTACT_FORM.messageStorageKey);
    if (savedMsg) {
      msg.value = savedMsg;
      updateCounter();
    }
    msg.addEventListener("input", () => {
      safeSetItem(CONTACT_FORM.messageStorageKey, msg.value);
    });
  }

  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches("#name, #email, #subject, #service, #message, #phone, #consent")) clearInvalid(t);
    if (t === msg) updateCounter();
    if (!qsa(".is-invalid", form).length) {
      if (a11ySummary) a11ySummary.classList.add("visually-hidden");
      if (skipLink) skipLink.classList.add("visually-hidden");
    }
  });

  form.addEventListener("submit", async (e) => {
    if (useNativeFallback) {
      useNativeFallback = false;
      return;
    }

    if (form.getAttribute("aria-busy") === "true") {
      e.preventDefault();
      return;
    }
    showStatus("", false);
    let valid = true;
    CONTACT_FORM.requiredFields.forEach((id) => {
      const el = form.querySelector("#" + id);
      if (!el || !el.value || !el.value.trim()) {
        setInvalid(el);
        valid = false;
      }
    });
    const email = form.querySelector("#email");
    const emailVal = email ? email.value.trim() : "";
    if (email && emailVal && !/^\S+@\S+\.\S+$/.test(emailVal)) {
      setInvalid(email);
      valid = false;
      showStatus("Wpisz poprawny adres e-mail.", false);
    }
    const phone = form.querySelector("#phone");
    if (phone) {
      const phoneVal = phone.value.trim();
      if (phoneVal && !/^[0-9 +()-]{7,20}$/.test(phoneVal)) {
        setInvalid(phone);
        valid = false;
        showStatus("Wpisz poprawny numer telefonu (np. +48 600 000 000).", false);
      }
    }
    const consent = form.querySelector("#consent");
    if (consent && !consent.checked) {
      setInvalid(consent);
      valid = false;
      showStatus("Zaznacz zgodę na przetwarzanie danych.", false);
    }
    if (msg && msg.value.length > CONTACT_FORM.maxMessageLength) {
      setInvalid(msg);
      valid = false;
      showStatus(`Wiadomość może mieć maks. ${CONTACT_FORM.maxMessageLength} znaków.`, false);
    }
    if (!valid) {
      e.preventDefault();
      const invalids = qsa(".is-invalid", form);
      if (a11ySummary) {
        const labels = invalids.map((el) => {
          const lab = el.id ? form.querySelector(`label[for="${el.id}"]`) : null;
          return lab ? lab.textContent.trim() : el.name || el.id || "Pole";
        });
        const n = invalids.length;
        const suf = n === 1 ? "błąd" : n >= 2 && n <= 4 ? "błędy" : "błędów";
        a11ySummary.textContent = `Formularz zawiera ${n} ${suf}: ${labels.join(", ")}.`;
        a11ySummary.classList.remove("visually-hidden");
      }
      if (skipLink) skipLink.classList.remove("visually-hidden");
      const firstInvalid = invalids[0];
      if (firstInvalid) firstInvalid.focus();
      if (statusBox && !statusBox.textContent) showStatus("Uzupełnij wymagane pola.", false);
      return;
    }
    if (supportsNativeValidation && !form.reportValidity()) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    form.setAttribute("aria-busy", "true");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("sending");
      submitBtn.textContent = "Wysyłanie…";
    }
    showStatus("Wysyłanie…", true);
    const formData = new FormData(form);
    const body = new URLSearchParams(formData).toString();
    try {
      if (!IS_LOCAL) {
        const res = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        if (!res.ok) throw new Error("Netlify response not OK");
      } else {
        await new Promise((r) => setTimeout(r, 500));
      }
      form.setAttribute("aria-busy", "false");
      form.reset();
      safeRemoveItem(CONTACT_FORM.messageStorageKey);
      updateCounter();
      showStatus("Dziękujemy! Wiadomość została wysłana.", true);
      if (submitBtn) {
        submitBtn.classList.remove("sending");
        submitBtn.classList.add("sent");
        submitBtn.textContent = "Wysłano ✓";
        setTimeout(() => {
          submitBtn.disabled = false;
        }, 1200);
        setTimeout(() => {
          showStatus("", true);
          submitBtn.classList.remove("sent");
          submitBtn.textContent = originalBtnText;
        }, 6000);
      }
      if (a11ySummary) a11ySummary.classList.add("visually-hidden");
      if (skipLink) skipLink.classList.add("visually-hidden");
      if (!IS_LOCAL) {
        if (typeof gtag === "function") {
          gtag("event", "generate_lead", { event_category: "Formularz", event_label: "Kontakt — Budownictwo" });
        }
        if (typeof fbq === "function") {
          fbq("track", "Lead");
        }
      }
    } catch (err) {
      form.setAttribute("aria-busy", "false");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("sending");
        submitBtn.textContent = originalBtnText;
      }
      showStatus("Nie udało się wysłać przez ulepszony tryb. Wysyłamy formularz standardowo…", false);
      console.error(err);
      form.removeAttribute("aria-busy");
      useNativeFallback = true;
      form.requestSubmit();
    }
  });
};
