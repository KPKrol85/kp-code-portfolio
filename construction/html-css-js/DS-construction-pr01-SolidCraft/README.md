# SolidCraft

## PL

### Przegląd projektu

SolidCraft to statyczny, wielostronicowy serwis WWW firmy remontowo-budowlanej, zbudowany w oparciu o HTML, CSS i JavaScript, bez frameworka frontendowego. Repozytorium zawiera stronę główną, sześć podstron usług w `oferta/`, trzy strony dokumentów w katalogu głównym (`regulamin.html`, `polityka-prywatnosci.html`, `cookies.html`) oraz strony `thank-you.html`, `404.html` i `offline.html`. Językiem interfejsu jest polski (`lang="pl"`).

Serwis ma charakter demonstracyjny i jest tak oznaczony w treści: modal na pierwszej wizycie wskazuje KP_Code Digital Studio jako autora przykładowej realizacji, a sekcje z logotypami klientów i opiniami są opisane jako przykładowe. Repozytorium nie zawiera backendu ani bazy danych; warstwa serwerowa ogranicza się do konfiguracji hostingu statycznego.

Współdzielony nagłówek i stopka mają jedno źródło w `partials/` i są rozwijane do pełnych dokumentów HTML na etapie buildu — w przeglądarce nie zachodzi żadne składanie stron.

### Wersja online

Adres skonfigurowany jako `homepage` w `package.json` oraz jako adres kanoniczny stron: <https://construction-pr01-solidcraft.netlify.app/>

### Kluczowe funkcje

- Wielostronicowa nawigacja ze wspólnym nagłówkiem z `partials/header.html`: rozwijane podmenu oferty, wersja mobilna (`aria-expanded`, obsługa klawiatury) i podświetlanie aktywnej sekcji (scroll spy).
- Formularz kontaktowy z `novalidate` i własną warstwą walidacji: maska i weryfikacja polskiego numeru telefonu, komunikaty błędów powiązane przez `aria-describedby`, `aria-invalid` oraz obszar statusu `role="status"`.
- Ochrona antyspamowa formularza: ukryte pole honeypot (`bot-field`), odrzucenie zgłoszeń wysłanych w mniej niż 2 sekundy z zachowaniem wpisanych danych, heurystyka treści i limit czasu wysyłki 10 s.
- Lightbox dla kart oferty i galerii realizacji: `role="dialog"`, `aria-modal`, obsługa Enter/Spacji, Escape, strzałek, pułapka fokusa i przywrócenie fokusa do elementu wywołującego.
- Przełącznik motywu jasny/ciemny z rozstrzygnięciem motywu przed renderem (`js/theme-init.js`) i zapisem preferencji w `localStorage`.
- Modal informacyjny o demonstracyjnym charakterze serwisu: pułapka fokusa, obsługa Escape, blokada przewijania i praca również przy niedostępnym `localStorage`.
- Mapa Google osadzana dopiero po zgodzie użytkownika, z zapamiętaniem decyzji w `localStorage`.
- Wspólny rejestr ikon SVG (`js/modules/icons.js`) — 13 kluczy `[data-icon]` podstawianych w czasie działania, bez plików ikon w `assets/`.
- Rejestracja Service Workera, precache powłoki aplikacji i strona zastępcza `offline.html`.
- Prefetch podstron oferty przy najechaniu lub fokusie, wyłączany przy `Save-Data` i wolnych połączeniach.

### Stack technologiczny

**Runtime (frontend)**

- HTML5 z buildowym rendererem partiali (`@layout`, `@include`, `{{token}}`, `{{#if}}`)
- CSS3 — moduły w `css/modules/` scalane przez `@import` w `css/style.css`
- JavaScript (ES modules) — `js/script.js` i moduły w `js/modules/`

**Tooling i build**

- Node.js `>=22.19.0` (pole `engines`)
- PostCSS z `postcss-cli` (`postcss-import`, `postcss-preset-env` stage 3, `autoprefixer`, `cssnano`)
- esbuild (bundling i minifikacja JS, target `es2018`, format `iife`)
- sharp (generowanie wariantów obrazów)
- natywny serwer deweloperski Node.js (`scripts/dev-server.mjs`, bez zależności zewnętrznych)
- Prettier (formatowanie)
- Playwright + axe-core (QA dostępności i funkcjonalne testy przeglądarkowe)
- Lighthouse (`lighthouse` + `chrome-launcher`, uruchamiany przez `scripts/qa-lighthouse.mjs`)
- cross-env (przekazanie `SITE_URL` do generatora sitemapy)
- GitHub Actions (jeden workflow `CI`)

### Architektura

