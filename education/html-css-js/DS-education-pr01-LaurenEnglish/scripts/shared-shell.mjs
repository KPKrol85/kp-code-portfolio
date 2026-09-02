import {
  INDEXABLE_PAGES,
  PROJECT_DISCLOSURE,
  SHARED_SHELL_PAGES,
  SITE,
} from "./site-config.mjs";

export const PRIMARY_PAGES = INDEXABLE_PAGES;

export const SHELL_MARKERS = Object.freeze({
  headerStart: "    <!-- shared-shell:header:start -->",
  headerEnd: "    <!-- shared-shell:header:end -->",
  footerStart: "    <!-- shared-shell:footer:start -->",
  footerEnd: "    <!-- shared-shell:footer:end -->",
});

const NAV_ITEMS = Object.freeze([
  { key: "services", label: "Usługi", href: "/uslugi.html" },
  { key: "packages", label: "Pakiety", href: "/pakiety.html" },
  { key: "materials", label: "Materiały", href: "/materialy.html" },
  { key: "progress", label: "Postępy", href: "/postepy.html" },
  { label: "Metodyka", href: "/index.html#how" },
  { label: "O mnie", href: "/index.html#about" },
  { label: "FAQ", href: "/index.html#faq" },
  { key: "contact", label: "Kontakt", href: "/kontakt.html" },
]);

const FOOTER_OFFER_LINKS = Object.freeze([
  { label: "Usługi", href: "/uslugi.html" },
  { label: "Pakiety", href: "/pakiety.html" },
  { label: "Materiały", href: "/materialy.html" },
  { label: "Postępy", href: "/postepy.html" },
  { label: "FAQ", href: "/index.html#faq" },
]);

export const FOOTER_CONTACT = Object.freeze({
  phone: "+48 533 537 091",
  telephoneUri: "tel:+48533537091",
  email: "kontakt@kp-code.pl",
  emailUri: "mailto:kontakt@kp-code.pl",
  address: "ul. Marynarki Wojennej 12/31, 33-100 Tarnów, Polska",
});

export const FOOTER_CONTACT_ICONS = Object.freeze({
  phone: Object.freeze({
    viewBox: "0 0 640 640",
    pathData:
      "M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z",
  }),
  email: Object.freeze({
    viewBox: "0 0 640 640",
    pathData:
      "M112 128C85.5 128 64 149.5 64 176C64 191.1 71.1 205.3 83.2 214.4L291.2 370.4C308.3 383.2 331.7 383.2 348.8 370.4L556.8 214.4C568.9 205.3 576 191.1 576 176C576 149.5 554.5 128 528 128L112 128zM64 260L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 260L377.6 408.8C343.5 434.4 296.5 434.4 262.4 408.8L64 260z",
  }),
});

export const FOOTER_LEGAL_LINKS = Object.freeze([
  { label: "Polityka prywatności", href: "/polityka-prywatnosci.html" },
  { label: "Regulamin", href: "/regulamin.html" },
  { label: "Polityka cookies", href: "/cookies.html" },
]);

const FOOTER_INFORMATION_LINKS = Object.freeze([
  { label: "O mnie", href: "/index.html#about" },
  { label: "Kontakt", href: "/kontakt.html" },
  ...FOOTER_LEGAL_LINKS,
]);

