export const SITE = Object.freeze({
  origin: "https://education-pr01-laurenenglish.netlify.app",
  name: "Lauren English",
  language: "pl-PL",
  locale: "pl_PL",
  manifest: Object.freeze({
    path: "/site.webmanifest",
  }),
  favicon: Object.freeze({
    path: "/assets/favicon/favicon.svg",
    type: "image/svg+xml",
  }),
  brandLogo: Object.freeze({
    path: "/assets/img/logo/logo.svg",
    width: 512,
    height: 512,
  }),
  headingFont: Object.freeze({
    path: "/assets/fonts/literata-700.woff2",
    type: "font/woff2",
  }),
  runtime: Object.freeze({
    stylesheet: "/css/style.css",
    javascript: "/js/main.js",
  }),
  socialImage: Object.freeze({
    path: "/assets/og/og.png",
    type: "image/png",
    width: 1200,
    height: 630,
    alt: "Lauren English — nauka angielskiego w spokojnym rytmie.",
  }),
});

const freezePage = (page) => Object.freeze(page);

export const INDEXABLE_PAGES = Object.freeze([
  freezePage({
    key: "home",
    file: "index.html",
    path: "/",
    runtimePath: "/index.html",
    currentHref: "/index.html",
    title: "Lauren English | Nauka angielskiego",
    description:
      "Informacje o indywidualnej nauce angielskiego, konwersacjach, przygotowaniu do egzaminów, pakietach i materiałach.",
    schemaType: "WebSite",
  }),
  freezePage({
    key: "services",
    file: "uslugi.html",
    path: "/uslugi.html",
    runtimePath: "/uslugi.html",
    currentHref: "/uslugi.html",
    title: "Usługi | Lauren English",
    description:
      "Usługi języka angielskiego dla osób, które chcą uporządkować naukę: korepetycje 1:1, konwersacje, przygotowanie do egzaminów i English for Business.",
    schemaType: "WebPage",
  }),
  freezePage({
    key: "packages",
    file: "pakiety.html",
    path: "/pakiety.html",
    runtimePath: "/pakiety.html",
    currentHref: "/pakiety.html",
    title: "Pakiety | Lauren English",
    description:
      "Pakiety nauki angielskiego dopasowane do rytmu pracy i celów: Start, Regular i Intensive z jasnym zakresem wsparcia.",
    schemaType: "WebPage",
  }),
  freezePage({
    key: "materials",
    file: "materialy.html",
    path: "/materialy.html",
    runtimePath: "/materialy.html",
    currentHref: "/materialy.html",
    title: "Materiały | Lauren English",
    description:
      "Materiały do nauki angielskiego: gramatyka, słownictwo, speaking i przygotowanie do egzaminów. Zestawy PDF i notatki do samodzielnej pracy.",
    schemaType: "WebPage",
  }),
  freezePage({
    key: "progress",
    file: "postepy.html",
    path: "/postepy.html",
    runtimePath: "/postepy.html",
    currentHref: "/postepy.html",
    title: "Dziennik postępów | Lauren English",
    description:
      "Lokalny dziennik postępów w nauce angielskiego z celami tygodnia, check-inami i statystykami bez logowania.",
    schemaType: "WebPage",
  }),
  freezePage({
    key: "contact",
    file: "kontakt.html",
    path: "/kontakt.html",
    runtimePath: "/kontakt.html",
    currentHref: "/kontakt.html",
    title: "Kontakt | Lauren English",
    description:
      "Kontakt w sprawie indywidualnej nauki angielskiego: telefon, e-mail, adres oraz formularz zapytania o cele, poziom i format lekcji.",
    schemaType: "WebPage",
  }),
]);

export const PROJECT_DISCLOSURE = Object.freeze({
  enabled: true,
  version: "2",
  storageKey: "laurenEnglishProjectDisclosure",
  eligiblePaths: Object.freeze(
    INDEXABLE_PAGES.map(({ runtimePath }) => runtimePath),
  ),
});

export const LEGAL_PAGES = Object.freeze([
  freezePage({
    key: "privacy",
    file: "polityka-prywatnosci.html",
    path: "/polityka-prywatnosci.html",
    runtimePath: "/polityka-prywatnosci.html",
    title: "Polityka prywatności | Lauren English",
  }),
  freezePage({
    key: "terms",
    file: "regulamin.html",
    path: "/regulamin.html",
    runtimePath: "/regulamin.html",
    title: "Regulamin serwisu | Lauren English",
  }),
  freezePage({
    key: "cookies",
    file: "cookies.html",
    path: "/cookies.html",
    runtimePath: "/cookies.html",
    title: "Polityka cookies | Lauren English",
  }),
]);

export const UTILITY_PAGES = Object.freeze([
  freezePage({
    key: "not-found",
    file: "404.html",
    path: "/404.html",
    runtimePath: "/404.html",
    title: "404 — Nie znaleziono strony | Lauren English",
  }),
  freezePage({
    key: "offline",
    file: "offline.html",
    path: "/offline.html",
    runtimePath: "/offline.html",
    title: "Offline | Lauren English",
  }),
  freezePage({
    key: "thank-you",
    file: "thank-you.html",
    path: "/thank-you.html",
    runtimePath: "/thank-you.html",
    aliases: Object.freeze(["/thank-you"]),
    title: "Dziękuję za wiadomość | Lauren English",
  }),
  ...LEGAL_PAGES,
]);