- Każda utrzymywana strona jest osobnym dokumentem HTML z własnymi metadanymi i danymi strukturalnymi. Wspólny nagłówek i stopka są dołączane dyrektywami `<!-- @layout … -->` i `<!-- @include partials/… -->`, a renderer `scripts/utils/partials.js` rozwija je przy buildzie, w serwerze developerskim i w skryptach kontrolnych.
- Renderer jest bramką jakości: przerywa pracę przy brakującym partialu, nieopisanej zmiennej `{{…}}`, zdublowanym lub niepoprawnym `@layout`, `@include` wychodzącym poza `partials/`, cyklu dołączeń oraz przy dyrektywie lub tokenie pozostałym po renderowaniu.
- CSS jest podzielony na moduły (`tokens`, `base`, `layout`, `components`, `sections`, `utilities`, `subpages`) scalane przez `@import`; build PostCSS rozwija je do jednego pliku `dist/css/style.min.css`.
- JavaScript jest podzielony na moduły ES (`nav`, `ui-core`, `icons`, `forms`, `lightbox`, `map-consent`, `prefetch`, `home`, `project-banner`, `utils`). `js/script.js` eksponuje je w przestrzeni `window.SC` i uruchamia inicjalizatory warunkowo, na podstawie obecności selektorów na stronie.
- `js/theme-init.js` jest ładowany synchronicznie w `<head>`, aby ustawić motyw przed pierwszym renderem; `js/sw-register.js` rejestruje Service Workera w zakresie `/`.
- Drzewo źródłowe nie zawiera artefaktów produkcyjnych: minifikowany CSS i JS powstają wyłącznie w `dist/`, a `.gitignore` blokuje `/css/*.min.css` i `/js/*.min.js`.
- `sw.js` w katalogu głównym jest źródłem logiki runtime; blok między znacznikami `build:sw-manifest` (wersja cache i lista precache) jest własnością buildu.

### Struktura projektu

```text
DS-construction-pr01-SolidCraft/
├── index.html
├── 404.html
├── offline.html
├── thank-you.html
├── regulamin.html               # strony dokumentów
├── polityka-prywatnosci.html
├── cookies.html
├── oferta/                      # 6 podstron usług
├── partials/
│   ├── header.html              # wspólny nagłówek (źródło)
│   └── footer.html              # wspólna stopka (źródło)
├── css/
│   ├── style.css                # źródło (@import modułów)
│   └── modules/
├── js/
│   ├── script.js                # źródło (ES modules)
│   ├── theme-init.js
│   ├── sw-register.js
│   └── modules/
├── assets/
│   ├── fonts/
│   ├── img-src/                 # obrazy źródłowe
│   └── img/                     # warianty generowane przez sharp
├── scripts/
│   ├── build-dist.js
│   ├── dev-server.js
│   ├── generate-sitemap.mjs
│   ├── generate-sw.js
│   ├── images.js
│   ├── check-links.mjs
│   ├── check-html-assets.mjs
│   ├── qa-a11y.mjs
│   ├── qa-functional.mjs
│   ├── verify-css-build.js
│   ├── verify-js-build.js
│   ├── functional/              # scenariusze testów funkcjonalnych
│   └── utils/                   # renderer partiali, logger, serwery statyczne
├── .github/workflows/ci.yml
├── dist/                        # wynik buildu, nietrackowany w Git
├── sw.js
├── manifest.webmanifest
├── robots.txt
├── _headers
├── _redirects
├── netlify.toml
├── lighthouse.config.json
├── postcss.config.js
├── docs/
│   ├── settings.md
│   ├── CHANGELOG.md
│   └── archive/                 # zakończone audyty i plany
├── LICENSE
└── package.json
```

### Instalacja

```bash
npm install
```

Wymagania: Node.js w wersji `>=22.19.0`. Wszystkie zależności są zależnościami deweloperskimi — runtime strony nie korzysta z pakietów npm.

### Development lokalny

```bash
npm run dev
```

`scripts/dev-server.mjs` uruchamia natywny serwer Node.js na `http://127.0.0.1:15500/` i obsługuje każde żądanie HTML przez renderer partiali, więc zmiany w `partials/` są widoczne po odświeżeniu. Zapis pliku przeładowuje stronę automatycznie; zmiana CSS odświeża arkusze bez pełnego przeładowania. Serwer HTTP jest konieczny — strony korzystają z modułów ES, Service Workera i manifestu wskazywanego ścieżką bezwzględną, więc otwarcie pliku przez `file://` nie odwzoruje zachowania produkcyjnego.

Przebudowa assetów w tle (zapis do `dist/`):

```bash
npm run watch:css
npm run watch:js
```

### Dostępne skrypty

- `npm run dev` — serwer developerski z rendererem partiali (port `15500`); `npm start` jest aliasem.
- `npm run build:css` — PostCSS buduje `dist/css/style.min.css`, następnie `scripts/verify-css-build.js` sprawdza brak pozostałych `@import`.
- `npm run build:js` — esbuild buduje `dist/js/theme-init.min.js` i `dist/js/script.min.js`, następnie `scripts/verify-js-build.js` sprawdza brak składni `import`/`export`.
- `npm run build` — `build:css` i `build:js`.
- `npm run build:dist` — pełny build wdrożeniowy: `scripts/build-dist.js`, następnie `build`, `build:sitemap` i `build:sw`.
- `npm run build:sitemap` — generuje `dist/sitemap.xml` dla adresu przekazanego w `SITE_URL`.
- `npm run build:sw` — generuje `dist/sw.js` z listą precache i wersją cache wyliczonymi z gotowego `dist/`.
- `npm run images:build` / `npm run images:clean` — generowanie i czyszczenie obrazów w `assets/img/`.
- `npm run check:links` — walidacja linków wewnętrznych, zewnętrznych i kotwic w renderowanych stronach.
- `npm run check:assets` — walidacja lokalnych odwołań do zasobów w renderowanych stronach.
- `npm run check:html` — `check:links` i `check:assets`.
- `npm run qa:a11y` — skan axe-core w przeglądarce headless.
- `npm run qa:functional` — funkcjonalny zestaw regresyjny w Playwright; obsługuje filtr `--only=<fragment nazwy scenariusza>`.
- `npm run check:predeploy` — `check:html` i `qa:a11y` jako lokalna bramka przed wdrożeniem.
- `npm run qa:lighthouse` — `build:dist` i audyt Lighthouse według `lighthouse.config.json`; `npm run qa:lhci` pozostaje aliasem.
- `npm run format` / `npm run format:check` — Prettier w trybie zapisu i weryfikacji.