export const FOOTER_SOCIAL_LINKS = Object.freeze([
  {
    label: "GitHub",
    href: "https://github.com/KPKrol85",
    viewBox: "0 0 448 512",
    pathData:
      "M384 32c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96C0 60.7 28.7 32 64 32l320 0zM223.7 96c-88.4 0-159.7 72.2-159.7 160.6 0 69.4 44.1 126.9 103.4 148.4 8.4 3.1 16.6-2.5 16.6-10.9l0-25c-4.4 1.9-10 3.1-15 3.1-20.6 0-32.8-11.2-41.6-32.2-3.4-8.4-7.2-13.4-14.4-14.4-3.7-.3-5-1.9-5-3.8 0-3.7 6.2-6.6 12.5-6.6 9.1 0 16.9 5.6 25 17.2 6.2 9.1 12.8 13.1 20.6 13.1s12.8-2.8 20-10c5.3-5.3 9.4-10 13.1-13.1-41.3-5-70.3-34.7-70.3-73.1 0-15.6 5.6-32.5 15-43.8-4.1-10.3-3.4-32.2 1.2-41.2 12.5-1.6 29.4 5 39.4 14.1 11.9-3.7 24.4-5.6 39.7-5.6s27.8 1.9 39.1 5.3c9.7-8.8 26.9-15.3 39.4-13.8 4.4 8.4 5 30.3 .9 40.9 10 11.9 15.3 27.8 15.3 44.1 0 38.4-29.1 67.5-70.9 72.8 10.6 6.9 17.8 21.9 17.8 39.1l0 32.5c0 9.4 7.8 14.7 17.2 10.9 56.6-21.6 100.9-78.1 100.9-148.1 0-88.4-71.9-160.6-160.3-160.6z",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/kpkrol85",
    viewBox: "0 0 448 512",
    pathData:
      "M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l98.2 0 0-145.8-52.8 0 0-78.2 52.8 0 0-33.7c0-87.1 39.4-127.5 125-127.5 16.2 0 44.2 3.2 55.7 6.4l0 70.8c-6-.6-16.5-1-29.6-1-42 0-58.2 15.9-58.2 57.2l0 27.8 83.6 0-14.4 78.2-69.3 0 0 145.8 129 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32z",
  },
  {
    label: "X",
    href: "https://x.com/KP_Code_85",
    viewBox: "0 0 448 512",
    pathData:
      "M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32zm297.1 84l-103.8 118.6 122.1 161.4-95.6 0-74.8-97.9-85.7 97.9-47.5 0 111-126.9-117.1-153.1 98 0 67.7 89.5 78.2-89.5 47.5 0zM323.3 367.6l-169.9-224.7-28.3 0 171.8 224.7 26.4 0z",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/kp-code/",
    viewBox: "0 0 448 512",
    pathData:
      "M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32zm5 170.2l66.5 0 0 213.8-66.5 0 0-213.8zm71.7-67.7a38.5 38.5 0 1 1 -77 0 38.5 38.5 0 1 1 77 0zM317.9 416l0-104c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9l0 105.8-66.4 0 0-213.8 63.7 0 0 29.2 .9 0c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9l0 117.2-66.4 0z",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/kp_code_/",
    viewBox: "0 0 448 512",
    pathData:
      "M194.4 211.7a53.3 53.3 0 1 0 59.2 88.6 53.3 53.3 0 1 0 -59.2-88.6zm142.3-68.4c-5.2-5.2-11.5-9.3-18.4-12-18.1-7.1-57.6-6.8-83.1-6.5-4.1 0-7.9 .1-11.2 .1s-7.2 0-11.4-.1c-25.5-.3-64.8-.7-82.9 6.5-6.9 2.7-13.1 6.8-18.4 12s-9.3 11.5-12 18.4c-7.1 18.1-6.7 57.7-6.5 83.2 0 4.1 .1 7.9 .1 11.1s0 7-.1 11.1c-.2 25.5-.6 65.1 6.5 83.2 2.7 6.9 6.8 13.1 12 18.4s11.5 9.3 18.4 12c18.1 7.1 57.6 6.8 83.1 6.5 4.1 0 7.9-.1 11.2-.1s7.2 0 11.4 .1c25.5 .3 64.8 .7 82.9-6.5 6.9-2.7 13.1-6.8 18.4-12s9.3-11.5 12-18.4c7.2-18 6.8-57.4 6.5-83 0-4.2-.1-8.1-.1-11.4s0-7.1 .1-11.4c.3-25.5 .7-64.9-6.5-83-2.7-6.9-6.8-13.1-12-18.4l0 .2zm-67.1 44.5c18.1 12.1 30.6 30.9 34.9 52.2s-.2 43.5-12.3 61.6c-6 9-13.7 16.6-22.6 22.6s-19 10.1-29.6 12.2c-21.3 4.2-43.5-.2-61.6-12.3s-30.6-30.9-34.9-52.2 .2-43.5 12.2-61.6 30.9-30.6 52.2-34.9 43.5 .2 61.6 12.2l.1 0zm29.2-1.3c-3.1-2.1-5.6-5.1-7.1-8.6s-1.8-7.3-1.1-11.1 2.6-7.1 5.2-9.8 6.1-4.5 9.8-5.2 7.6-.4 11.1 1.1 6.5 3.9 8.6 7 3.2 6.8 3.2 10.6c0 2.5-.5 5-1.4 7.3s-2.4 4.4-4.1 6.2-3.9 3.2-6.2 4.2-4.8 1.5-7.3 1.5c-3.8 0-7.5-1.1-10.6-3.2l-.1 0zM448 96c0-35.3-28.7-64-64-64L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320zM357 389c-18.7 18.7-41.4 24.6-67 25.9-26.4 1.5-105.6 1.5-132 0-25.6-1.3-48.3-7.2-67-25.9s-24.6-41.4-25.8-67c-1.5-26.4-1.5-105.6 0-132 1.3-25.6 7.1-48.3 25.8-67s41.5-24.6 67-25.8c26.4-1.5 105.6-1.5 132 0 25.6 1.3 48.3 7.1 67 25.8s24.6 41.4 25.8 67c1.5 26.3 1.5 105.4 0 131.9-1.3 25.6-7.1 48.3-25.8 67l0 .1z",
  },
]);

