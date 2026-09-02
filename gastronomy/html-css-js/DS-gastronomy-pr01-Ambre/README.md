# Ambre

## Polski

### O projekcie

**Ambre** to statyczny, wielostronicowy projekt front-endowy prezentujący restaurację fine dining. Aplikacja została zbudowana bez frameworka: wykorzystuje semantyczny HTML, CSS oraz modułowy JavaScript, który jest bundlowany do pliku produkcyjnego.

Repozytorium zawiera implementację interfejsu, zasoby lokalne, konfigurację PWA, reguły hostingu statycznego oraz skrypty budowania i kontroli jakości. Nie stanowi deklaracji działającego, publicznego wdrożenia.

### Zakres implementacji

- strony: strona główna, menu, galeria, polityka cookies, polityka prywatności, regulamin, strona offline i 404;
- responsywna nawigacja, przełącznik motywu, aktywny stan nawigacji oraz obsługa przewijania;
- filtrowanie pozycji menu i galerii, stopniowe pokazywanie elementów oraz lightbox obsługiwany z klawiatury;
- formularz rezerwacji z walidacją po stronie klienta, ochroną honeypot i natywnym awaryjnym wysłaniem formularza;
- meta dane SEO, canonicale, Open Graph, Twitter Cards i dane strukturalne JSON-LD na stronach indeksowalnych;
- manifest, przycisk instalacji PWA oraz Service Worker z cache aplikacji i obrazów, widokiem offline i obsługą aktualizacji;
- lokalne fonty, grafiki, ikony aplikacji oraz konfiguracja nagłówków bezpieczeństwa i przekierowań dla hostingu statycznego.

### Architektura i pliki źródłowe

Główne pliki HTML są przechowywane w katalogu głównym. Kod źródłowy stylów zaczyna się w `css/style.css`, a punkt wejścia JavaScript znajduje się w `js/script.js`; moduły funkcji są w `js/modules/`, a współdzielony rejestr ikon SVG w `js/icons.js`.

Strony źródłowe używają czytelnych plików `css/style.css` i `js/script.js`. Polecenie `npm run build` tworzy katalog `dist/` z minifikowanymi plikami `css/style.min.css` i `js/script.min.js`, kopią wymaganych plików statycznych oraz stronami HTML przepisanymi na te artefakty produkcyjne.

### Stos technologiczny

- HTML5 i CSS;
- Vanilla JavaScript oraz ES modules;
- PostCSS, Autoprefixer i cssnano dla CSS;
- esbuild dla bundla JavaScript;
- Service Worker i Web App Manifest dla mechanizmów PWA;
- Playwright i axe-core, HTML-Validate, ESLint, Stylelint oraz Lighthouse CI w narzędziach jakości.

### PWA i zachowanie offline

`sw.js` precache’uje strony i kluczowe zasoby aplikacji. Dla nawigacji oraz plików stylów, skryptów i workerów stosuje pobieranie z sieci z awaryjnym odczytem cache; dla obrazów stosuje odczyt z cache z późniejszym pobraniem. Gdy brak jest dokumentu w cache podczas nawigacji offline, używana jest strona `offline.html`.

`manifest.webmanifest` definiuje nazwę aplikacji, ikony, skróty i zrzuty ekranu. Przycisk instalacji jest pokazywany dopiero po otrzymaniu przez przeglądarkę zdarzenia `beforeinstallprompt`.

### Formularz rezerwacji

Formularz w `index.html` ma atrybuty zgodne z przetwarzaniem formularzy Netlify. Skrypt sprawdza wymagane pola, format polskiego numeru telefonu i zgodę, a następnie wysyła dane metodą POST, jeśli dostępne są `fetch` i `FormData`; w razie błędu korzysta z natywnego wysłania formularza.

Odbiór zgłoszeń zależy od konfiguracji środowiska hostującego i nie jest potwierdzany przez sam kod źródłowy tego repozytorium.

### Wymagania i uruchomienie

Projekt zawiera `package-lock.json`, dlatego do odtworzenia zależności użyj:

```bash
npm ci
```