### Build produkcyjny

```bash
npm run build:dist
```

Kolejność jest deterministyczna: `dist/` jest tworzony od nowa, utrzymywane strony są renderowane wraz z partialami, kopiowane są pliki opcjonalne (`_headers`, `_redirects`, `netlify.toml`, `robots.txt`, `manifest.webmanifest`, `js/sw-register.js`) oraz `assets/` z pominięciem `assets/img-src/`, następnie w kopiach HTML odwołania `css/style.css`, `js/script.js` i `js/theme-init.js` są podmieniane na warianty minifikowane. Dopiero potem powstają assety produkcyjne (`build`), `dist/sitemap.xml` (`build:sitemap`) i `dist/sw.js` (`build:sw`).

`build:sitemap` wymaga zmiennej `SITE_URL` i kończy się kodem różnym od zera, gdy jej nie ustawiono; skrypt przekazuje `SITE_URL=https://construction-pr01-solidcraft.netlify.app` przez `cross-env`. Z sitemapy wykluczone są `404.html`, `offline.html` i `thank-you.html`.

`build:sw` przepisuje blok między znacznikami `build:sw-manifest` w `sw.js`: listę precache wyprowadza z reguł nad gotowym `dist/` (strony HTML, `manifest.webmanifest`, `css/`, `js/`, `assets/fonts/*.woff2`, `assets/img/favicon/*`), a `CACHE_VERSION` ustawia na skrócony do 16 znaków skrót SHA-256 z par adres–zawartość. Skrypt przerywa build, gdy reguła precache nic nie dopasuje, gdy znaczniki nie występują dokładnie raz lub gdy wpis jest zduplikowany, nieposortowany albo nie wskazuje pliku w `dist/`.

### Testy i walidacja

- `scripts/check-links.mjs` i `scripts/check-html-assets.mjs` — statyczna walidacja linków i odwołań do zasobów; obie renderują strony przez `scripts/utils/partials.js`, więc sprawdzają dokument w takiej postaci, w jakiej trafia do `dist/`.
- `scripts/qa-a11y.mjs` — axe-core uruchamiany przez Playwright na lokalnym serwerze statycznym; skanowane są `index.html`, `404.html`, wszystkie sześć podstron `oferta/`, wszystkie trzy strony dokumentów w katalogu głównym oraz `offline.html`, jeśli plik istnieje. Skrypt kończy się błędem przy naruszeniach o wadze `serious` lub `critical`.
- `scripts/qa-functional.mjs` — dziewięć scenariuszy funkcjonalnych w headless Chromium: mobilna szuflada nawigacji i podmenu oferty, lightbox (pojedynczy tab stop, Enter/Escape z przywróceniem fokusa, Spacja i strzałki) oraz formularz kontaktowy (puste zgłoszenie, okno antyspamowe, poprawna wysyłka, nieudana wysyłka).
- `scripts/verify-css-build.js` i `scripts/verify-js-build.js` — weryfikacja artefaktów wbudowana w komendy build.
- `lighthouse.config.json` — Lighthouse na katalogu `dist` dla `/`, `/oferta/remonty.html` i `/polityka-prywatnosci.html`, z progami: performance `0.6`, accessibility `0.85`, SEO `0.85`, best practices `0.75`.

Powyższe komendy są skonfigurowane w repozytorium; ich wykonanie nie było elementem przygotowania tej dokumentacji.

### Wdrożenie

Repozytorium zawiera konfigurację wdrożenia na Netlify:

- `netlify.toml` — komenda build `npm run build:dist`, katalog publikacji `dist`.
- `_redirects` — przekierowania 301 dla adresów bez rozszerzenia `.html` i ze slashem końcowym oraz reguła 404 na `/404.html`.
- `_headers` — nagłówki `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` i `X-Robots-Tag`.
- Formularz kontaktowy jest przygotowany pod Netlify Forms (atrybuty `netlify`, `netlify-honeypot="bot-field"` oraz ukryte pole `form-name`). Repozytorium nie zawiera własnej implementacji obsługi zgłoszeń.

Ciągła integracja: `.github/workflows/ci.yml` definiuje workflow `CI` z jednym zadaniem `quality-gate` (status `CI / quality-gate`), uruchamiany przy `push` na `main`, dla pull requestów do `main` i ręcznie. Kroki: `npm ci`, `npm run build:dist`, instalacja Chromium dla Playwright, `npm run check:predeploy`, `npm run qa:functional`. Workflow działa na Node `24`, ma uprawnienia `contents: read` i niczego nie wdraża — wdrożenie pozostaje po stronie Netlify.