const FOOTER_ICON_ATTRIBUTION =
  "<!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.-->";

export const FOOTER_COPYRIGHT =
  "© 2026 KP_Code Digital Studio | Wszelkie prawa zastrzeżone.";

export const FOOTER_BRAND_DESCRIPTION =
  "Indywidualna nauka angielskiego dopasowana do Twoich celów, poziomu i tempa. Spokojnie, konkretnie i bez chaosu.";

const getPage = (pageKey) => {
  const page = SHARED_SHELL_PAGES.find(({ key }) => key === pageKey);
  if (!page) {
    throw new Error(`Unknown shared-shell page key: ${pageKey}`);
  }
  return page;
};

const renderNavItems = (pageKey) =>
  NAV_ITEMS.map(({ key, label, href }) => {
    const current = key === pageKey ? ' aria-current="page"' : "";
    return `              <li class="nav__item">
                <a class="nav__link" href="${href}"${current}>${label}</a>
              </li>`;
  }).join("\n");

const renderFooterLinks = (links) =>
  links
    .map(({ label, href }) => {
      return `            <li><a href="${href}">${label}</a></li>`;
    })
    .join("\n");

const renderSocialLinks = () =>
  FOOTER_SOCIAL_LINKS.map(
    ({ label, href, viewBox, pathData }) => `          <li>
            <a class="footer__social-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label} — KP_Code Digital Studio">
              <svg class="footer__social-icon" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false" fill="currentColor">
                ${FOOTER_ICON_ATTRIBUTION}
                <path d="${pathData}" />
              </svg>
            </a>
          </li>`,
  ).join("\n");

const renderFooterContactIcon = ({
  viewBox,
  pathData,
}) => `<svg class="footer__contact-icon" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false" fill="currentColor">
                ${FOOTER_ICON_ATTRIBUTION}
                <path d="${pathData}" />
              </svg>`;

export const PROJECT_DISCLOSURE_COPY = Object.freeze({
  eyebrow: "Lauren English",
  title: "Informacja o projekcie",
  description:
    "Serwis „Lauren English” ma charakter demonstracyjny i został przygotowany przez KP_Code Digital Studio jako propozycja profesjonalnej strony internetowej dla nauczyciela języka angielskiego.",
  dismissLabel: "Przejdź do strony",
  links: Object.freeze([
    { label: "Polityka prywatności", href: "/polityka-prywatnosci.html" },
    { label: "Regulamin", href: "/regulamin.html" },
    { label: "Kontakt", href: "/kontakt.html" },
  ]),
});