export const SHARED_SHELL_PAGES = Object.freeze([
  ...INDEXABLE_PAGES,
  ...LEGAL_PAGES,
]);

export const ALL_PAGES = Object.freeze([...INDEXABLE_PAGES, ...UTILITY_PAGES]);

export const SEO_MARKERS = Object.freeze({
  start: "    <!-- seo:head:start -->",
  end: "    <!-- seo:head:end -->",
});

export const HEAD_SECTION_COMMENTS = Object.freeze({
  documentMetadata: "    <!-- Document metadata -->",
  seo: "    <!-- SEO -->",
  appMetadata: "    <!-- App metadata -->",
  fonts: "    <!-- Fonts -->",
  styles: "    <!-- Styles -->",
  scripts: "    <!-- Scripts -->",
  openGraph: "    <!-- Open Graph -->",
  twitterCard: "    <!-- Twitter Card -->",
  structuredData: "    <!-- Structured data -->",
  theme: "    <!-- Theme -->",
});

export const absoluteUrl = (path) => new URL(path, SITE.origin).href;

const indentJson = (value) =>
  JSON.stringify(value, null, 2)
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");

const getStructuredData = (page) => {
  const canonical = absoluteUrl(page.path);
  const data = {
    "@context": "https://schema.org",
    "@type": page.schemaType,
    "@id":
      page.schemaType === "WebSite"
        ? `${canonical}#website`
        : `${canonical}#webpage`,
    url: canonical,
    name: page.schemaType === "WebSite" ? SITE.name : page.title,
    description: page.description,
    inLanguage: SITE.language,
  };

  if (page.schemaType === "WebPage") {
    data.isPartOf = { "@id": `${absoluteUrl("/")}#website` };
  }

  return data;
};

const renderIndexableHead = (page) => {
  const canonical = absoluteUrl(page.path);
  const imageUrl = absoluteUrl(SITE.socialImage.path);

  return `${SEO_MARKERS.start}
${HEAD_SECTION_COMMENTS.seo}
    <title>${page.title}</title>
    <meta name="description" content="${page.description}" />
    <link rel="canonical" href="${canonical}" />
${HEAD_SECTION_COMMENTS.appMetadata}
    <link rel="manifest" href="${SITE.manifest.path}" vite-ignore />
    <link rel="icon" href="${SITE.favicon.path}" type="${SITE.favicon.type}" />
${HEAD_SECTION_COMMENTS.fonts}
    <link rel="preload" href="${SITE.headingFont.path}" as="font" type="${SITE.headingFont.type}" crossorigin />
${HEAD_SECTION_COMMENTS.styles}
    <link rel="stylesheet" href="${SITE.runtime.stylesheet}" />
${HEAD_SECTION_COMMENTS.scripts}
    <script type="module" src="${SITE.runtime.javascript}"></script>
${HEAD_SECTION_COMMENTS.openGraph}
    <meta property="og:title" content="${page.title}" />
    <meta property="og:description" content="${page.description}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE.name}" />
    <meta property="og:locale" content="${SITE.locale}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:secure_url" content="${imageUrl}" />
    <meta property="og:image:type" content="${SITE.socialImage.type}" />
    <meta property="og:image:width" content="${SITE.socialImage.width}" />
    <meta property="og:image:height" content="${SITE.socialImage.height}" />
    <meta property="og:image:alt" content="${SITE.socialImage.alt}" />
${HEAD_SECTION_COMMENTS.twitterCard}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${page.title}" />
    <meta name="twitter:description" content="${page.description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta name="twitter:image:alt" content="${SITE.socialImage.alt}" />
${HEAD_SECTION_COMMENTS.structuredData}
    <script type="application/ld+json">
${indentJson(getStructuredData(page))}
    </script>
${SEO_MARKERS.end}`;
};

const renderUtilityHead = (page) => `${SEO_MARKERS.start}
${HEAD_SECTION_COMMENTS.seo}
    <title>${page.title}</title>
    <meta name="robots" content="noindex, nofollow" />
${HEAD_SECTION_COMMENTS.appMetadata}
    <link rel="manifest" href="${SITE.manifest.path}" vite-ignore />
    <link rel="icon" href="${SITE.favicon.path}" type="${SITE.favicon.type}" />
${HEAD_SECTION_COMMENTS.fonts}
    <link rel="preload" href="${SITE.headingFont.path}" as="font" type="${SITE.headingFont.type}" crossorigin />
${HEAD_SECTION_COMMENTS.styles}
    <link rel="stylesheet" href="${SITE.runtime.stylesheet}" />
${HEAD_SECTION_COMMENTS.scripts}
    <script type="module" src="${SITE.runtime.javascript}"></script>
${SEO_MARKERS.end}`;

export const renderSeoHead = (page) =>
  INDEXABLE_PAGES.includes(page)
    ? renderIndexableHead(page)
    : renderUtilityHead(page);

export const renderSitemap = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${INDEXABLE_PAGES.map(
  (page) => `  <url>
    <loc>${absoluteUrl(page.path)}</loc>
  </url>`,
).join("\n")}
</urlset>
`;

export const renderRobots = () => `User-agent: *
Allow: /
Sitemap: ${absoluteUrl("/sitemap.xml")}
`;

export const renderRedirects = () => {
  const rules = UTILITY_PAGES.flatMap((page) =>
    (page.aliases ?? []).map(
      (alias) => `${alias}    ${page.runtimePath}   200`,
    ),
  );
  return `${rules.join("\n")}\n`;
};