### Dostępność

Zaimplementowane mechanizmy obejmują:

- semantyczne sekcje z `aria-labelledby` i `aria-describedby` oraz link „Pomiń do treści” prowadzący do `#main`,
- synchronizację stanu ARIA w nawigacji (`aria-expanded`, `aria-haspopup`, `aria-controls`, `aria-current`) i w przełączniku motywu (`aria-pressed`),
- obsługę klawiatury, pułapkę fokusa i przywracanie fokusa w lightboxie oraz w modalu informacyjnym,
- komunikaty błędów formularza powiązane z polami, ustawianie `aria-invalid` i obszar statusu `role="status"` z `aria-live="polite"`,
- reakcję na `prefers-reduced-motion` w CSS oraz w skryptach animacji i przewijania,
- ikony SVG wstawiane z `aria-hidden="true"` i `focusable="false"`,
- bramki QA: `npm run qa:a11y` (axe-core, 12 tras) i `npm run qa:functional` (ścieżki klawiaturowe nawigacji i lightboxa).

Dokumentacja nie zawiera potwierdzenia zgodności z konkretnym poziomem WCAG — opisane są wyłącznie zaimplementowane mechanizmy.

### SEO

- `title`, `meta description`, `canonical` i `meta robots` na stronach; `noindex` dla `404.html`, `offline.html` oraz `thank-you.html` (`noindex, follow`).
- Metadane Open Graph i Twitter Card wraz z obrazami w `assets/img/og/`.
- Dane strukturalne JSON-LD: `WebSite`, `CollectionPage`, `ItemList` i `FAQPage`. Znaczniki opisujące fikcyjny podmiot gospodarczy zostały usunięte, zgodnie z demonstracyjnym charakterem serwisu.
- `robots.txt` z odwołaniem do `/sitemap.xml`; sam plik sitemapy nie jest utrzymywany w repozytorium — powstaje jako `dist/sitemap.xml` podczas `build:dist`.

### PWA i obsługa offline

- `manifest.webmanifest` definiuje `id`, `start_url` i `scope` `/`, tryb `standalone`, kolory motywu, ikony (w tym `maskable`), trzy skróty aplikacji oraz zrzuty ekranu dla widoku wąskiego i szerokiego.
- `js/sw-register.js` rejestruje `/sw.js` w zakresie `/` po zdarzeniu `load`.
- W drzewie źródłowym `CACHE_VERSION` ma wartość `"dev"`, a lista precache jest pusta — taki worker instaluje się czysto i działa w trybie network-only, więc lokalne zmiany nie są przesłaniane przez cache.
- W buildzie produkcyjnym `dist/sw.js` otrzymuje wyliczoną listę precache i wersję cache, obsługuje dokumenty HTML strategią network-first z fallbackiem na `/offline.html`, a zasoby statyczne strategią cache-first z zapisem odpowiedzi sieciowych; przy aktywacji usuwa wyłącznie klucze z prefiksem `solidcraft-v`.

Manifest i Service Worker są wskazywane ścieżkami bezwzględnymi, więc działają przy serwowaniu serwisu z katalogu głównego domeny. Repozytorium nie zawiera weryfikacji instalowalności ani testów działania offline.

### Wydajność

- Minifikacja CSS (`cssnano`) i JS (`esbuild`) oraz podmiana odwołań na assety minifikowane w buildzie `dist/`.
- Preload obrazu hero (`srcset` AVIF) z `fetchpriority="high"` oraz preload plików `woff2`; fonty są hostowane lokalnie w podziale na podzbiory `latin` i `latin-ext` z `unicode-range` i `font-display: swap`.
- Responsywne obrazy generowane przez `scripts/images.js` w formatach AVIF, WebP i JPG, w zdefiniowanych rozmiarach dla hero, oferty i galerii.
- Ikony interfejsu wstawiane z jednego rejestru SVG zamiast osobnych plików graficznych.
- Prefetch podstron oferty przy `mouseenter`/`focus` z opóźnieniem 120 ms, pomijany przy `saveData` i połączeniach 2G.
- Mapa ładowana dopiero po zgodzie użytkownika, w `iframe` z `loading="lazy"`.
- Precache powłoki aplikacji i runtime cache w Service Workerze.
- Progi jakości zdefiniowane w `lighthouse.config.json`.

Repozytorium nie zawiera zapisanych wyników pomiarów wydajności.

### Dane i trwałość stanu

- Treści serwisu są zapisane bezpośrednio w plikach HTML i w `partials/`; nie ma zewnętrznego źródła danych ani API.
- W `localStorage` przechowywane są wyłącznie preferencje interfejsu: `theme` (motyw), `consent.maps` (zgoda na osadzenie mapy) i `project-banner-accepted` (akceptacja informacji o projekcie). Dostęp do storage jest zabezpieczony — brak dostępu nie blokuje działania interfejsu.
- Parametr adresu `?usluga=` jest przepisywany do ukrytego pola formularza kontaktowego, po czym usuwany z adresu przez `history.replaceState`.
- Dane formularza są wysyłane metodą POST na adres z atrybutu `action` (`/thank-you.html`) i obsługiwane przez Netlify Forms. Projekt nie posiada kont użytkowników, bazy danych ani synchronizacji między urządzeniami.