Polecenie `npm run dev` uruchamia lokalny serwer deweloperski z przeładowaniem pod adresem `http://127.0.0.1:4183`. Pliki HTML można też serwować dowolnym innym serwerem statycznym, a skrypty QA uruchamiają własne serwery lokalne tam, gdzie są potrzebne.

### Polecenia

```bash
# uruchom lokalny serwer deweloperski z przeładowaniem
npm run dev

# zbuduj produkcyjny katalog dist z minifikowanymi CSS i JavaScript
npm run build

# lint JavaScriptu, CSS i tekstu
npm run lint

# szybka codzienna kontrola statyczna i integralności projektu
npm run qa:fast

# skupione regresje przeglądarkowe rezerwacji, dialogu, przewijania, tabel prawnych, lightboxa i statusu galerii
npm run test:e2e

# pełna bramka jakości: szybkie QA, no-JS, E2E, a11y i Lighthouse CI
npm run qa
```

Pojedyncze kontrole są dostępne jako `lint:*`, `qa:*` i `test:e2e:*`. `qa:csp` wyłącznie weryfikuje aktualność CSP, a mutujące `csp:hash` świadomie regeneruje hashe. Polecenie `qa:server` sprawdza lokalny serwer statyczny używany przez narzędzia jakości; nie weryfikuje publicznego wdrożenia.

W projekcie są także polecenia `img:opt`, `img:webp`, `img:avif`, `img:clean` i `img:verify` do przygotowania oraz kontroli wariantów obrazów. `img:clean` usuwa katalog wygenerowanych obrazów, więc używaj go świadomie.

### Kontrola jakości

`qa:fast` obejmuje lint JavaScriptu, CSS i tekstu, HTML, linki, SEO, politykę JSON-LD oraz kontrolę CSP bez uruchamiania szerokich testów przeglądarkowych. `test:e2e` uruchamia deterministycznie sześć skupionych regresji. Pełne `qa` rozszerza szybki zestaw o zachowanie bez JavaScriptu, E2E, automatyczne reguły dostępności z axe-core i Lighthouse CI na ośmiu stronach.

Lista poleceń opisuje dostępne kontrole w repozytorium; nie jest zapisem ich wyniku dla konkretnego środowiska lub wdrożenia.

### Hosting i bezpieczeństwo

Pliki `_headers` i `_redirects` dostarczają konfigurację dla hostingu statycznego: przekierowania adresów, stronę 404 oraz nagłówki bezpieczeństwa, w tym Content Security Policy. Nie przesądza to o tym, że konfiguracja została zastosowana przez konkretną usługę hostingową.

### Licencja

Projekt jest objęty własnościową licencją KP_Code. Szczegółowe warunki znajdują się w pliku [LICENSE](LICENSE). Oprogramowanie nie jest udostępniane jako open source.

### Ograniczenia

- Repozytorium zawiera wyłącznie warstwę statycznego front-endu; nie zawiera backendu, bazy danych, autoryzacji ani integracji płatności.
- Działanie formularza w środowisku produkcyjnym, instalacja PWA i zachowanie cache zależą od przeglądarki oraz konfiguracji hostingu i nie są potwierdzane w tym README.
- Dane prezentowane w interfejsie i danych strukturalnych należy zweryfikować przed użyciem w rzeczywistym serwisie operacyjnym.

---

## English

### About the project

**Ambre** is a static, multi-page front-end project presenting a fine-dining restaurant. It is built without a framework, using semantic HTML, CSS, and modular JavaScript bundled into a production asset.

The repository contains the interface implementation, local assets, PWA configuration, static-hosting rules, and build and quality-assurance scripts. It does not assert that a public deployment is currently operating.

### Implemented scope

- pages for the home view, menu, gallery, cookie policy, privacy policy, terms, offline view, and 404 view;
- responsive navigation, theme switching, current navigation state, and scroll controls;
- menu and gallery filtering, progressive item reveal, and a keyboard-operable lightbox;
- a reservation form with client-side validation, a honeypot field, and native submission fallback;
- SEO metadata, canonicals, Open Graph, Twitter Cards, and JSON-LD structured data on indexable pages;
- a manifest, PWA install prompt, and a Service Worker with application and image caches, an offline view, and update handling;
- local fonts, images, application icons, and static-hosting configuration for security headers and redirects.

