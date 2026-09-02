import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_PAGES, SHARED_SHELL_PAGES } from "./site-config.mjs";
import { FOOTER_CONTACT, FOOTER_COPYRIGHT, FOOTER_LEGAL_LINKS, FOOTER_SOCIAL_LINKS } from "./shared-shell.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_PAGES = Object.freeze(ALL_PAGES.map(({ file }) => file));
const APPROVED_CONTACT = FOOTER_CONTACT;

// The project disclosure is the one region allowed to state the build's provenance.
const PROJECT_DISCLOSURE_REGION = /<!-- project-disclosure:start -->[\s\S]*?<!-- project-disclosure:end -->/giu;

const FORBIDDEN_PUBLIC_PATTERNS = Object.freeze([
  {
    label: "developer, portfolio, or conceptual-project terminology",
    pattern: /\b(?:demo|mockup|fake|prototype|prototyp|portfolio|simulation|demonstracyj\w*)\b|sample project|test website|portfolio simulation|projekt koncepcyjny|aktywną ofertą handlową/iu,
    outsideProjectDisclosure: true,
  },
  {
    label: "unsupported testimonial markup",
    pattern: /testimonials?|card--testimonial|#testimonials/iu,
  },
  {
    label: "unsupported rating markup",
    pattern: /class="rating"|aria-label="5 na 5"|★★★★★/u,
  },
  {
    label: "unsupported email address",
    pattern: /lauren@laurenenglish\.pl/iu,
  },
  {
    label: "unsupported phone or WhatsApp",
    pattern: /\+48\s*600\s*000\s*123|wa\.me|whatsapp/iu,
  },
  {
    label: "unsupported opening hours",
    pattern: /openingHours|pn[–-]pt\s*9:00[–-]18:00|<strong>Godziny:/iu,
  },
  {
    label: "unsupported response or availability promise",
    pattern: /24h|24 godzin|wolne sloty|wt\/śr po 17:00/iu,
  },
  {
    label: "generic social profile",
    pattern: /href="https:\/\/(?:www\.)?(?:linkedin|instagram|youtube)\.com\/?"/iu,
  },
  {
    label: "unsupported credentials",
    pattern: /Certyfikat TESOL|Trener egzaminacyjny/iu,
  },
  { label: "unsupported popularity claim", pattern: /Najczęściej wybier/iu },
  { label: "developer catalogue terminology", pattern: /sklepik|gating/iu },
  {
    label: "unsupported structured-data field",
    pattern: /"(?:address|telephone|email|openingHours|priceRange|sameAs|aggregateRating|review|offers|founder|employee)"\s*:/iu,
  },
  {
    label: "unsupported contact action",
    pattern: /Umów lekcję|Umów konsultację|Wyślij zgłoszenie|Zapytaj o wolne terminy|Zapytaj o (?:Start|Regular|Intensive)/iu,
  },
]);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pages = new Map();
for (const file of PUBLIC_PAGES) {
  const html = await readFile(resolve(ROOT, file), "utf8");
  pages.set(file, html);

  const productHtml = html.replace(PROJECT_DISCLOSURE_REGION, "");
  for (const { label, pattern, outsideProjectDisclosure } of FORBIDDEN_PUBLIC_PATTERNS) {
    assert(!pattern.test(outsideProjectDisclosure ? productHtml : html), `${file}: ${label}`);
  }
}

const home = pages.get("index.html");
const contact = pages.get("kontakt.html");
const contactSection = home.match(/<section\b[^>]*\bid="contact"[\s\S]*?<\/section>/u)?.[0];

assert(contactSection, "index.html: missing contact section");

assert(
  !contactSection.includes("data-contact-status") &&
    /<a\b[^>]*href="\/kontakt\.html"[^>]*>\s*Napisz do mnie\s*<\/a\s*>/iu.test(contactSection) &&
    new RegExp(`<a\\b[^>]*href="${escapeRegExp(APPROVED_CONTACT.telephoneUri)}"[^>]*>\\s*Zadzwoń\\s*<\\/a\\s*>`, "iu").test(contactSection),
  "index.html: compact contact CTA contract changed",
);

assert(!contactSection.includes("<form"), "index.html: contact section must not submit personal data");

assert(contact, "kontakt.html: missing public contact page");

assert(
  contact.includes(`href="${APPROVED_CONTACT.telephoneUri}"`) &&
    contact.includes(APPROVED_CONTACT.phone) &&
    contact.includes(`href="${APPROVED_CONTACT.emailUri}"`) &&
    contact.includes(APPROVED_CONTACT.email) &&
    new RegExp(`<address\\b[^>]*class="contact__address"[^>]*>\\s*${APPROVED_CONTACT.address}\\s*<\\/address>`, "iu").test(contact),
  "kontakt.html: approved contact details changed",
);

const publicHtml = [...pages.values()].join("\n");

const telephoneUris = [...publicHtml.matchAll(/href="(tel:[^"]+)"/giu)].map((match) => match[1]);

const emailUris = [...publicHtml.matchAll(/href="(mailto:[^"]+)"/giu)].map((match) => match[1]);

assert(telephoneUris.length > 0 && telephoneUris.every((uri) => uri === APPROVED_CONTACT.telephoneUri), "Public telephone links must use only the approved number");

assert(emailUris.length > 0 && emailUris.every((uri) => uri === APPROVED_CONTACT.emailUri), "Public email links must use only the approved address");

for (const { file } of SHARED_SHELL_PAGES) {
  const html = pages.get(file);

  assert(
    html.includes(FOOTER_COPYRIGHT) &&
      html.includes(FOOTER_CONTACT.address) &&
      FOOTER_LEGAL_LINKS.every(({ href }) => html.includes(`href="${href}"`)) &&
      FOOTER_SOCIAL_LINKS.every(({ href }) => html.includes(`href="${href}"`)),
    `${file}: shared footer content contract changed`,
  );
}

for (const [file, html] of pages) {
  if (file !== "kontakt.html") {
    assert(!html.includes('data-netlify="true"'), `${file}: personal-data form must remain limited to kontakt.html`);
  }
}

const contactForm = contact.match(/<form\b(?=[^>]*\bname="kontakt")[\s\S]*?<\/form>/iu)?.[0];

assert(contactForm, "kontakt.html: missing contact form");

assert(
  contactForm.includes('method="POST"') &&
    contactForm.includes('action="/thank-you.html"') &&
    contactForm.includes('data-netlify="true"') &&
    contactForm.includes('netlify-honeypot="bot-field"') &&
    contactForm.includes('name="form-name" value="kontakt"') &&
    contactForm.includes('name="bot-field"'),
  "kontakt.html: Netlify Forms contract changed",
);

for (const fieldName of ["name", "email", "topic", "message"]) {
  assert(new RegExp(`<(?:input|select|textarea)\\b[^>]*name="${fieldName}"[^>]*required`, "iu").test(contactForm), `kontakt.html: required ${fieldName} field changed`);
}

console.log(
  `Verified public-content integrity for ${PUBLIC_PAGES.length} pages: approved contact, legal, social, and form contracts remain factual without unsupported claims, structured-data fields, profiles, or placeholders.`,
);