### Utrzymanie projektu

- Pliki źródłowe do edycji: `partials/header.html`, `partials/footer.html`, `css/style.css` i `css/modules/**`, `js/script.js`, `js/theme-init.js`, `js/sw-register.js`, `js/modules/**`, `assets/img-src/**` oraz logika runtime w `sw.js`.
- Wspólna warstwa layoutu ma jedno źródło — edytuj partial, nie wyrenderowaną kopię w `dist/`.
- Nie edytuj ręcznie: zawartości `dist/` (w tym `dist/sitemap.xml` i `dist/sw.js`), bloku między znacznikami `build:sw-manifest` w `sw.js` oraz `assets/img/**`.
- Po zmianie plików źródłowych uruchom `npm run build:dist`, a po zmianie obrazów źródłowych `npm run images:build`.
- Nazwy `CI` i `quality-gate` są częścią kontraktu — zmiana którejkolwiek odłącza wymagany status check w ustawieniach ochrony gałęzi.
- Zasady pipeline'u i narzędzi są opisane w `docs/settings.md`, który pozostaje jedynym źródłem prawdy dla tej warstwy; historia zmian jest prowadzona w `docs/CHANGELOG.md`.

### Licencja

Projekt jest objęty licencją **Własnościowa Licencja Projektu KP_CODE (wersja 1.0)** — pełna treść znajduje się w pliku [`LICENSE`](LICENSE). Pole `license` w `package.json` ma wartość `SEE LICENSE IN LICENSE`.

Projekt nie jest oprogramowaniem open source. Wykorzystanie komercyjne, redystrybucja, publiczne wdrożenie oraz wykorzystanie projektu jako szablonu wymagają uprzedniej, pisemnej zgody właściciela praw: **kontakt@kp-code.pl**.

### Atrybucje

- Geometria ikon w `js/modules/icons.js` pochodzi z Font Awesome Free 7.3.1 (Fonticons, Inc.), zgodnie z notą w nagłówku pliku: <https://fontawesome.com>.
- Kroje Montserrat i Poppins są hostowane lokalnie w `assets/fonts/` jako pliki `woff2` i podlegają licencji SIL Open Font License 1.1. Zapis proweniencji znajduje się w [`assets/fonts/README.md`](assets/fonts/README.md), a pełny tekst licencji w [`assets/fonts/OFL-1.1.txt`](assets/fonts/OFL-1.1.txt).

## EN

### Project Overview

SolidCraft is a static, multi-page website for a construction and renovation company, built with HTML, CSS, and JavaScript, without a frontend framework. The repository contains the home page, six service subpages in `oferta/`, three legal pages at the repository root (`regulamin.html`, `polityka-prywatnosci.html`, `cookies.html`), and the `thank-you.html`, `404.html`, and `offline.html` pages. The interface language is Polish (`lang="pl"`).

The site is demonstrational and labeled as such in its content: a first-visit modal credits KP_Code Digital Studio as the author of this sample implementation, and the client-logo and testimonial sections are marked as examples. The repository contains no backend and no database; the server-side layer is limited to static hosting configuration.

The shared header and footer have a single source in `partials/` and are expanded into complete HTML documents at build time — no page composition happens in the browser.

### Live Version

The address configured as `homepage` in `package.json` and as the canonical URL of the pages: <https://construction-pr01-solidcraft.netlify.app/>

### Key Features

- Multi-page navigation with a shared header from `partials/header.html`: offer dropdown, a mobile variant (`aria-expanded`, keyboard support), and active-section highlighting (scroll spy).
- Contact form with `novalidate` and its own validation layer: Polish phone number masking and validation, error messages linked through `aria-describedby`, `aria-invalid`, and a `role="status"` message area.
- Form anti-spam protection: hidden honeypot field (`bot-field`), rejection of submissions sent in under 2 seconds while preserving the entered data, content heuristics, and a 10 s submission timeout.
- Lightbox for offer cards and the project gallery: `role="dialog"`, `aria-modal`, Enter/Space activation, Escape, arrow navigation, focus trap, and focus restore to the triggering element.
- Light/dark theme toggle with pre-render theme resolution (`js/theme-init.js`) and preference persistence in `localStorage`.
- Informational modal about the demonstrational nature of the site: focus trap, Escape handling, scroll lock, and correct behavior when `localStorage` is unavailable.
- Google map embedded only after user consent, with the decision persisted in `localStorage`.
- Shared SVG icon registry (`js/modules/icons.js`) — 13 `[data-icon]` keys resolved at runtime, with no icon files in `assets/`.
- Service Worker registration, app-shell precaching, and an `offline.html` fallback page.
- Prefetch of service subpages on hover or focus, disabled for `Save-Data` and slow connections.

### Tech Stack

**Runtime (frontend)**

- HTML5 with a build-time partial renderer (`@layout`, `@include`, `{{token}}`, `{{#if}}`)
- CSS3 — modules in `css/modules/` composed via `@import` in `css/style.css`
- JavaScript (ES modules) — `js/script.js` and modules in `js/modules/`