### Architecture and source files

The main HTML files live in the repository root. The CSS source starts at `css/style.css`, while `js/script.js` is the JavaScript entry point, feature modules live in `js/modules/`, and the shared SVG icon registry lives in `js/icons.js`.

Source pages load the readable `css/style.css` and `js/script.js` files. `npm run build` creates `dist/` with the minified `css/style.min.css` and `js/script.min.js` artifacts, required static files, and HTML rewritten to use the production assets.

### Technology stack

- HTML5 and CSS;
- Vanilla JavaScript and ES modules;
- PostCSS, Autoprefixer, and cssnano for CSS processing;
- esbuild for JavaScript bundling;
- Service Worker and Web App Manifest for PWA mechanisms;
- Playwright and axe-core, HTML-Validate, ESLint, Stylelint, and Lighthouse CI for quality tooling.

### PWA and offline behavior

`sw.js` precaches application pages and key assets. Navigation plus style, script, and worker requests use network retrieval with a cache fallback; image requests use cache retrieval before a network attempt. If no cached document is available during offline navigation, the worker serves `offline.html`.

`manifest.webmanifest` defines the application name, icons, shortcuts, and screenshots. The install control is only shown after the browser emits the `beforeinstallprompt` event.

### Reservation form

The form in `index.html` uses attributes compatible with Netlify Forms processing. Its script validates required fields, the Polish telephone-number format, and consent; it then submits a POST request when `fetch` and `FormData` are available, with native form submission as a fallback.

Receipt of submissions depends on the hosting environment configuration and is not established by this repository's source code alone.

### Requirements and local use

The project includes `package-lock.json`; install the locked dependency set with:

```bash
npm ci
```

`npm run dev` starts a local development server with live reload at `http://127.0.0.1:4183`. The HTML files can also be served by any other static server, while the relevant QA scripts start their own local servers when needed.

### Commands

```bash
# start the local development server with live reload
npm run dev

# build the production dist directory with minified CSS and JavaScript
npm run build

# lint JavaScript, CSS, and public text
npm run lint

# fast everyday static and project-integrity checks
npm run qa:fast

# focused browser regressions for reservations, the dialog, scrolling, legal tables, the lightbox, and gallery status
npm run test:e2e

# full quality gate: fast QA, no-JS, E2E, accessibility, and Lighthouse CI
npm run qa
```

Individual checks are available under `lint:*`, `qa:*`, and `test:e2e:*`. `qa:csp` only verifies the current CSP, while the mutating `csp:hash` command deliberately regenerates hashes. `qa:server` checks the local static server used by quality tooling; it does not verify a public deployment.

The repository also provides `img:opt`, `img:webp`, `img:avif`, `img:clean`, and `img:verify` for generating and checking image variants. `img:clean` removes the generated-image directory, so use it deliberately.

### Quality assurance

`qa:fast` covers JavaScript, CSS, and text linting, HTML, links, SEO, the JSON-LD policy, and read-only CSP verification without launching broad browser checks. `test:e2e` runs the six focused regressions in a deterministic order. The full `qa` command extends the fast set with no-JavaScript behavior, E2E, automated axe-core accessibility rules, and Lighthouse CI across eight pages.

The command list documents checks available in the repository; it does not record their result for a particular environment or deployment.

### Hosting and security

`_headers` and `_redirects` provide static-hosting configuration for route redirects, a 404 page, and security headers including a Content Security Policy. Their presence does not establish that the configuration has been applied by a specific hosting provider.

### License

The project is covered by the proprietary KP_Code license. See [LICENSE](LICENSE) for its full terms. The software is not released as open source.

### Limitations

- The repository contains only the static front-end layer; it does not include a backend, database, authentication, or payment integration.
- Production form delivery, PWA installation, and cache behavior depend on the browser and hosting configuration and are not confirmed by this README.
- Information presented in the interface and structured data should be verified before use in an operational public service.
