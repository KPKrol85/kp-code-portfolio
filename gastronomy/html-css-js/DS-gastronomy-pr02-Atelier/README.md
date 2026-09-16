# Atelier

## PL

### Przegląd projektu
Atelier to wielostronicowy, statyczny serwis restauracyjny zbudowany w oparciu o HTML, CSS i JavaScript (ES Modules). Projekt obejmuje stronę główną oraz dedykowane podstrony: o restauracji, menu, galerię, kontakt, strony prawne, stronę offline, stronę potwierdzenia formularza i stronę 404.

### Kluczowe funkcje
- Wielostronicowa nawigacja z rozwijanymi sekcjami i wariantem mobilnym (drawer), wraz z obsługą klawiatury i zarządzaniem fokusem.
- Przełącznik motywu jasny/ciemny z zapisem preferencji w `localStorage` i synchronizacją `meta[name="theme-color"]`.
- Dynamiczne renderowanie pozycji menu z `data/menu.json` (sekcja wyróżniona na stronie głównej oraz kategorie na podstronie menu).
- Filtrowanie i wyszukiwanie dań po tagach i treści na stronie menu.
- Galeria z lightboxem (nawigacja klawiaturą, licznik slajdów, fullscreen, obsługa gestów dotykowych).
- Walidacja formularza kontaktowego po stronie klienta (walidacja pól, komunikaty błędów, status wysyłki).
- Banner statusu sieci online/offline oraz kontekstowe komunikaty offline na wybranych podstronach.
- Service Worker z cache zasobów i fallbackiem do `offline.html` dla żądań nawigacyjnych.

### Stack technologiczny
**Runtime (frontend):**
- HTML5 (wielostronicowa struktura statyczna)
- CSS (architektura modułowa: `base`, `layout`, `components`, `pages`)
- JavaScript (ES Modules)
- PWA surface: `manifest.webmanifest` + `sw.js`

**Narzędzia i build:**
- npm scripts
- PostCSS (`postcss-import`, `cssnano`) do bundlingu/minifikacji CSS
- esbuild do bundlingu/minifikacji JavaScript
- Sharp + fast-glob (pipeline optymalizacji obrazów)
- ESLint
- html-validate
- linkinator
- pa11y-ci
- http-server + start-server-and-test + cross-env

### Struktura projektu
```text
pr-02-atelier/
├── *.html                     # Strony serwisu (home, podstrony, legal, offline, 404)
├── css/
│   ├── base/                  # reset, typografia, tokeny
│   ├── layout/                # grid, header, footer, układ
│   ├── components/            # nawigacja, karty, formularze, lightbox, stany
│   ├── pages/                 # style specyficzne dla podstron
│   ├── style.css              # wejście źródłowe CSS
│   └── style.min.css          # zminifikowany bundle CSS
├── js/
│   ├── app/init.js            # orkiestracja inicjalizacji common/page
│   ├── core/                  # utilsy DOM i scrollspy
│   ├── features/              # moduły funkcjonalne (menu, gallery, form, nav, theme...)
│   ├── script.js              # główny punkt wejścia aplikacji
│   ├── core.js                # punkt wejścia skryptów współdzielonych
│   ├── script.min.js          # zminifikowany bundle app
│   └── core.min.js            # zminifikowany bundle core
├── data/menu.json             # dane menu renderowane dynamicznie
├── assets/
│   ├── img-src/               # źródłowe obrazy
│   ├── img-optimized/         # wygenerowane warianty (avif/webp/jpg/png/svg)
│   ├── icons/                 # favicons, skróty, ikony SVG, screenshoty manifestu
│   ├── fonts/                 # fonty lokalne
│   └── docs/menu.svg          # plik menu do pobrania
├── scripts/
│   ├── build-dist.js          # budowa katalogu dist
│   └── images/build-images.js # generowanie obrazów zoptymalizowanych
├── sw.js
├── manifest.webmanifest
├── robots.txt
├── sitemap.xml
├── _headers
└── _redirects
```

### Instalacja i konfiguracja
```bash
npm install
```

### Development lokalny
```bash
npm run dev:server
```
Serwer uruchamia projekt pod adresem `http://127.0.0.1:5173`.

Dostępne kontrole jakości:
```bash
npm run lint
npm run validate:html
npm run check
```

### Build produkcyjny
```bash
npm run build
npm run build:dist
```
- `npm run build` generuje zminifikowane pliki CSS i JS.
- `npm run build:dist` tworzy katalog `dist/` z plikami stron, assetami i konfiguracją runtime.