export const PROJECT_DISCLOSURE_MARKERS = Object.freeze({
  start: "    <!-- project-disclosure:start -->",
  end: "    <!-- project-disclosure:end -->",
});

const renderProjectDisclosureLinks = () =>
  PROJECT_DISCLOSURE_COPY.links
    .map(
      ({ label, href }) =>
        `            <li><a class="project-disclosure__link" href="${href}">${label}</a></li>`,
    )
    .join("\n");

const renderProjectDisclosure = () => `
${PROJECT_DISCLOSURE_MARKERS.start}
    <dialog
      class="project-disclosure"
      data-project-disclosure
      data-project-disclosure-enabled="${PROJECT_DISCLOSURE.enabled}"
      data-project-disclosure-version="${PROJECT_DISCLOSURE.version}"
      data-project-disclosure-storage-key="${PROJECT_DISCLOSURE.storageKey}"
      data-project-disclosure-routes="${PROJECT_DISCLOSURE.eligiblePaths.join(" ")}"
      aria-labelledby="project-disclosure-title"
      aria-describedby="project-disclosure-description"
    >
      <div class="project-disclosure__content">
        <div class="project-disclosure__intro">
          <p class="eyebrow project-disclosure__eyebrow">${PROJECT_DISCLOSURE_COPY.eyebrow}</p>
          <h2 class="project-disclosure__title" id="project-disclosure-title">${PROJECT_DISCLOSURE_COPY.title}</h2>
        </div>
        <p class="project-disclosure__copy" id="project-disclosure-description">${PROJECT_DISCLOSURE_COPY.description}</p>
        <nav class="project-disclosure__links" aria-label="Informacje o serwisie">
          <ul class="project-disclosure__link-list" role="list">
${renderProjectDisclosureLinks()}
          </ul>
        </nav>
        <div class="project-disclosure__actions">
          <button class="button button--primary" type="button" data-project-disclosure-dismiss>${PROJECT_DISCLOSURE_COPY.dismissLabel}</button>
        </div>
      </div>
    </dialog>
${PROJECT_DISCLOSURE_MARKERS.end}`;

export const renderSharedHeader = (pageKey) => {
  getPage(pageKey);
  const logoCurrent = pageKey === "home" ? ' aria-current="page"' : "";
  const preservedHomeAnnotation =
    pageKey === "home" ? "\n\n    <!-- Header -->" : "";
  const navToggleStart =
    pageKey === "home"
      ? '          <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-drawer" hidden>'
      : `          <button
            class="nav__toggle"
            type="button"
            aria-expanded="false"
            aria-controls="nav-drawer"
            hidden
          >`;

  return `${SHELL_MARKERS.headerStart}
    <a class="skip-link" href="#main">Przejdź do treści</a>${preservedHomeAnnotation}
    <header class="header" id="top">
      <div class="container header__inner">
        <a class="header__logo" href="/index.html" aria-label="${SITE.name}"${logoCurrent}>
          <img class="header__logo-image" src="${SITE.brandLogo.path}" alt="" width="${SITE.brandLogo.width}" height="${SITE.brandLogo.height}" />
          <span class="header__logo-text">${SITE.name}</span>
        </a>
        <nav class="nav" aria-label="Główna nawigacja">
${navToggleStart}
            <span class="nav__toggle-line"></span>
            <span class="nav__toggle-line"></span>
            <span class="nav__toggle-line"></span>
            <span class="sr-only" data-nav-toggle-label>Otwórz menu</span>
          </button>
          <div class="nav__drawer" id="nav-drawer" data-drawer>
            <div class="nav__drawer-header">
              <span class="nav__drawer-title">Menu</span>
            </div>
            <ul class="nav__list" role="list">
${renderNavItems(pageKey)}
            </ul>
            <button class="button button--ghost theme-toggle nav__theme" type="button" aria-label="Włącz tryb ciemny" aria-pressed="false" data-theme-toggle hidden>
              <span class="theme-toggle__icons" aria-hidden="true">
                <img class="theme-toggle__icon theme-toggle__icon--sun" src="/assets/icons/sun.svg" alt="" width="24" height="24" />
                <img class="theme-toggle__icon theme-toggle__icon--moon" src="/assets/icons/moon.svg" alt="" width="24" height="24" />
              </span>
            </button>
            <a class="button button--primary nav__cta" href="/kontakt.html#formularz">Napisz do mnie</a>
          </div>
        </nav>
        <div class="header__actions">
        <a class="button button--primary header__cta" href="/kontakt.html#formularz">Napisz do mnie</a>
          <button class="button button--ghost theme-toggle" type="button" aria-label="Włącz tryb ciemny" aria-pressed="false" data-theme-toggle hidden>
            <span class="theme-toggle__icons" aria-hidden="true">
              <img class="theme-toggle__icon theme-toggle__icon--sun" src="/assets/icons/sun.svg" alt="" width="24" height="24" />
              <img class="theme-toggle__icon theme-toggle__icon--moon" src="/assets/icons/moon.svg" alt="" width="24" height="24" />
            </span>
          </button>
        </div>
      </div>
    </header>
${SHELL_MARKERS.headerEnd}`;
};

