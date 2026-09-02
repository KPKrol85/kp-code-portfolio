export const SELECTORS = {
  hidden: ".u-hidden, .hidden",
  themeToggleDesktop: "#themeToggleDesktop",
  themeToggleMobile: "#themeToggleMobile",
  navToggle: "#nav-toggle",
  primaryNav: "#primaryNav",
  scrollTopButton: "#powrot-na-gore, .powrot-na-gore",
  contactForm: "#contactForm",
  contactMessage: "#message",
  contactCounter: "#messageCounter",
  contactStatus: "#formStatus",
  contactErrorSummary: "#errorSummary",
  contactSkipLink: "#skipToError",
  lightbox: "#lightbox",
  cookieBanner: "#cookieBanner",
};

export const INTERSECTION = {
  enterRatio: 0.12,
  rootMargin: "0px 0px 10% 0px",
  thresholds: [0, 0.12, 0.5, 1],
};

export const SCROLL_TOP = {
  threshold: 300,
};

export const HEADER_COMPACT = {
  threshold: 20,
};

export const CONTACT_FORM = {
  requiredFields: ["name", "email", "subject", "service", "message"],
  maxMessageLength: 500,
  messageStorageKey: "contactFormMessage",
};

export const COOKIE_BANNER = {
  storageKey: "cookie-consent-v1",
  cookieName: "cookie_consent",
  cookieMaxAge: 15768000,
};