**Tooling and build**

- Node.js `>=22.19.0` (`engines` field)
- PostCSS with `postcss-cli` (`postcss-import`, `postcss-preset-env` stage 3, `autoprefixer`, `cssnano`)
- esbuild (JS bundling and minification, target `es2018`, format `iife`)
- sharp (image variant generation)
- native Node.js development server (`scripts/dev-server.mjs`, dependency-free)
- Prettier (formatting)
- Playwright + axe-core (accessibility QA and functional browser tests)
- Lighthouse (`lighthouse` + `chrome-launcher`, run through `scripts/qa-lighthouse.mjs`)
- cross-env (passing `SITE_URL` to the sitemap generator)
- GitHub Actions (a single `CI` workflow)

### Architecture

- Every maintained page is a separate HTML document with its own metadata and structured data. The shared header and footer are pulled in with `<!-- @layout … -->` and `<!-- @include partials/… -->` directives, and the `scripts/utils/partials.js` renderer expands them during the build, in the development server, and in the checking scripts.
- The renderer is itself a gate: it stops on a missing partial, an undeclared `{{…}}` variable, a duplicated or malformed `@layout`, an `@include` escaping `partials/`, an include cycle, and on any directive or token surviving rendering.
- CSS is split into modules (`tokens`, `base`, `layout`, `components`, `sections`, `utilities`, `subpages`) composed via `@import`; the PostCSS build inlines them into a single `dist/css/style.min.css`.
- JavaScript is split into ES modules (`nav`, `ui-core`, `icons`, `forms`, `lightbox`, `map-consent`, `prefetch`, `home`, `project-banner`, `utils`). `js/script.js` exposes them under `window.SC` and runs initializers conditionally, based on the presence of selectors on the page.
- `js/theme-init.js` is loaded synchronously in `<head>` to set the theme before the first render; `js/sw-register.js` registers the Service Worker with scope `/`.
- The source tree holds no production artifacts: minified CSS and JS are produced only under `dist/`, and `.gitignore` blocks `/css/*.min.css` and `/js/*.min.js`.
- The root `sw.js` is the source of the runtime logic; the block between the `build:sw-manifest` markers (cache version and precache list) is owned by the build.

### Project Structure

```text
DS-construction-pr01-SolidCraft/
├── index.html
├── 404.html
├── offline.html
├── thank-you.html
├── regulamin.html               # legal pages
├── polityka-prywatnosci.html
├── cookies.html
├── oferta/                      # 6 service subpages
├── partials/
│   ├── header.html              # shared header (source)
│   └── footer.html              # shared footer (source)
├── css/
│   ├── style.css                # source (module @imports)
│   └── modules/
├── js/
│   ├── script.js                # source (ES modules)
│   ├── theme-init.js
│   ├── sw-register.js
│   └── modules/
├── assets/
│   ├── fonts/
│   ├── img-src/                 # source images
│   └── img/                     # variants generated by sharp
├── scripts/
│   ├── build-dist.js
│   ├── dev-server.js
│   ├── generate-sitemap.mjs
│   ├── generate-sw.js
│   ├── images.js
│   ├── check-links.mjs
│   ├── check-html-assets.mjs
│   ├── qa-a11y.mjs
│   ├── qa-functional.mjs
│   ├── verify-css-build.js
│   ├── verify-js-build.js
│   ├── functional/              # functional test scenarios
│   └── utils/                   # partial renderer, logger, static servers
├── .github/workflows/ci.yml
├── dist/                        # build output, not tracked in Git
├── sw.js
├── manifest.webmanifest
├── robots.txt
├── _headers
├── _redirects
├── netlify.toml
├── lighthouse.config.json
├── postcss.config.js
├── docs/
│   ├── settings.md
│   ├── CHANGELOG.md
│   └── archive/                 # archived audits and plans
├── LICENSE
└── package.json
```

### Installation

```bash
npm install
```

Requirements: Node.js `>=22.19.0`. All dependencies are development dependencies — the site runtime does not use npm packages.

### Local Development

```bash
npm run dev
```

`scripts/dev-server.mjs` starts a dependency-free native Node.js server on `http://127.0.0.1:15500/` and answers every HTML request through the partial renderer, so `partials/` edits are visible after a plain refresh. Saving a file reloads the page automatically; a CSS change refreshes stylesheets without a full reload. An HTTP server is required — the pages rely on ES modules, a Service Worker, and a manifest referenced by an absolute path, so opening files over `file://` will not reproduce production behavior.

Rebuilding assets in the background (output goes to `dist/`):

```bash
npm run watch:css
npm run watch:js
```

### Available Scripts