export const renderSharedFooter = () => `${SHELL_MARKERS.footerStart}
    <footer class="footer">
      <div class="container footer__grid">
        <section class="footer__column footer__column--brand" aria-labelledby="footer-brand-title">
          <h2 class="sr-only" id="footer-brand-title">Marka</h2>
          <div class="footer__brand-block">
            <a class="footer__brand" href="/index.html">
              <img class="footer__logo-image" src="${SITE.brandLogo.path}" alt="" width="${SITE.brandLogo.width}" height="${SITE.brandLogo.height}" />
              <span class="footer__brand-text">${SITE.name}</span>
            </a>
            <p class="footer__text">${FOOTER_BRAND_DESCRIPTION}</p>
          </div>
        </section>
        <section class="footer__column" aria-labelledby="footer-offer-title">
          <h2 class="footer__title" id="footer-offer-title">Oferta</h2>
          <ul class="footer__list" role="list">
${renderFooterLinks(FOOTER_OFFER_LINKS)}
          </ul>
        </section>
        <section class="footer__column" aria-labelledby="footer-information-title">
          <h2 class="footer__title" id="footer-information-title">Informacje</h2>
          <ul class="footer__list" role="list">
${renderFooterLinks(FOOTER_INFORMATION_LINKS)}
          </ul>
        </section>
        <section class="footer__column" aria-labelledby="footer-contact-title">
          <h2 class="footer__title" id="footer-contact-title">Kontakt</h2>
          <ul class="footer__list footer__list--contact" role="list">
            <li>
              <a class="footer__contact-link" href="${FOOTER_CONTACT.telephoneUri}">
                ${renderFooterContactIcon(FOOTER_CONTACT_ICONS.phone)}
                <span class="footer__contact-text">${FOOTER_CONTACT.phone}</span>
              </a>
            </li>
            <li>
              <a class="footer__contact-link" href="${FOOTER_CONTACT.emailUri}">
                ${renderFooterContactIcon(FOOTER_CONTACT_ICONS.email)}
                <span class="footer__contact-text">${FOOTER_CONTACT.email}</span>
              </a>
            </li>
            <li><address class="footer__address">${FOOTER_CONTACT.address}</address></li>
          </ul>
        </section>
      </div>
      <section class="container footer__social" aria-labelledby="footer-social-title">
        <h2 class="footer__social-title" id="footer-social-title">SOCIAL MEDIA</h2>
        <ul class="footer__social-list" role="list">
${renderSocialLinks()}
        </ul>
      </section>
      <div class="footer__bottom">
        <div class="container">
          <p>${FOOTER_COPYRIGHT}</p>
        </div>
      </div>
    </footer>
${renderProjectDisclosure()}
${SHELL_MARKERS.footerEnd}`;
