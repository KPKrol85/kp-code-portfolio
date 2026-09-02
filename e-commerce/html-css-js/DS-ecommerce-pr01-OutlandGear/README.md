# Outland Gear

## PL

### Przegląd projektu

Outland Gear to demonstracyjny front-end wielostronicowego sklepu z wyposażeniem outdoorowym, przygotowany przez KP_Code Digital Studio. Repozytorium zawiera statyczne strony HTML, warstwową architekturę CSS, moduły JavaScript oraz lokalne dane JSON dla katalogu produktów i kompletów podróżnych.

Projekt odwzorowuje ścieżkę od wyszukiwania i filtrowania produktów, przez kartę produktu i koszyk, do walidowanego checkoutu demo. Nie zawiera backendu zamówień, kont użytkowników ani integracji płatniczej; złożenie formularza checkout czyści lokalny koszyk i prowadzi do strony potwierdzenia.

### Wersja online

[Otwórz Outland Gear](https://e-commerce-pr02-outlandgear.netlify.app/)

### Kluczowe funkcje

- Katalog generowany z `data/products.json`, z wyszukiwaniem, filtrowaniem według kategorii, podkategorii, ceny, oceny i oznaczeń, sortowaniem oraz stopniowym doładowywaniem wyników.
- Synchronizacja zapytania, filtrów, sortowania i limitu wyników z parametrami URL.
- Karty produktów z galerią, specyfikacją, powiązanymi produktami i metadanymi aktualizowanymi na podstawie sluga.
- Komplety podróżne zdefiniowane w `data/travel-kits.json` i powiązane z pozycjami katalogu.
- Koszyk zapisywany w `localStorage`, z obsługą ilości, usuwania pozycji, podsumowania i komunikatów o problemach z pamięcią przeglądarki.
- Walidacja po stronie klienta dla checkoutu demo, formularza kontaktowego i formularza newslettera.
- Formularz kontaktowy skonfigurowany dla Netlify Forms; formularz newslettera realizuje lokalną walidację i przekierowanie do strony potwierdzenia.
- Motyw jasny i ciemny oparty na preferencji systemowej oraz wyborze zapisanym w `localStorage`.
- Wspólna nawigacja i stopka, responsywny panel nawigacyjny, FAQ typu accordion, modal informacyjny oraz stany ładowania, braku danych i błędów.

### Stack technologiczny

**Front-end**

- semantyczny HTML5 w architekturze MPA;
- CSS z warstwami `tokens`, `base`, `layout`, `components` i `pages`;
- Vanilla JavaScript jako moduły ES;
- JSON jako lokalne źródło danych.

**Build i assety**

- Node.js i npm scripts;
- PostCSS, `postcss-import` i cssnano;
- esbuild;
- sharp.

**Testy i automatyzacja**

- Playwright;
- `@axe-core/playwright`;
- GitHub Actions;
- konfiguracja wdrożenia Netlify.

### Architektura

- Pliki HTML w katalogu głównym są kanonicznymi stronami MPA. `produkt.html` i `komplety.html` pełnią również rolę szablonów stron szczegółowych.
- `partials/header.html` i `partials/footer.html` są ładowane w źródłowych stronach przez `js/modules/partials.js`; build osadza ich treść bezpośrednio w wygenerowanym HTML.
- `js/app.js` uruchamia moduły funkcjonalne po przygotowaniu części wspólnych. Logika katalogu, produktu, kompletów, koszyka, formularzy, nawigacji i motywu pozostaje rozdzielona w `js/modules/`.
- `data/*.json` przechowuje statyczne dane produktów, kategorii i kompletów. Stan koszyka i preferencje pozostają po stronie przeglądarki.
- Build łączy i minifikuje CSS oraz JavaScript, kopiuje dane i assety, generuje strony `/produkt/<slug>/` i `/komplety/<slug>/`, a także aktualizuje `robots.txt` i `sitemap.xml`.
- `dist/` jest generowanym, ignorowanym przez Git katalogiem publikacji i nie stanowi źródła do ręcznej edycji.

### Struktura projektu

```text
.
├── .github/workflows/       # workflow dostępności dla GitHub Actions
├── assets/
│   ├── img-src/             # kanoniczne obrazy źródłowe
│   ├── img/                 # warianty generowane przez pipeline obrazów
│   ├── fav-icons/           # favicony i web manifest
│   ├── fonts/               # lokalne fonty WOFF2
│   └── svg/                 # logo, ikony i placeholdery
├── css/
│   ├── components/          # style komponentów interfejsu
│   ├── pages/               # style przypisane do widoków
│   └── main.css             # punkt wejścia PostCSS
├── data/                    # produkty, kategorie i komplety podróżne
├── js/
│   ├── modules/             # moduły funkcjonalne aplikacji
│   └── app.js               # punkt wejścia JavaScript
├── partials/                # współdzielona nawigacja i stopka
├── scripts/                 # build, SEO, podgląd i obrazy
├── tests/a11y/              # audyty Playwright + axe
├── *.html                   # kanoniczne strony MPA
├── netlify.toml
├── playwright.config.js
└── package.json
```

### Instalacja

Repozytorium używa npm i zawiera `package-lock.json`.

```bash
npm ci
```

### Development lokalny

Pełny podgląd lokalny buduje `dist/` i uruchamia serwer pod adresem `http://127.0.0.1:4173`:

```bash
npm run build:preview
```

Niezależne zadania obserwujące przebudowują wyłącznie produkcyjny CSS lub JavaScript w `dist/`; nie uruchamiają serwera ani nie regenerują HTML:

```bash
npm run watch:css
npm run watch:js
```

### Build produkcyjny

```bash
npm run build
```

Build czyści i odtwarza `dist/`, generuje `css/main.min.css` i `js/app.min.js`, kopiuje `assets/` oraz `data/` z pominięciem `assets/img-src/`, osadza partiale, tworzy prerenderowane strony szczegółowe i generuje pliki SEO.

Optymalizacja obrazów jest osobnym krokiem i nie jest uruchamiana przez `npm run build`. Po zmianie plików w `assets/img-src/` należy najpierw odtworzyć `assets/img/`, a następnie wykonać build:

```bash
npm run build:images
npm run build
```

### Testy i walidacja

```bash
npm run qa:a11y
```

Polecenie Playwright automatycznie wykonuje build, uruchamia podgląd i przeprowadza skany axe w Chromium dla 11 skonfigurowanych tras, w tym strony głównej, katalogu, produktu, koszyka, checkoutu, kontaktu, kompletu podróżnego i stron prawnych. Workflow `.github/workflows/accessibility-ci.yml` uruchamia ten sam audyt dla pull requestów i zmian wysyłanych do gałęzi `main`.

### Wdrożenie

`netlify.toml` ustawia `npm run build` jako polecenie budowania i `dist/` jako katalog publikacji. Konfiguracja definiuje również HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` oraz polityki cache dla dokumentów, danych i assetów.

Formularz kontaktowy używa znacznika `data-netlify="true"` i wysyła dane jako `application/x-www-form-urlencoded`, dzięki czemu jego obsługa jest powiązana ze środowiskiem Netlify.

### Dostępność

Projekt zawiera konkretne mechanizmy dostępności, bez deklarowania formalnej zgodności ze standardem:

- linki pomijające nawigację i semantyczne landmarki;
- widoczne style `:focus-visible` i obsługę `prefers-reduced-motion`;
- etykiety formularzy, komunikaty błędów, `aria-invalid`, `aria-describedby` i regiony live;
- synchronizację `aria-expanded`, `aria-hidden`, `aria-current` i `aria-pressed`;
- obsługę klawisza Escape w panelu mobilnym oraz pułapkę fokusu i przywracanie fokusu w panelu mobilnym i modalu;
- automatyczne skany axe skonfigurowane w Playwright.

### SEO

- Strony źródłowe zawierają tytuły, opisy, adresy kanoniczne, Open Graph, Twitter Card i JSON-LD.
- Szablony `produkt.html` i `komplety.html` są oznaczone jako `noindex`; build tworzy dla danych slugowych indeksowalne strony z indywidualnymi metadanymi.
- `scripts/seo-config.mjs` definiuje publiczny origin i rejestr tras używany do generowania `robots.txt` oraz `sitemap.xml`.
- Koszyk, checkout i strony potwierdzeń mają dyrektywy `noindex`, a publiczne strony informacyjne znajdują się w generowanej mapie witryny.

### PWA i obsługa offline

`assets/fav-icons/site.webmanifest` definiuje nazwę aplikacji, `start_url`, zakres, tryb `standalone`, ikony, skróty i zrzuty ekranu. Repozytorium nie zawiera jednak service workera ani jego rejestracji, dlatego nie implementuje cache offline.

### Wydajność

- Produkcyjny CSS jest scalany i minifikowany przez PostCSS, a moduły JavaScript są bundlowane i minifikowane przez esbuild do formatu ES module z targetem `es2020`.
- Pipeline sharp tworzy warianty JPG/PNG, WebP i AVIF z obrazów źródłowych.
- Obrazy w interfejsie korzystają z wariantów `<picture>`, jawnych wymiarów, `loading="lazy"` i `decoding="async"` tam, gdzie przewiduje to dany widok.
- Netlify otrzymuje oddzielne polityki cache dla HTML, CSS, JavaScript, danych, manifestu i pozostałych assetów.

### Dane i trwałość stanu

- Produkty, kategorie i komplety są statycznymi danymi w `data/*.json`; aplikacja nie korzysta z bazy danych ani zdalnego API katalogowego.
- Koszyk, wybrany motyw i akceptacja informacji o demonstracyjnym charakterze projektu są zapisywane lokalnie w przeglądarce; dla akceptacji dostępny jest fallback do `sessionStorage`.
- Checkout nie zapisuje ani nie wysyła zamówienia. Formularz newslettera nie zapisuje subskrypcji w usłudze zewnętrznej.
- Formularz kontaktowy jest jedynym formularzem skonfigurowanym do wysłania danych do usługi hostingowej.

### Utrzymanie projektu

- Zmiany stylów należy wprowadzać w `css/`, zaczynając od importów w `css/main.css`; pliku `dist/css/main.min.css` nie należy edytować ręcznie.
- Moduły źródłowe JavaScript znajdują się w `js/`, a produkcyjny bundle powstaje z `js/app.js`.
- Dane katalogu należy utrzymywać w `data/*.json`; slugi produktów i kompletów wpływają na prerenderowane ścieżki oraz sitemapę.
- `partials/` jest kanonicznym źródłem wspólnej nawigacji i stopki.
- `assets/img-src/` jest źródłem obrazów, a `assets/img/` wynikiem osobnego pipeline’u sharp.
- Publiczny origin oraz listy indeksowanych tras są utrzymywane w `scripts/seo-config.mjs`.

### Licencja

Projekt jest udostępniony na [własnościowej licencji KP_Code](LICENSE) i nie jest oprogramowaniem open source. Publiczna widoczność repozytorium nie oznacza zgody na kopiowanie, modyfikowanie, wdrażanie ani komercyjne wykorzystanie Projektu.

## EN

### Project Overview

Outland Gear is a demonstration front end for a multi-page outdoor equipment store, created by KP_Code Digital Studio. The repository contains static HTML pages, layered CSS, JavaScript modules, and local JSON data for the product catalog and travel kits.

The project models the path from product search and filtering through product details and cart to a validated demo checkout. It does not include an order backend, user accounts, or payment integration; submitting the checkout form clears the local cart and opens a confirmation page.

### Live Version

[Open Outland Gear](https://e-commerce-pr02-outlandgear.netlify.app/)

### Key Features

- Catalog rendered from `data/products.json`, with search, category, subcategory, price, rating and badge filters, sorting, and incremental result loading.
- Query, filter, sort, and result-limit state synchronized with URL parameters.
- Product details with a gallery, specification, related products, and metadata updated from the slug.
- Travel kits defined in `data/travel-kits.json` and linked to catalog entries.
- `localStorage` cart with quantity controls, item removal, totals, and browser-storage failure messaging.
- Client-side validation for the demo checkout, contact form, and newsletter form.
- Contact form configured for Netlify Forms; the newsletter form performs local validation and redirects to a confirmation page.
- Light and dark themes based on the system preference and a selection persisted in `localStorage`.
- Shared navigation and footer, responsive navigation drawer, accordion FAQ, project-information modal, and loading, empty, and error states.

### Tech Stack

**Front end**

- semantic HTML5 in an MPA architecture;
- CSS organized into `tokens`, `base`, `layout`, `components`, and `pages` layers;
- Vanilla JavaScript as ES modules;
- JSON as a local data source.

**Build and assets**

- Node.js and npm scripts;
- PostCSS, `postcss-import`, and cssnano;
- esbuild;
- sharp.

**Testing and automation**

- Playwright;
- `@axe-core/playwright`;
- GitHub Actions;
- Netlify deployment configuration.

### Architecture

- Root HTML files are the canonical MPA pages. `produkt.html` and `komplety.html` also act as detail-page templates.
- `partials/header.html` and `partials/footer.html` are loaded into source pages by `js/modules/partials.js`; the build embeds their content directly in generated HTML.
- `js/app.js` starts the feature modules after shared partials are ready. Catalog, product, travel-kit, cart, form, navigation, and theme logic remains separated under `js/modules/`.
- `data/*.json` stores static product, category, and travel-kit data. Cart state and preferences remain in the browser.
- The build bundles and minifies CSS and JavaScript, copies data and assets, generates `/produkt/<slug>/` and `/komplety/<slug>/` pages, and updates `robots.txt` and `sitemap.xml`.
- `dist/` is a generated, Git-ignored publish directory and is not a source for manual editing.

### Project Structure

```text
.
├── .github/workflows/       # GitHub Actions accessibility workflow
├── assets/
│   ├── img-src/             # canonical source images
│   ├── img/                 # variants generated by the image pipeline
│   ├── fav-icons/           # favicons and web manifest
│   ├── fonts/               # local WOFF2 fonts
│   └── svg/                 # logo, icons, and placeholders
├── css/
│   ├── components/          # interface component styles
│   ├── pages/               # view-specific styles
│   └── main.css             # PostCSS entry point
├── data/                    # products, categories, and travel kits
├── js/
│   ├── modules/             # application feature modules
│   └── app.js               # JavaScript entry point
├── partials/                # shared navigation and footer
├── scripts/                 # build, SEO, preview, and image tooling
├── tests/a11y/              # Playwright + axe audits
├── *.html                   # canonical MPA pages
├── netlify.toml
├── playwright.config.js
└── package.json
```

### Installation

The repository uses npm and includes `package-lock.json`.

```bash
npm ci
```

### Local Development

The complete local preview builds `dist/` and starts a server at `http://127.0.0.1:4173`:

```bash
npm run build:preview
```

Independent watch tasks rebuild only the production CSS or JavaScript in `dist/`; they do not start the server or regenerate HTML:

```bash
npm run watch:css
npm run watch:js
```

### Production Build

```bash
npm run build
```

The build cleans and recreates `dist/`, generates `css/main.min.css` and `js/app.min.js`, copies `assets/` and `data/` while excluding `assets/img-src/`, embeds the partials, creates prerendered detail pages, and generates SEO files.

Image optimization is a separate step and is not run by `npm run build`. After changing files in `assets/img-src/`, recreate `assets/img/` before running the build:

```bash
npm run build:images
npm run build
```

### Testing and Validation

```bash
npm run qa:a11y
```

The Playwright command automatically builds the project, starts the preview, and runs axe scans in Chromium for 11 configured routes, including the home page, catalog, product, cart, checkout, contact, travel kit, and legal pages. The `.github/workflows/accessibility-ci.yml` workflow runs the same audit for pull requests and changes pushed to the `main` branch.

### Deployment

`netlify.toml` sets `npm run build` as the build command and `dist/` as the publish directory. It also defines HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and cache policies for documents, data, and assets.

The contact form uses the `data-netlify="true"` marker and submits `application/x-www-form-urlencoded` data, tying its handling to the Netlify environment.

### Accessibility

The project includes concrete accessibility mechanisms without claiming formal standards compliance:

- skip links and semantic landmarks;
- visible `:focus-visible` styles and `prefers-reduced-motion` handling;
- form labels, error messages, `aria-invalid`, `aria-describedby`, and live regions;
- synchronized `aria-expanded`, `aria-hidden`, `aria-current`, and `aria-pressed` states;
- Escape-key handling in the mobile drawer, plus focus trapping and focus restoration in the mobile drawer and modal;
- automated axe scans configured in Playwright.

### SEO

- Source pages contain titles, descriptions, canonical URLs, Open Graph, Twitter Card, and JSON-LD metadata.
- The `produkt.html` and `komplety.html` templates are marked `noindex`; the build creates indexable, data-driven pages with individual metadata.
- `scripts/seo-config.mjs` defines the public origin and route registry used to generate `robots.txt` and `sitemap.xml`.
- Cart, checkout, and confirmation pages use `noindex`, while public information pages are included in the generated sitemap.

### PWA and Offline Support

`assets/fav-icons/site.webmanifest` defines the application name, `start_url`, scope, `standalone` display mode, icons, shortcuts, and screenshots. However, the repository contains no service worker or service-worker registration, so it does not implement offline caching.

### Performance

- Production CSS is merged and minified by PostCSS, while JavaScript modules are bundled and minified by esbuild as an ES module targeting `es2020`.
- The sharp pipeline creates JPG/PNG, WebP, and AVIF variants from source images.
- Interface images use `<picture>` variants, explicit dimensions, `loading="lazy"`, and `decoding="async"` where implemented by the relevant view.
- Netlify receives separate cache policies for HTML, CSS, JavaScript, data, the manifest, and other assets.

### Data and State Persistence

- Products, categories, and travel kits are static data in `data/*.json`; the application does not use a database or remote catalog API.
- The cart, selected theme, and acceptance of the project demonstration notice are stored locally in the browser; acceptance can fall back to `sessionStorage`.
- Checkout does not persist or transmit an order. The newsletter form does not save a subscription to an external service.
- The contact form is the only form configured to submit data to a hosting service.

### Project Maintenance

- Style changes belong in `css/`, starting from the imports in `css/main.css`; `dist/css/main.min.css` should not be edited manually.
- JavaScript source modules live in `js/`, and the production bundle is generated from `js/app.js`.
- Catalog data belongs in `data/*.json`; product and travel-kit slugs affect prerendered paths and the sitemap.
- `partials/` is the canonical source for shared navigation and footer markup.
- `assets/img-src/` is the image source, while `assets/img/` is generated by the separate sharp pipeline.
- The public origin and indexable route lists are maintained in `scripts/seo-config.mjs`.

### License

The project is available under a [proprietary KP_Code license](LICENSE) and is not open-source software. Public visibility of the repository does not grant permission to copy, modify, deploy, or commercially use the Project.