- `npm run dev` — development server with the partial renderer (port `15500`); `npm start` is an alias.
- `npm run build:css` — PostCSS builds `dist/css/style.min.css`, then `scripts/verify-css-build.js` checks that no `@import` remains.
- `npm run build:js` — esbuild builds `dist/js/theme-init.min.js` and `dist/js/script.min.js`, then `scripts/verify-js-build.js` checks that no `import`/`export` syntax remains.
- `npm run build` — runs `build:css` and `build:js`.
- `npm run build:dist` — the full deployment build: `scripts/build-dist.js`, then `build`, `build:sitemap`, and `build:sw`.
- `npm run build:sitemap` — generates `dist/sitemap.xml` for the address passed in `SITE_URL`.
- `npm run build:sw` — generates `dist/sw.js` with the precache list and cache version derived from the finished `dist/`.
- `npm run images:build` / `npm run images:clean` — generate and clean images in `assets/img/`.
- `npm run check:links` — validates internal links, external links, and anchors in the rendered pages.
- `npm run check:assets` — validates local asset references in the rendered pages.
- `npm run check:html` — runs `check:links` and `check:assets`.
- `npm run qa:a11y` — axe-core scan in a headless browser.
- `npm run qa:functional` — the Playwright functional regression suite; supports a `--only=<part of a scenario name>` filter.
- `npm run check:predeploy` — runs `check:html` and `qa:a11y` as the local pre-deploy gate.
- `npm run qa:lighthouse` — runs `build:dist` and the Lighthouse audit described by `lighthouse.config.json`; `npm run qa:lhci` is kept as an alias.
- `npm run format` / `npm run format:check` — Prettier in write and verify modes.

### Production Build

```bash
npm run build:dist
```

The order is deterministic: `dist/` is recreated, the maintained pages are rendered with their partials, the optional files (`_headers`, `_redirects`, `netlify.toml`, `robots.txt`, `manifest.webmanifest`, `js/sw-register.js`) and `assets/` (excluding `assets/img-src/`) are copied, and the HTML copies' `css/style.css`, `js/script.js`, and `js/theme-init.js` references are rewritten to their minified variants. Only then are the production assets built (`build`), followed by `dist/sitemap.xml` (`build:sitemap`) and `dist/sw.js` (`build:sw`).

`build:sitemap` requires the `SITE_URL` variable and exits non-zero when it is not set; the script supplies `SITE_URL=https://construction-pr01-solidcraft.netlify.app` through `cross-env`. `404.html`, `offline.html`, and `thank-you.html` are excluded from the sitemap.

`build:sw` rewrites the block between the `build:sw-manifest` markers in `sw.js`: the precache list is derived by rules over the finished `dist/` (HTML pages, `manifest.webmanifest`, `css/`, `js/`, `assets/fonts/*.woff2`, `assets/img/favicon/*`), and `CACHE_VERSION` is set to a SHA-256 digest of the URL–content pairs truncated to 16 characters. The script fails the build when a precache rule matches nothing, when the markers do not occur exactly once, or when an entry is duplicated, unsorted, or does not resolve to a file in `dist/`.

### Testing and Validation

- `scripts/check-links.mjs` and `scripts/check-html-assets.mjs` — static validation of links and asset references; both render pages through `scripts/utils/partials.js`, so they inspect the document in the form that ships to `dist/`.
- `scripts/qa-a11y.mjs` — axe-core executed through Playwright against a local static server; the scanned routes are `index.html`, `404.html`, all six `oferta/` subpages, all three root-level legal pages, and `offline.html` when the file exists. The script fails on `serious` or `critical` violations.
- `scripts/qa-functional.mjs` — nine functional scenarios in headless Chromium: the mobile navigation drawer and offer submenu, the lightbox (single tab stop, Enter/Escape with focus restore, Space and arrow keys), and the contact form (empty submission, anti-spam window, successful submission, failed submission).
- `scripts/verify-css-build.js` and `scripts/verify-js-build.js` — artifact verification embedded in the build commands.
- `lighthouse.config.json` — Lighthouse over the `dist` directory for `/`, `/oferta/remonty.html`, and `/polityka-prywatnosci.html`, with thresholds: performance `0.6`, accessibility `0.85`, SEO `0.85`, best practices `0.75`.

These commands are configured in the repository; running them was not part of preparing this documentation.

### Deployment

The repository includes Netlify deployment configuration:

- `netlify.toml` — build command `npm run build:dist`, publish directory `dist`.
- `_redirects` — 301 redirects for extensionless and trailing-slash paths, plus a 404 rule pointing to `/404.html`.
- `_headers` — `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `X-Robots-Tag` headers.
- The contact form is marked up for Netlify Forms (`netlify`, `netlify-honeypot="bot-field"` attributes and a hidden `form-name` field). The repository contains no custom submission handling implementation.

Continuous integration: `.github/workflows/ci.yml` defines the `CI` workflow with a single `quality-gate` job (status `CI / quality-gate`), triggered on `push` to `main`, on pull requests targeting `main`, and manually. Steps: `npm ci`, `npm run build:dist`, Playwright Chromium installation, `npm run check:predeploy`, `npm run qa:functional`. The workflow runs on Node `24`, holds `contents: read` permissions, and deploys nothing — deployment stays with Netlify.

### Accessibility

Implemented mechanisms include:

- semantic sections with `aria-labelledby` and `aria-describedby`, and a skip link to `#main`,
- ARIA state synchronization in navigation (`aria-expanded`, `aria-haspopup`, `aria-controls`, `aria-current`) and in the theme toggle (`aria-pressed`),
- keyboard support, a focus trap, and focus restore in the lightbox and in the informational modal,
- form error messages linked to their fields, `aria-invalid` handling, and a `role="status"` region with `aria-live="polite"`,
- `prefers-reduced-motion` handling in CSS and in the animation and scrolling scripts,
- SVG icons injected with `aria-hidden="true"` and `focusable="false"`,
- QA gates: `npm run qa:a11y` (axe-core, 12 routes) and `npm run qa:functional` (keyboard paths for navigation and the lightbox).