Dodatkowo:
```bash
npm run images:build
```
Skrypt przebudowuje zasoby w `assets/img-optimized` na podstawie `assets/img-src`.

### Deployment
Repozytorium zawiera konfigurację typową dla hostingu statycznego z regułami:
- `_redirects` (m.in. obsługa `404.html`),
- `_headers` (nagłówki bezpieczeństwa i cache),
- `build-dist.js` przygotowujący artefakt publikacyjny `dist/`.

### Dostępność
Wdrożone elementy dostępności obejmują m.in.:
- skip linki do głównej treści i (na stronie menu) do nawigacji kategorii,
- semantyczne landmarki (`header`, `main`, `nav`, `footer`) i rozbudowane etykiety ARIA,
- mobilne menu z kontrolą fokusa (focus trap) i obsługą zamykania przez interakcję poza menu,
- lightbox jako dialog modalny (`role="dialog"`, `aria-modal`, klawisze nawigacyjne, przywracanie fokusa),
- komunikaty statusowe online/offline (`aria-live`) i walidację formularza z `aria-invalid`.

W repozytorium znajduje się też skrypt audytu dostępności:
```bash
npm run check:a11y
```

### SEO
Projekt zawiera wdrożone elementy SEO:
- meta `description`, `canonical`, `robots`,
- metadane Open Graph i Twitter Cards,
- dane strukturalne JSON-LD (`Organization`, `Restaurant`),
- `robots.txt` i `sitemap.xml`.

### Wydajność
W projekcie zaimplementowano m.in.:
- minifikację CSS i bundling/minifikację JS,
- responsywne obrazy (`picture`, `srcset`, AVIF/WebP/JPG),
- preloading kluczowych fontów i obrazu hero,
- pipeline optymalizacji obrazów oparty o Sharp,
- cache statycznych zasobów przez Service Worker.

### Utrzymanie projektu
- Główna orkiestracja inicjalizacji znajduje się w `js/app/init.js` (inicjalizatory wspólne + per strona).
- Funkcje domenowe są rozdzielone w `js/features/*` (menu, galeria, nawigacja, formularz, status sieci, motyw).
- Dane menu są utrzymywane w `data/menu.json` i renderowane po stronie klienta.
- Struktura CSS jest podzielona według odpowiedzialności (`base`/`layout`/`components`/`pages`) i scalana przez PostCSS.
- Skrypty w `scripts/` kontrolują przygotowanie obrazów i artefaktu `dist/`.

### Roadmap
- Rozszerzenie konfiguracji ESLint tak, aby wykluczyć z lintowania wszystkie bundlowane pliki `.min.js`.
- Dodanie automatycznego cache bustingu nazw plików assetów w procesie build.
- Rozszerzenie testów dostępności (`pa11y-ci`) o pełny zestaw podstron i progi jakości.
- Ujednolicenie deklaracji metadanych SEO pomiędzy wszystkimi podstronami.
- Dodanie automatycznej walidacji `sitemap.xml` i `robots.txt` w pipeline `npm run check`.

### Licencja
MIT (zgodnie z polem `license` w `package.json`).

## EN

### Project Overview
Atelier is a multi-page static restaurant website built with HTML, CSS, and JavaScript (ES Modules). The project includes a homepage and dedicated pages for about, menu, gallery, contact, legal content, offline view, form confirmation, and a 404 page.

### Key Features
- Multi-page navigation with dropdown sections and a mobile drawer variant, including keyboard handling and focus management.
- Light/dark theme toggle with preference persistence in `localStorage` and `meta[name="theme-color"]` synchronization.
- Dynamic menu rendering from `data/menu.json` (featured section on the homepage and category sections on the menu page).
- Menu filtering and searching by tags and text content.
- Gallery lightbox (keyboard navigation, slide counter, fullscreen mode, touch gesture support).
- Client-side contact form validation (field validation, error messages, submission status).
- Online/offline network status banner with contextual offline notes on selected pages.
- Service Worker with asset caching and `offline.html` fallback for navigation requests.

### Tech Stack
**Runtime (frontend):**
- HTML5 (multi-page static structure)
- CSS (modular architecture: `base`, `layout`, `components`, `pages`)
- JavaScript (ES Modules)
- PWA surface: `manifest.webmanifest` + `sw.js`

