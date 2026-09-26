# Atelier No.02

## PL

### Przegląd projektu

Atelier No.02 to demonstracyjna, wielostronicowa witryna fikcyjnej restauracji fine dining, opracowana przez KP_Code Digital Studio. Statyczne strony HTML są uzupełniane modułami JavaScript i wspólnym arkuszem CSS.

Projekt obejmuje stronę główną, informacje o restauracji, menu, galerię, kontakt, strony prawne oraz widoki offline, potwierdzenia formularza i 404. Nie zawiera systemu rezerwacji ani własnego backendu; formularz kontaktowy jest skonfigurowany do obsługi przez Netlify Forms.

### Wersja online

[Witryna produkcyjna](https://gastronomy-pr02-atelier.netlify.app/) jest publikowana ręcznie na Netlify przez właściciela projektu. Wdrożona wersja może być starsza niż bieżący stan repozytorium.

### Kluczowe funkcje

- Menu renderowane z `data/menu.json`, wyszukiwanie tekstowe i filtrowanie po tagach; statyczne karty pozostają dostępne bez JavaScript lub po nieudanym pobraniu danych.
- Galeria z grupowanym lightboxem, podpisami, licznikiem, nawigacją klawiaturą i gestami oraz trybem pełnoekranowym.
- Nawigacja z rozwijanymi sekcjami i mobilnym panelem z obsługą fokusa.
- Motywy jasny i ciemny, preferencja systemowa oraz lokalny zapis wyboru użytkownika.
- Formularz kontaktowy z natywnym POST, honeypotem, walidacją pól i komunikatem trwającej wysyłki. JavaScript nie symuluje udanej dostawy; rzeczywisty odbiór przez Netlify nie został sprawdzony.
- Komunikaty online/offline i zamykana informacja o demonstracyjnym charakterze serwisu.

### Stack technologiczny

- **Interfejs:** HTML5, modułowy CSS, Vanilla JavaScript z ES Modules; lokalne fonty WOFF2.
- **Build:** Node.js i npm, PostCSS z `postcss-import` i `cssnano`, esbuild.
- **Obrazy:** Sharp i `fast-glob` do generowania wariantów AVIF, WebP i JPEG/PNG oraz kopiowania SVG.
- **Walidacja i development:** ESLint, html-validate, linkinator, pa11y-ci, http-server i lokalny runner Node.js.

### Architektura

Każda podstrona ma własny szablon HTML w katalogu głównym. Wspólny nagłówek i stopka istnieją wyłącznie w `partials/header.html` i `partials/footer.html`; szablony wskazują je całowierszowymi znacznikami `<!-- partial:header -->` i `<!-- partial:footer -->`. Funkcja `composeHtml()` w `scripts/build-config.js` wstawia partiale, zanim strona trafi do przeglądarki: serwer deweloperski w pamięci przy każdym żądaniu, a build przed zapisem do `dist/`. Przeglądarka zawsze otrzymuje więc kompletny statyczny dokument, także bez JavaScript. `js/script.js` uruchamia `js/app/init.js`, który rozdziela inicjalizatory wspólne i funkcje stron według `data-page`. `js/core.js` jest mniejszym wejściem używanym przez strony prawne i stronę 404.

`css/style.css` importuje warstwy `base`, `layout`, `components` i `pages`. Źródłowy HTML ładuje zwykły CSS i wejścia ES Modules. PostCSS oraz esbuild zapisują bundle `.min.css` i `.min.js` wyłącznie w `dist/`; build przekształca odwołania w złożonych kopiach HTML. Osobny `js/bootstrap.js` synchronizuje kolor motywu i rejestruje Service Workera.

### Struktura projektu

```text
./
├── .github/
│   └── workflows/
│       └── quality.yml     # workflow CI: kontrole źródeł i paczki
├── index.html
├── about.html
├── menu.html
├── gallery.html
├── contact.html
├── cookies.html
├── polityka-prywatnosci.html
├── regulamin.html
├── offline.html
├── thank-you.html
├── 404.html
├── partials/               # jedyne źródło wspólnego nagłówka i stopki
│   ├── header.html
│   └── footer.html
├── css/                    # wyłącznie źródła CSS
├── js/                     # źródła: wejścia, bootstrap, app/, core/, features/
├── data/menu.json
├── assets/
│   ├── img-src/            # źródła obrazów
│   ├── img-optimized/      # wygenerowane warianty
│   ├── fonts/
│   ├── icons/
│   └── docs/menu.pdf
├── scripts/
│   ├── build-config.js
│   ├── build-dist.js
│   ├── validate-dist.js
│   ├── dev-server.js
│   ├── qa-html.js
│   ├── qa-links.js
│   ├── qa-server.js
│   └── images/build-images.js
├── docs/
│   ├── archive/            # zarchiwizowane dokumenty projektu
│   │   ├── audits/
│   │   │   ├── AUDIT-2026-09-23.md
│   │   │   └── daily-AUDIT-2026-09-19.md
│   │   ├── improvements/   # zakończone analizy i usprawnienia UI, QUALITY, UX
│   │   │   ├── IMPROVEMENTS-UI-2026-09-24.md
│   │   │   ├── IMPROVEMENTS-QUALITY-2026-09-25.md
│   │   │   └── IMPROVEMENTS-UX-2026-09-26.md
│   │   └── plans/
│   │       ├── PLAN-2026-09-19.md
│   │       └── PLAN-2026-09-23.md
│   ├── CHANGELOG.md        # zapis znaczących zmian
│   ├── CONTEXT-PROJECT.md  # techniczny kontekst projektu
│   └── settings.md         # opis skryptów npm i workflow
├── dist/                   # generated production package (ignored)
├── manifest.webmanifest
├── sw.js
├── robots.txt
├── sitemap.xml
├── _headers
├── _redirects
├── package.json
├── package-lock.json
├── AGENTS.md               # lokalne instrukcje pracy agenta
└── LICENSE
```

### Instalacja

Wymagane są Node.js i npm. Zalecany jest Node.js 22, zgodnie z konfiguracją CI; zależności z `package-lock.json` mają własne wymagania wersji Node.js. Projekt nie przypina dokładnej lokalnej wersji Node.js ani nie deklaruje pola `engines` w `package.json`.

```bash
npm ci
```

Szczegółowy opis poleceń, ich wymagań i ograniczeń jest utrzymywany w [dokumentacji operacyjnej](docs/settings.md); wykonywalne definicje pozostają w `package.json` oraz wskazanych tam skryptach i konfiguracjach.

### Development lokalny

`npm run dev` serwuje źródła i składa strony z szablonów i partiali w pamięci; build produkcyjny nie jest potrzebny. Po zmianie szablonu, partiala, CSS lub JS odśwież stronę — serwer nie zapisuje plików ani nie obserwuje zmian. Szablon otwarty bezpośrednio z dysku nie zawiera nagłówka ani stopki. Szczegóły tras i obsługi błędów opisuje [referencja dev](docs/settings.md#dev).

```bash
npm run dev
```

Serwis można otworzyć pod `http://127.0.0.1:5173`. Serwer wyłącza cache HTTP. Rejestracja Service Workera jest celowo pomijana na `localhost`, `127.0.0.1` i `::1`.

### Build produkcyjny

```bash
npm run build
npm run preview
```

Build odtwarza `dist/` ze złożonymi stronami, zasobami runtime, konfiguracją hostingu i produkcyjnymi CSS/JS, a następnie sprawdza kompletność wyniku. Preview wymaga wcześniejszego builda i udostępnia wyłącznie `dist/` na porcie 5173; zatrzymaj dev przed preview. Build nie generuje obrazów ani nie kopiuje `assets/img-src/`. Zoptymalizowane obrazy pozostają śledzone w Git; minifikowane CSS/JS i cały `dist/` są ignorowanym wynikiem builda. Etapy i zachowanie przy błędach opisuje [referencja builda](docs/settings.md#build).

Paczka zawiera `css/style.min.css`, `js/script.min.js`, `js/core.min.js` i niezmieniony skrypt runtime `js/bootstrap.js`. Nie zawiera modułów źródłowych CSS/JS, szablonów, partiali ani narzędzi developerskich. Kanoniczne są szablony stron w katalogu głównym i partiale w `partials/`; osobne ręcznie edytowane wersje produkcyjne nie istnieją.

Po zmianie źródeł obrazów dostępny jest osobny workflow:

```bash
npm run images:build
```

Generator zastępuje zawartość `assets/img-optimized/`, zapisując warianty odpowiadające źródłom w `assets/img-src/`.

### Testy i walidacja

Skonfigurowane kontrole obejmują:

| Polecenie | Zakres |
| --- | --- |
| `npm run qa` | Pełne QA źródeł: lint, kontrakty, HTML, linki i dostępność; samo uruchamia serwer dev. |
| `npm run qa:dist` | QA istniejącego `dist/`: integralność, HTML, linki i dostępność; samo uruchamia preview. Najpierw uruchom build. |
| `npm run qa:links` | Lokalne linki i zasoby; wymaga działającego dev albo preview. |
| `npm run qa:a11y` | Audyt dostępności pa11y-ci według `.pa11yci`; wymaga działającego dev albo preview. |
| `npm run qa:links:external` | Opcjonalna kontrola także zewnętrznych linków na działającym serwerze. |

QA źródeł nie buduje produkcji; QA dist sprawdza przygotowaną paczkę i nie przebudowuje jej. Przed `npm run qa` lub `npm run qa:dist` zatrzymaj ręczny serwer, aby port 5173 był wolny. Bezpośrednie kontrole z tabeli wymagają natomiast działającego dev albo preview pod `http://127.0.0.1:5173`.

Do pojedynczych kontroli, które same uruchamiają serwer, używaj [`npm run qa:server`](docs/settings.md#qaserver) lub — po buildzie — [`npm run qa:dist:server`](docs/settings.md#qadistserver); port 5173 również musi być wolny. Referencja zawiera przykłady selektorów `--check=links` i `--check=a11y`; wybrana kontrola nie zastępuje pełnego QA. Znajdziesz tam również [opis diagnostyki HTML ze wskazaniem źródła](docs/settings.md#qahtml) oraz [zakres i ograniczenia scenariuszy dostępności](docs/settings.md#qaa11y). Są to skonfigurowane kontrole, nie potwierdzenie ich wykonania; automatyczny audyt nie potwierdza pełnej zgodności WCAG ani wszystkich stanów formularza.

### Ciągła integracja

Repozytorium zawiera jeden workflow GitHub Actions: [`.github/workflows/quality.yml`](.github/workflows/quality.yml). Uruchamia się przy push do `main`, przy pull requeście kierowanym do `main` oraz ręcznie przez `workflow_dispatch`.

Zadanie działa na `ubuntu-latest`: pobiera repozytorium, konfiguruje Node.js 22 z cache zależności npm, a następnie wykonuje kolejno:

1. `npm ci` — instalacja zależności z pliku lock.
2. `npm run qa` — kontrole źródeł.
3. `npm run build` — build paczki produkcyjnej.
4. `npm run qa:dist` — walidacja zbudowanej paczki.

Workflow wyłącznie weryfikuje projekt i zbudowaną paczkę. Nie publikuje ani nie wdraża witryny; opisane niżej wdrożenie na Netlify pozostaje poza tym procesem.

### Wdrożenie

Repozytorium przygotowuje statyczną paczkę `dist/` oraz pliki `_headers` i `_redirects` w formacie Netlify. Reguły określają nagłówki, cache i odpowiedź 404. Ścieżki manifestu, Service Workera i metadanych zakładają publikację w katalogu głównym domeny. Przed wdrożeniem wykonaj `npm run build`, a następnie opublikuj wyłącznie `dist/` ze złożonymi stronami, ręcznie przez Netlify CLI; szablony z katalogu głównego zawierają znaczniki partiali i nie są kompletnymi stronami. Zobacz też [wymagania operacyjne publikacji](docs/settings.md#ci-i-ręczne-wdrożenie).

Formularz w `contact.html` ma oznaczenia Netlify Forms, ukryte pole `form-name`, honeypot i przekierowanie do `thank-you.html`. Obsługa zgłoszeń zależy od konfiguracji hostingu; lokalny serwer nie potwierdza ich dostawy. Strona kontaktowa zawiera również bezpośrednio osadzoną mapę Google Maps.

### Dostępność

Implementacja obejmuje semantyczne landmarki, skip linki, etykiety pól i widoczny fokus. Mobilna nawigacja, lightbox i okno informacji demo zarządzają fokusem oraz obsługują klawiaturę. Walidacja aktualizuje `aria-invalid`, a komunikaty stanu korzystają z regionów `aria-live`.

Animacje uwzględniają `prefers-reduced-motion`; moduł reveal pokazuje treść od razu także przy braku `IntersectionObserver`. Te mechanizmy i konfiguracja pa11y-ci nie stanowią potwierdzenia zgodności całego serwisu z WCAG.

### SEO

Każda strona zawiera tytuł i opis. Osiem stron treściowych zawiera także linki canonical, metadane Open Graph i Twitter Cards oraz JSON-LD, m.in. `Organization` i `Restaurant`. Strony systemowe mają węższy zakres: `404.html` nie zawiera canonical, Open Graph, Twitter Cards ani JSON-LD; `offline.html` zawiera canonical i Open Graph, ale nie Twitter Cards ani JSON-LD; `thank-you.html` zawiera canonical, ale nie Open Graph, Twitter Cards ani JSON-LD. Repozytorium zawiera również `robots.txt` i `sitemap.xml`. Dane restauracji opisują fikcyjną markę demonstracyjną; obecność metadanych nie potwierdza indeksacji ani pozycji w wyszukiwarkach.

### PWA i obsługa offline

`manifest.webmanifest` definiuje widok `standalone`, `start_url` i `scope` ustawione na `/`, ikony 192/512 px, zrzuty ekranu oraz skróty do menu, galerii i kontaktu. Źródłem Service Workera jest ręcznie utrzymywany `sw.js` z odwołaniami źródłowymi; build przekształca wyłącznie ścieżki CSS/JS w jego kopii w `dist/`. Precache obejmuje oba bundle oraz bootstrap.

Nazwa cache workera ma postać `atelierno02-v${CACHE_VERSION}`, gdzie `CACHE_VERSION` jest utrzymywane w `sw.js`. Wybrane strony i zasoby są precache'owane; nawigacja korzysta z sieci, następnie zapisanej strony lub `offline.html`. Pozostałe żądania GET korzystają najpierw z cache. Podczas aktywacji worker usuwa cache o innych nazwach.

Obsługa offline zależy od udanej rejestracji, instalacji i dostępnych zasobów cache; żądania POST formularza nie są obsługiwane przez worker. W izolowanym lokalnym Chrome sprawdzono ręczną rejestrację produkcyjnego workera, wszystkie 19 wpisów precache, działanie strony prawnej i motywu offline oraz fallback nawigacji. Instalowalności PWA ani wdrożonej witryny nie zweryfikowano.

### Wydajność

Skonfigurowano minifikację CSS i bundling/minifikację JS. Obrazy korzystają z `picture`, `srcset`, AVIF/WebP, wymiarów i selektywnego `loading="lazy"`. Strona główna preloaduje fonty i obraz hero, a deklaracje fontów używają `font-display: swap`. Nie podano wyników Lighthouse ani Core Web Vitals.

### Dane i trwałość stanu

`data/menu.json` zawiera statyczne pozycje menu, kategorie, opisy, ceny, tagi i warianty obrazów. Stan wyszukiwania i filtrów jest utrzymywany w pamięci strony.

`localStorage` przechowuje motyw pod `kp-theme` i potwierdzenie informacji demo pod `kp-demo-accepted`; odczytywany jest także starszy klucz `kp_demo_legal_ack`. Dostęp do storage jest zabezpieczony `try/catch`. Potwierdzenie demo nie jest zgodą na cookies. Cache Storage przechowuje zasoby witryny; projekt nie implementuje kont ani synchronizacji między urządzeniami.

### Utrzymanie projektu

- Edytuj źródła CSS i moduły JS; przed preview lub wydaniem uruchom `npm run build`; nie poprawiaj ręcznie plików `.min.css` i `.min.js`.
- Wspólny nagłówek i stopkę edytuj wyłącznie w `partials/header.html` i `partials/footer.html`. Każdy szablon strony zawiera dokładnie jeden znacznik `<!-- partial:header -->` i jeden `<!-- partial:footer -->`; brakujący, powtórzony lub nieznany znacznik oraz wklejony blok nagłówka lub stopki przerywają QA i build.
- Utrzymuj dane w `data/menu.json` oraz statyczne karty HTML pełniące rolę fallbacku.
- Zmiany stron i publicznych zasobów zestawiaj z listami w `scripts/build-config.js`, `sw.js`, `manifest.webmanifest` i `sitemap.xml`.
- Po zmianach zasobów cache aktualizuj `CACHE_VERSION` w `sw.js`. Wydanie zmieniające zawartość precache wymaga także nowego `PRECACHE_FINGERPRINT`; build odrzuca niezgodny fingerprint. [Sposób obliczania, postępowanie przy błędzie i ograniczenia kontroli](docs/settings.md#qadistintegrity) są opisane w referencji operacyjnej.
- [CHANGELOG.md](docs/CHANGELOG.md) jest zapisem znaczących ukończonych zmian; aktualizuj go, gdy zakres zadania na to pozwala, lub zgłoś potrzebę wpisu.
- [Zakończony plan rozwoju z 2026-09-23](docs/archive/plans/PLAN-2026-09-23.md), który zastąpił plan z 2026-09-19, zachowuje ukończone zadania i warunki ich ukończenia; jest dokumentem archiwalnym, a nie aktywną listą zadań.
- [Audyt techniczny z 2026-09-23](docs/archive/audits/AUDIT-2026-09-23.md) zachowuje uzgodnione ustalenia techniczne i statusy ich rozwiązania; jest dokumentem archiwalnym.
- [Zakończony plan rozwoju z 2026-09-19](docs/archive/plans/PLAN-2026-09-19.md) zachowuje ukończony plan wdrożenia wraz z zapisem weryfikacji; jest dokumentem archiwalnym, a nie aktywną listą zadań.
- [Zamknięty audyt frontendowy z 2026-09-19](docs/archive/audits/daily-AUDIT-2026-09-19.md) zachowuje historyczne ustalenia audytu i statusy ich rozwiązania.
- Raporty [UI](docs/archive/improvements/IMPROVEMENTS-UI-2026-09-24.md), [QUALITY](docs/archive/improvements/IMPROVEMENTS-QUALITY-2026-09-25.md) i [UX](docs/archive/improvements/IMPROVEMENTS-UX-2026-09-26.md) w `docs/archive/improvements/` zachowują analizy, ukończone usprawnienia i zapisane ograniczenia weryfikacji.

### Licencja

Atelier No.02 jest projektem własnościowym objętym [Własnościową Licencją Projektu KP_CODE, wersja 1.0](LICENSE), z prawami zastrzeżonymi przez Kamila Króla — KP_Code. Publiczne udostępnienie nie oznacza licencji open source. Materiały podmiotów trzecich podlegają własnym warunkom.

### Atrybucje

Siedem ikon SVG w `assets/icons/svg-icon/` zawiera informacje o Font Awesome Free 7.1.0, m.in. [ikona GitHub](assets/icons/svg-icon/github-icon.svg). Zachowaj zawarte w plikach informacje o autorstwie i licencji.

## EN

### Project Overview

Atelier No.02 is a multi-page demonstration website for a fictional fine dining restaurant, developed by KP_Code Digital Studio. Static HTML pages are enhanced with JavaScript modules and a shared CSS stylesheet.

The project includes a homepage, restaurant information, menu, gallery, contact, legal pages, and offline, form confirmation and 404 views. It has no booking system or custom backend; the contact form is configured for Netlify Forms handling.

### Live Version

[The production website](https://gastronomy-pr02-atelier.netlify.app/) is published manually to Netlify by the project owner. The deployed version may be older than the current state of the repository.

### Key Features

- Menu rendered from `data/menu.json`, text search and tag filters; static cards remain available without JavaScript or when data fetching fails.
- Gallery with grouped lightboxes, captions, counters, keyboard and gesture navigation, and fullscreen mode.
- Navigation with dropdown sections and a mobile panel with focus handling.
- Light and dark themes, system preference support and browser-local persistence of the user's choice.
- Contact form with native POST, a honeypot, field validation and submission progress feedback. JavaScript does not simulate successful delivery; actual Netlify receipt has not been checked.
- Online/offline notices and a dismissible notice explaining the demonstration scope.

### Tech Stack

- **Interface:** HTML5, modular CSS, Vanilla JavaScript with ES Modules; local WOFF2 fonts.
- **Build:** Node.js and npm, PostCSS with `postcss-import` and `cssnano`, esbuild.
- **Images:** Sharp and `fast-glob` for AVIF, WebP and JPEG/PNG generation and SVG copying.
- **Validation and development:** ESLint, html-validate, linkinator, pa11y-ci, http-server and a local Node.js runner.

### Architecture

Each page has its own HTML template at the repository root. The shared header and footer exist only in `partials/header.html` and `partials/footer.html`; templates reference them with the whole-line markers `<!-- partial:header -->` and `<!-- partial:footer -->`. `composeHtml()` in `scripts/build-config.js` inserts the partials before a page reaches the browser: the development server does so in memory on every request, the build before writing `dist/`. The browser therefore always receives a complete static document, including without JavaScript. `js/script.js` runs `js/app/init.js`, which separates common initializers and page features using `data-page`. `js/core.js` is a smaller entry point used by legal pages and the 404 page.

`css/style.css` imports the `base`, `layout`, `components` and `pages` layers. Source HTML loads ordinary CSS and ES Module entry points. PostCSS and esbuild write `.min.css` and `.min.js` bundles only into `dist/`; the build transforms references in the composed HTML copies. The separate `js/bootstrap.js` synchronizes the theme color and registers the Service Worker.

### Project Structure

```text
./
├── .github/
│   └── workflows/
│       └── quality.yml     # CI workflow: source and package checks
├── index.html
├── about.html
├── menu.html
├── gallery.html
├── contact.html
├── cookies.html
├── polityka-prywatnosci.html
├── regulamin.html
├── offline.html
├── thank-you.html
├── 404.html
├── partials/               # sole source of the shared header and footer
│   ├── header.html
│   └── footer.html
├── css/                    # CSS sources only
├── js/                     # sources: entries, bootstrap, app/, core/, features/
├── data/menu.json
├── assets/
│   ├── img-src/            # image sources
│   ├── img-optimized/      # generated variants
│   ├── fonts/
│   ├── icons/
│   └── docs/menu.pdf
├── scripts/
│   ├── build-config.js
│   ├── build-dist.js
│   ├── validate-dist.js
│   ├── dev-server.js
│   ├── qa-html.js
│   ├── qa-links.js
│   ├── qa-server.js
│   └── images/build-images.js
├── docs/
│   ├── archive/            # archived project documents
│   │   ├── audits/
│   │   │   ├── AUDIT-2026-09-23.md
│   │   │   └── daily-AUDIT-2026-09-19.md
│   │   ├── improvements/   # completed UI, QUALITY and UX reviews and improvements
│   │   │   ├── IMPROVEMENTS-UI-2026-09-24.md
│   │   │   ├── IMPROVEMENTS-QUALITY-2026-09-25.md
│   │   │   └── IMPROVEMENTS-UX-2026-09-26.md
│   │   └── plans/
│   │       ├── PLAN-2026-09-19.md
│   │       └── PLAN-2026-09-23.md
│   ├── CHANGELOG.md        # record of significant changes
│   ├── CONTEXT-PROJECT.md  # technical project context
│   └── settings.md         # npm scripts and workflow reference
├── dist/                   # generated production package (ignored)
├── manifest.webmanifest
├── sw.js
├── robots.txt
├── sitemap.xml
├── _headers
├── _redirects
├── package.json
├── package-lock.json
├── AGENTS.md               # local agent instructions
└── LICENSE
```

### Installation

Node.js and npm are required. Node.js 22 is recommended to match CI; dependencies in `package-lock.json` have their own Node.js version requirements. The project does not pin an exact local Node.js version or declare an `engines` field in `package.json`.

```bash
npm ci
```

Detailed command behavior, prerequisites and limitations are maintained in the [operational reference](docs/settings.md); executable definitions remain in `package.json` and the scripts and configuration it references.

### Local Development

`npm run dev` serves sources and composes pages from templates and partials in memory; no production build is needed. Reload the page after changing a template, partial, CSS or JS — the server writes no files and does not watch for changes. A template opened directly from disk has no header or footer. Route and error-handling details are in the [dev reference](docs/settings.md#dev).

```bash
npm run dev
```

Open the website at `http://127.0.0.1:5173`. The server disables HTTP caching. Service Worker registration is deliberately skipped on `localhost`, `127.0.0.1` and `::1`.

### Production Build

```bash
npm run build
npm run preview
```

Build recreates `dist/` with composed pages, runtime assets, hosting configuration and production CSS/JS, then checks output integrity. Preview requires a prior build and serves only `dist/` on port 5173; stop dev before preview. Build does not generate images or copy `assets/img-src/`. Optimized images remain tracked in Git; minified CSS/JS and the entire `dist/` are ignored build output. Stages and failure behavior are described in the [build reference](docs/settings.md#build).

The package includes `css/style.min.css`, `js/script.min.js`, `js/core.min.js` and the unchanged runtime script `js/bootstrap.js`. It excludes CSS/JS source modules, templates, partials and development tools. The root page templates and `partials/` are canonical; no separate manually edited production pages are maintained.

A separate workflow is available after changing image sources:

```bash
npm run images:build
```

The generator replaces the contents of `assets/img-optimized/`, writing variants corresponding to sources in `assets/img-src/`.

### Testing and Validation

Configured checks include:

| Command | Scope |
| --- | --- |
| `npm run qa` | Full source QA: lint, contracts, HTML, links and accessibility; starts its own dev server. |
| `npm run qa:dist` | QA of existing `dist/`: integrity, HTML, links and accessibility; starts its own preview server. Run build first. |
| `npm run qa:links` | Local links and resources; requires a running dev or preview server. |
| `npm run qa:a11y` | pa11y-ci accessibility audit configured in `.pa11yci`; requires a running dev or preview server. |
| `npm run qa:links:external` | Optional external link checking against a running server. |

Source QA does not build production; dist QA checks the prepared package without rebuilding it. Stop any manual server before `npm run qa` or `npm run qa:dist` so port 5173 is free. The direct checks in the table instead require dev or preview running at `http://127.0.0.1:5173`.

For individual checks that manage their own server, use [`npm run qa:server`](docs/settings.md#qaserver) or — after building — [`npm run qa:dist:server`](docs/settings.md#qadistserver); port 5173 must also be free. The reference includes `--check=links` and `--check=a11y` examples; a selected check does not replace full QA. It also documents [HTML diagnostics with source locations](docs/settings.md#qahtml) and [accessibility scenarios and their limitations](docs/settings.md#qaa11y). These are configured checks, not evidence that they have run; automated auditing does not establish full WCAG compliance or cover every form state.

### Continuous Integration

The repository contains one GitHub Actions workflow: [`.github/workflows/quality.yml`](.github/workflows/quality.yml). It runs on pushes to `main`, on pull requests targeting `main`, and manually through `workflow_dispatch`.

The job runs on `ubuntu-latest`: it checks out the repository, sets up Node.js 22 with npm dependency caching, and then runs in order:

1. `npm ci` — install locked dependencies.
2. `npm run qa` — source quality checks.
3. `npm run build` — production package build.
4. `npm run qa:dist` — validation of the built package.

The workflow only validates the project and the built package. It does not publish or deploy the website; the Netlify deployment described below remains outside this process.

### Deployment

The repository prepares a static `dist/` package and `_headers` and `_redirects` files in Netlify format. Rules define headers, caching and the 404 response. Manifest, Service Worker and metadata paths assume deployment at the domain root. Before deployment, run `npm run build`, then publish only `dist/`, which holds the composed pages, manually through Netlify CLI; the root templates carry partial markers and are not complete pages. See also the [operational deployment requirements](docs/settings.md#ci-i-ręczne-wdrożenie).

The form in `contact.html` has Netlify Forms attributes, a hidden `form-name` field, a honeypot and a redirect to `thank-you.html`. Submission handling depends on hosting configuration; the local server does not confirm delivery. The contact page also contains a directly embedded Google Maps iframe.

### Accessibility

The implementation includes semantic landmarks, skip links, field labels and visible focus states. Mobile navigation, lightboxes and the demo notice dialog manage focus and keyboard interaction. Validation updates `aria-invalid`, and status messages use `aria-live` regions.

Animations account for `prefers-reduced-motion`; the reveal module also exposes content immediately when `IntersectionObserver` is unavailable. These mechanisms and the pa11y-ci configuration do not confirm WCAG compliance across the website.

### SEO

Every page includes a title and description. The eight content pages also include canonical links, Open Graph and Twitter Cards metadata, and JSON-LD such as `Organization` and `Restaurant`. System pages have narrower coverage: `404.html` has no canonical, Open Graph, Twitter Cards or JSON-LD; `offline.html` has canonical and Open Graph, but no Twitter Cards or JSON-LD; `thank-you.html` has canonical, but no Open Graph, Twitter Cards or JSON-LD. The repository also contains `robots.txt` and `sitemap.xml`. Restaurant data describes a fictional demonstration brand; metadata does not confirm indexing or search rankings.

### PWA and Offline Support

`manifest.webmanifest` defines `standalone` display, `start_url` and `scope` set to `/`, 192/512 px icons, screenshots and menu, gallery and contact shortcuts. The Service Worker source is the manually maintained `sw.js` with source references; the build transforms only CSS/JS paths in its `dist/` copy. Precache includes both bundles and bootstrap.

The worker's cache name follows `atelierno02-v${CACHE_VERSION}`, with `CACHE_VERSION` maintained in `sw.js`. Selected pages and assets are precached; navigation tries the network, then a saved page or `offline.html`. Other GET requests try the cache first. During activation, the worker removes caches with other names.

Offline support depends on successful registration, installation and available cached resources; form POST requests are not handled by the worker. An isolated local Chrome test verified manual production worker registration, all 19 precache entries, offline legal-page and theme behavior, and the navigation fallback. PWA installability and the deployed website were not verified.

### Performance

CSS minification and JS bundling/minification are configured. Images use `picture`, `srcset`, AVIF/WebP, dimensions and selective `loading="lazy"`. The homepage preloads fonts and the hero image, and font declarations use `font-display: swap`. No Lighthouse or Core Web Vitals results are reported.

### Data and State Persistence

`data/menu.json` contains static menu items, categories, descriptions, prices, tags and image variants. Search and filter state is kept in page memory.

`localStorage` stores the theme under `kp-theme` and demo acknowledgement under `kp-demo-accepted`; the legacy `kp_demo_legal_ack` key is also read. Storage access is guarded with `try/catch`. Demo acknowledgement is not cookie consent. Cache Storage holds website resources; the project does not implement accounts or synchronization across devices.

### Project Maintenance

- Edit CSS sources and JS modules; run `npm run build` before preview or release; do not manually patch `.min.css` and `.min.js` files.
- Edit the shared header and footer only in `partials/header.html` and `partials/footer.html`. Every page template contains exactly one `<!-- partial:header -->` and one `<!-- partial:footer -->` marker; a missing, repeated or unknown marker and a pasted header or footer block stop QA and the build.
- Maintain `data/menu.json` and the static HTML cards used as fallback content.
- Check page and public asset changes against the lists in `scripts/build-config.js`, `sw.js`, `manifest.webmanifest` and `sitemap.xml`.
- Update `CACHE_VERSION` in `sw.js` when cached resources change. A release that changes precached content also needs a new `PRECACHE_FINGERPRINT`; the build rejects a mismatched fingerprint. The operational reference describes [calculation, failure handling and check limitations](docs/settings.md#qadistintegrity).
- [CHANGELOG.md](docs/CHANGELOG.md) records significant completed changes; update it when task scope permits, or report that an entry is needed.
- [Completed development plan of 2026-09-23](docs/archive/plans/PLAN-2026-09-23.md), which superseded the 2026-09-19 plan, preserves the completed tasks and their completion conditions; it is an archived document, not an active task list.
- [Technical audit of 2026-09-23](docs/archive/audits/AUDIT-2026-09-23.md) preserves the reconciled technical findings and their resolution statuses; it is an archived document.
- [Completed development plan of 2026-09-19](docs/archive/plans/PLAN-2026-09-19.md) preserves the finished implementation plan together with its verification record; it is an archived document, not an active task list.
- [Resolved frontend audit of 2026-09-19](docs/archive/audits/daily-AUDIT-2026-09-19.md) preserves the historical audit findings and their resolution statuses.
- The [UI](docs/archive/improvements/IMPROVEMENTS-UI-2026-09-24.md), [QUALITY](docs/archive/improvements/IMPROVEMENTS-QUALITY-2026-09-25.md) and [UX](docs/archive/improvements/IMPROVEMENTS-UX-2026-09-26.md) reports in `docs/archive/improvements/` preserve the analyses, completed improvements and recorded verification limitations.

### License

Atelier No.02 is a proprietary project governed by the [KP_CODE Proprietary Project License, version 1.0](LICENSE), with rights reserved by Kamil Król — KP_Code. Public availability does not grant an open source license. Third-party materials remain subject to their own terms.

### Attributions

Seven SVG icons in `assets/icons/svg-icon/` contain Font Awesome Free 7.1.0 notices, including the [GitHub icon](assets/icons/svg-icon/github-icon.svg). Preserve the attribution and license information included in these files.