This documentation makes no claim of conformance with a specific WCAG level — only the implemented mechanisms are described.

### SEO

- `title`, `meta description`, `canonical`, and `meta robots` across pages; `noindex` for `404.html`, `offline.html`, and `thank-you.html` (`noindex, follow`).
- Open Graph and Twitter Card metadata with images in `assets/img/og/`.
- JSON-LD structured data: `WebSite`, `CollectionPage`, `ItemList`, and `FAQPage`. Markup describing a fictitious business entity was removed, in line with the demonstrational nature of the site.
- `robots.txt` points to `/sitemap.xml`; the sitemap file itself is not maintained in the repository — it is produced as `dist/sitemap.xml` during `build:dist`.

### PWA and Offline Support

- `manifest.webmanifest` defines `id`, `start_url` and `scope` `/`, `standalone` display, theme colors, icons (including `maskable`), three app shortcuts, and screenshots for narrow and wide form factors.
- `js/sw-register.js` registers `/sw.js` with scope `/` after the `load` event.
- In the source tree `CACHE_VERSION` is `"dev"` and the precache list is empty — such a worker installs cleanly and runs network-only, so local edits are never shadowed by a cached copy.
- In the production build `dist/sw.js` receives the derived precache list and cache version, serves HTML documents network-first with an `/offline.html` fallback and static assets cache-first while persisting network responses, and on activation deletes only keys prefixed `solidcraft-v`.

The manifest and Service Worker are referenced by absolute paths, so they work when the site is served from the domain root. The repository contains no installability verification or offline behavior tests.

### Performance

- CSS minification (`cssnano`) and JS minification (`esbuild`), with references rewritten to minified assets in the `dist/` build.
- Hero image preload (AVIF `srcset`) with `fetchpriority="high"` and `woff2` preloads; fonts are self-hosted, split into `latin` and `latin-ext` subsets with `unicode-range` and `font-display: swap`.
- Responsive images generated by `scripts/images.js` in AVIF, WebP, and JPG formats, at defined sizes for hero, offer, and gallery images.
- Interface icons injected from a single SVG registry instead of separate image files.
- Prefetch of service subpages on `mouseenter`/`focus` with a 120 ms delay, skipped for `saveData` and 2G connections.
- The map is loaded only after user consent, in an `iframe` with `loading="lazy"`.
- App-shell precaching and runtime caching in the Service Worker.
- Quality thresholds defined in `lighthouse.config.json`.

The repository contains no recorded performance measurement results.

### Data and State Persistence

- Site content is stored directly in the HTML files and in `partials/`; there is no external data source or API.
- `localStorage` holds interface preferences only: `theme` (theme), `consent.maps` (map embed consent), and `project-banner-accepted` (project notice acceptance). Storage access is guarded — an unavailable store does not block the interface.
- The `?usluga=` URL parameter is copied into a hidden field of the contact form and then removed from the address via `history.replaceState`.
- Form data is sent via POST to the address in the `action` attribute (`/thank-you.html`) and handled by Netlify Forms. The project has no user accounts, database, or cross-device synchronization.

### Project Maintenance

- Editable source files: `partials/header.html`, `partials/footer.html`, `css/style.css` and `css/modules/**`, `js/script.js`, `js/theme-init.js`, `js/sw-register.js`, `js/modules/**`, `assets/img-src/**`, and the runtime logic in `sw.js`.
- The shared layout has one source — edit the partial, not the rendered copy in `dist/`.
- Do not edit by hand: anything under `dist/` (including `dist/sitemap.xml` and `dist/sw.js`), the block between the `build:sw-manifest` markers in `sw.js`, and `assets/img/**`.
- After changing source files run `npm run build:dist`; after changing source images run `npm run images:build`.
- The `CI` and `quality-gate` names are part of the contract — renaming either detaches the required status check in branch-protection settings.
- Pipeline and tooling rules are documented in `docs/settings.md`, which remains the single source of truth for that layer; the change history is kept in `docs/CHANGELOG.md`.

### License

The project is covered by the **KP_CODE Proprietary Project License (version 1.0)** — the full text is available in the [`LICENSE`](LICENSE) file. The `license` field in `package.json` is set to `SEE LICENSE IN LICENSE`.

The project is not open-source software. Commercial use, redistribution, public deployment, and use of the project as a template require prior written permission from the copyright owner: **kontakt@kp-code.pl**.

### Attributions

- The icon geometry in `js/modules/icons.js` comes from Font Awesome Free 7.3.1 (Fonticons, Inc.), as stated in the file header: <https://fontawesome.com>.
- The Montserrat and Poppins typefaces are self-hosted as `woff2` files in `assets/fonts/` and are licensed under the SIL Open Font License 1.1. The provenance record is in [`assets/fonts/README.md`](assets/fonts/README.md) and the full license text in [`assets/fonts/OFL-1.1.txt`](assets/fonts/OFL-1.1.txt).