**Tooling and build:**
- npm scripts
- PostCSS (`postcss-import`, `cssnano`) for CSS bundling/minification
- esbuild for JavaScript bundling/minification
- Sharp + fast-glob (image optimization pipeline)
- ESLint
- html-validate
- linkinator
- pa11y-ci
- http-server + start-server-and-test + cross-env

### Project Structure
```text
pr-02-atelier/
├── *.html                     # Site pages (home, subpages, legal, offline, 404)
├── css/
│   ├── base/                  # reset, typography, tokens
│   ├── layout/                # grid, header, footer, layout
│   ├── components/            # navigation, cards, forms, lightbox, states
│   ├── pages/                 # page-specific styles
│   ├── style.css              # source CSS entry
│   └── style.min.css          # minified CSS bundle
├── js/
│   ├── app/init.js            # common/page initialization orchestration
│   ├── core/                  # DOM utilities and scrollspy
│   ├── features/              # feature modules (menu, gallery, form, nav, theme...)
│   ├── script.js              # main app entry point
│   ├── core.js                # shared script entry point
│   ├── script.min.js          # minified app bundle
│   └── core.min.js            # minified core bundle
├── data/menu.json             # dynamically rendered menu data
├── assets/
│   ├── img-src/               # source images
│   ├── img-optimized/         # generated variants (avif/webp/jpg/png/svg)
│   ├── icons/                 # favicons, shortcuts, SVG icons, manifest screenshots
│   ├── fonts/                 # local fonts
│   └── docs/menu.svg          # downloadable menu asset
├── scripts/
│   ├── build-dist.js          # dist directory build script
│   └── images/build-images.js # optimized image generation
├── sw.js
├── manifest.webmanifest
├── robots.txt
├── sitemap.xml
├── _headers
└── _redirects
```

### Setup and Installation
```bash
npm install
```

### Local Development
```bash
npm run dev:server
```
The server runs at `http://127.0.0.1:5173`.

Available quality checks:
```bash
npm run lint
npm run validate:html
npm run check
```

### Production Build
```bash
npm run build
npm run build:dist
```
- `npm run build` generates minified CSS and JS outputs.
- `npm run build:dist` creates the `dist/` publication artifact with pages, assets, and runtime config.

Additional image pipeline command:
```bash
npm run images:build
```
This rebuilds `assets/img-optimized` from `assets/img-src`.

### Deployment
The repository includes static-hosting-oriented deployment configuration with:
- `_redirects` (including `404.html` handling),
- `_headers` (security and caching headers),
- `build-dist.js` for preparing the `dist/` deployment artifact.

### Accessibility
Implemented accessibility elements include:
- skip links to main content and (on the menu page) category navigation,
- semantic landmarks (`header`, `main`, `nav`, `footer`) with extensive ARIA labeling,
- mobile navigation with focus trapping and outside-interaction close handling,
- lightbox modal dialog (`role="dialog"`, `aria-modal`, keyboard shortcuts, focus restoration),
- online/offline live status messaging (`aria-live`) and form validation with `aria-invalid`.

The repository also includes an accessibility audit script:
```bash
npm run check:a11y
```

### SEO
The project includes implemented SEO elements:
- `description`, `canonical`, and `robots` meta tags,
- Open Graph and Twitter Card metadata,
- JSON-LD structured data (`Organization`, `Restaurant`),
- `robots.txt` and `sitemap.xml`.

### Performance
Detected performance-oriented implementation includes:
- CSS minification and JS bundling/minification,
- responsive images (`picture`, `srcset`, AVIF/WebP/JPG),
- preload hints for key fonts and hero image,
- Sharp-based image optimization pipeline,
- Service Worker caching for static assets.

### Project Maintenance
- Main initialization orchestration is in `js/app/init.js` (common + per-page initializers).
- Domain functionality is separated in `js/features/*` (menu, gallery, navigation, form, network state, theme).
- Menu content is maintained in `data/menu.json` and rendered client-side.
- CSS is organized by responsibility (`base`/`layout`/`components`/`pages`) and composed via PostCSS.
- `scripts/` controls image generation and `dist/` artifact assembly.

### Roadmap
- Extend ESLint configuration to exclude all bundled `.min.js` files from linting.
- Add automated asset filename cache busting in the build process.
- Expand accessibility checks (`pa11y-ci`) to cover the full page set with quality thresholds.
- Standardize SEO metadata declarations across all pages.
- Add automated `sitemap.xml` and `robots.txt` validation in the `npm run check` workflow.

### License
MIT (as declared in `package.json`).
