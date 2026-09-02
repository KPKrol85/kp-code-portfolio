# Lauren English

## PL

### Przegląd projektu

Lauren English to statyczna, wielostronicowa witryna edukacyjna prezentująca ofertę indywidualnej nauki języka angielskiego. Repozytorium obejmuje stronę główną, usługi, pakiety, katalog materiałów, lokalny dziennik postępów, kontakt, dokumenty prawne oraz strony techniczne dla błędów, trybu offline i potwierdzenia wysłania formularza.

Każda trasa jest samodzielnym dokumentem HTML. Wspólny shell, metadane i treści oparte na danych są składane przez statyczne skrypty Node.js. `npm run build` tworzy kompletne `dist/`, w którym produkcyjny HTML ładuje haszowane CSS i JavaScript z `/build/`, a Service Worker korzysta z finalnego grafu Vite. Kanoniczne źródła pozostają poza `dist/`; projekt nie używa frameworka frontendowego ani routingu SPA.

### Wersja online

[Otwórz Lauren English](https://education-pr01-laurenenglish.netlify.app/)

### Kluczowe funkcje

- responsywny wspólny header, nawigacja mobilna z pułapką fokusu, aktywne stany nawigacji i przełącznik jasnego/ciemnego motywu;
- dane pakietów i materiałów utrzymywane w modułach JavaScript oraz renderowane do HTML podczas buildu;
- katalog materiałów dostępny bez JavaScriptu i rozszerzany po inicjalizacji o filtrowanie kategorii, poziomu i dostępności;
- lokalny dziennik postępów z celami tygodniowymi, dziennymi check-inami, statystykami, resetem i eksportem JSON;
- formularz kontaktowy skonfigurowany dla Netlify Forms z honeypotem i przekierowaniem na stronę podziękowania;
- FAQ accordion, nawigacja po anchorach z przenoszeniem fokusu oraz animacje respektujące `prefers-reduced-motion`;
- generowane metadane SEO, manifest aplikacji, Service Worker i dedykowany fallback offline.

### Stack technologiczny

- **Runtime:** semantyczny HTML5, CSS, Vanilla JavaScript w natywnych modułach ES;
- **CSS:** design tokens, BEM, układ mobile-first, PostCSS, `postcss-import`, cssnano;
- **Build:** statyczne skrypty Node.js ESM, wielostronicowy Vite z PostCSS oraz Sharp dla obrazów;
- **Development:** npm z `package-lock.json` oraz developerski serwer Vite z HMR do lokalnego podglądu;
- **Jakość kodu:** ESLint, Prettier i projektowe walidatory HTML, treści, danych, CSS, SEO, PWA oraz outputu produkcyjnego;
- **Testy przeglądarkowe:** Playwright w Chromium dla widoków desktopowych i mobilnych;
- **Integracja hostingowa:** Netlify Forms, reguły `_redirects` oraz `netlify.toml` z manualnym deploymentem `dist/`.

### Architektura

- `scripts/shared-shell.mjs` generuje współdzielony skip link, header, nawigację i footer dla sześciu stron publicznych oraz trzech stron prawnych.
- `scripts/site-config.mjs` jest rejestrem tras, metadanych, polityki indeksowania i publicznych zasobów SEO.
- `scripts/content-renderers.mjs` łączy dane z `js/data/` z oznaczonymi regionami pakietów i materiałów w HTML.
- `css/style.css` zachowuje kolejność warstw `tokens → base → utilities → components → sections → pages`.
- `js/main.js` inicjalizuje odseparowane moduły funkcjonalne; każdy moduł chroni zapytania DOM i kończy działanie, gdy jego komponent nie występuje na stronie.
- `vite.config.mjs` wyprowadza dwanaście wejść HTML z rejestru stron i zapisuje haszowane zasoby produkcyjne w `dist/build/`.
- `service-worker.template.js`, `scripts/pwa-config.mjs` i finalny graf Vite są źródłami produkcyjnego `dist/service-worker.js`.

Pliki HTML w katalogu głównym zawierają kanoniczną treść właściwą danej stronie, ale regionów oznaczonych komentarzami `seo:*`, `shared-shell:*`, `package-*` i `materials-*` nie należy edytować ręcznie. `sitemap.xml`, `robots.txt` i `_redirects` są generowanymi zasobami routingu. `.vite-public/` jest tymczasowym stagingiem, a całe `dist/` — łącznie z HTML, bundle’ami i Service Workerem — jest generowanym outputem publikacyjnym, którego nie należy utrzymywać ręcznie.

### Struktura projektu

```text
.
├── index.html                 # strona główna
├── uslugi.html                # usługi
├── pakiety.html               # porównanie pakietów
├── materialy.html             # katalog materiałów
├── postepy.html               # lokalny dziennik postępów
├── kontakt.html               # dane kontaktowe i formularz Netlify
├── polityka-prywatnosci.html  # dokumenty prawne
├── regulamin.html
├── cookies.html
├── 404.html                   # strony techniczne
├── offline.html
├── thank-you.html
├── css/                       # tokeny, warstwy bazowe, komponenty, sekcje i strony
├── js/
│   ├── data/                  # pakiety, materiały, dostęp, filtry i definicje postępów
│   ├── modules/               # moduły interakcji
│   ├── pages/                 # logika stron
│   └── state/                 # bezpieczne operacje na stanie przeglądarki
├── scripts/                   # assemblery, renderery, walidatory i serwer developerski
├── assets/                    # obrazy źródłowe i publiczne, ikony, fonty oraz PWA
├── tests/e2e/                 # testy Playwright
├── docs/                      # dokumentacja architektury i workflow
├── .vite-public/              # generowany staging publicznych assetów Vite
├── dist/                      # generowany katalog publikacyjny
├── service-worker.template.js
├── service-worker.js          # rootowy output zgodności starszego workflow
├── vite.config.mjs
├── playwright.config.mjs
├── netlify.toml               # build Vite i publikacja dist/
├── site.webmanifest
├── package.json
└── LICENSE.md
```

### Instalacja

Repozytorium używa npm i zawiera zatwierdzony `package-lock.json` w formacie lockfile v3. Czysta instalacja do lokalnego developmentu, weryfikacji, testów przeglądarkowych i przygotowania wdrożenia zawsze odtwarza ten przeglądnięty graf zależności:

```powershell
npm ci
npx playwright install chromium
```

Polecenie `npm install` jest zarezerwowane wyłącznie dla celowego dodawania, usuwania lub aktualizowania zależności wraz z odpowiednią zmianą `package.json` i `package-lock.json`; nie służy do rutynowej konfiguracji projektu.

Obsługiwany kontrakt obejmuje Node.js `>=22.14.0 <23` (linię Node 22) oraz npm `10.9.2`. Plik `.nvmrc` wskazuje zweryfikowane lokalnie Node.js `22.14.0`, a `packageManager` przypina npm `10.9.2`; pole `engines` definiuje zgodność, ale nie instaluje runtime.
### Development lokalny

```powershell
npm run dev
```

Polecenie składa HTML, przygotowuje staging `.vite-public/` i uruchamia developerski serwer Vite, który obsługuje kanoniczny root projektu — nie `dist/` — pod `http://localhost:5173/`. Port jest przypięty na stałe (`strictPort`), więc zajęty port kończy start błędem zamiast cichej zmiany adresu. Zmiana zależności assemblera (`scripts/shared-shell.mjs`, konfiguracja stron, renderer lub kanoniczne dane) uruchamia ponownie `npm run build:html`, a Vite przeładowuje stronę po zapisaniu wygenerowanego HTML. Na tym porcie aplikacja usuwa wyłącznie własną lokalną rejestrację Service Workera i cache z prefiksem `lauren-english-v`, aby stan PWA nie zasłaniał zmian źródłowych.

### Dostępne skrypty

- `npm run dev` — składa HTML, przygotowuje publiczny staging i uruchamia developerski serwer Vite na porcie `5173`;
- `npm run build` — tworzy kompletny produkcyjny katalog `dist/` i generuje jego Service Workera;
- `npm run prepare:vite-public` — odtwarza ignorowany staging `.vite-public/` dla zasobów kopiowanych bez transformacji;
- `npm run check:vite` / `npm run check:pwa:vite` — sprawdza graf produkcyjny i kontrakt PWA wewnątrz `dist/`;
- `npm run build:html` / `npm run check:html` — aktualizuje lub bez zapisu sprawdza regiony HTML oraz zasoby routingu;
- `npm run build:sw` / `npm run build:sw:vite` — generuje odpowiednio rootowy worker źródłowy lub produkcyjny `dist/service-worker.js`;
- `npm run check:data` / `npm run check:content` — sprawdza dane pakietów i materiałów oraz integralność treści publicznych;
- `npm run check:css` — sprawdza architekturę CSS, tokeny motywów i zdefiniowane pary kontrastu;
- `npm run check:seo` / `npm run check:pwa` — sprawdza kontrakty źródłowych metadanych, routingu i PWA;
- `npm run check:release` — uruchamia zbiorczą, niezapisującą kontrolę statyczną przed wydaniem;
- `npm run lint:js` — uruchamia ESLint dla kanonicznych źródeł JavaScript i modułów projektu;
- `npm run test:e2e` — buduje przez Vite, serwuje wyłącznie `dist/` i uruchamia pełny zestaw Playwright;
- `npm run test:e2e:smoke`, `npm run test:e2e:interactions`, `npm run test:e2e:theme`, `npm run test:e2e:responsive`, `npm run test:e2e:seo`, `npm run test:e2e:pwa` — uruchamia skupione zestawy przeciwko `dist/`; `npm run test:e2e:pwa:vite` zachowuje izolowany kontrakt Vite PWA;
- `npm run build:pwa-screenshots` — odtwarza screenshoty zadeklarowane w manifeście;
- `npm run images` — generuje z kanonicznych oryginałów deterministyczne fallbacki JPEG oraz warianty AVIF i WebP dla skonfigurowanych obrazów treści;
- `npm run check:images` — bez zapisu sprawdza zgodność wszystkich skonfigurowanych outputów obrazów z kanonicznymi oryginałami;
- `npm run format` — formatuje obsługiwane źródła przez Prettier.

### Build produkcyjny

```powershell
npm run build
```

`build` uruchamia kolejno assembler HTML, przygotowanie `.vite-public/`, wielostronicowy build Vite i generator Service Workera dla outputu. Powstaje dwanaście dokumentów HTML, haszowane bundle CSS i JavaScript w `dist/build/`, wymagane zasoby routingu i statyczne oraz `dist/service-worker.js` wyprowadzony z finalnego grafu.

Kanoniczne źródła pozostają w rootowych plikach HTML oraz katalogach `css/`, `js/`, `scripts/` i `assets/image-sources/`. `dist/` jest ignorowanym, odtwarzalnym outputem publikacyjnym i nie należy edytować żadnego z jego plików ręcznie.

`npm run check:vite` sprawdza strony, haszowane bundle, wymagane zasoby i brak ścieżek direct-source, a `npm run check:pwa:vite` sprawdza produkcyjny manifest, precache i worker. Rootowy `service-worker.js`, generowany przez `npm run build:sw` i sprawdzany przez `npm run check:pwa`, pozostaje kontraktem źródłowym i nie jest publikowany.

### Obrazy

Kanoniczne, edytowalne oryginały skonfigurowanych obrazów rastrowych znajdują się w `assets/image-sources/`. Rejestr `scripts/image-config.mjs` mapuje je na publiczne ścieżki w `assets/img/` i obecnie obejmuje hero strony głównej, hero kontaktu oraz portret Lauren. Publiczne fallbacki JPEG oraz warianty AVIF i WebP są generowanymi outputami i nie należy edytować ich jako plików źródłowych.

Uruchom `npm run images`, aby z kanonicznych oryginałów ponownie wygenerować skonfigurowane fallbacki JPEG oraz warianty AVIF i WebP w `assets/img/`. Skrypt najpierw sprawdza kompletność, odczyt i wymiary wszystkich kanonicznych źródeł; błąd preflight kończy działanie przed jakimkolwiek zapisem. Brakujący oryginał nigdy nie jest automatycznie odtwarzany z publicznego fallbacku. `npm run check:images` odtwarza oczekiwane outputy w pamięci i tylko do odczytu wykrywa brakujące lub niezgodne pliki; AVIF jest porównywany na zdekodowanych próbkach z ściśle określoną tolerancją, aby różnice między wersjami kodeka nie wymuszały zmian binarnych. W HTML używaj natywnego `<picture>` w kolejności AVIF, WebP, a następnie `<img>` z fallbackiem JPEG, zachowując atrybuty dostępności, wymiary i strategię ładowania. Generowanie obrazów pozostaje osobnym krokiem poza `npm run build`; publiczne outputy są celowo śledzone w repozytorium i należy je odświeżyć przez `npm run images` po zmianie kanonicznego oryginału.

### Testy i walidacja

Projekt udostępnia walidatory statyczne dla danych, publicznych treści, HTML, CSS, SEO i źródłowego PWA oraz osobne `check:vite` i `check:pwa:vite` dla wygenerowanego `dist/`. Nie zastępują one testów przeglądarkowych.

#### Niezapisująca kontrola release

```powershell
npm run check:release
```

Polecenie uruchamia kolejno `check:data`, `check:content`, `check:html`, `check:css`, `check:seo`, `check:images`, `check:pwa` i `lint:js`. Każdy krok tylko odczytuje źródła, konfigurację lub śledzone outputy albo wykonuje lint; polecenie nie generuje, nie formatuje, nie uruchamia serwera i nie zmienia plików.

`npm run images`, `npm run build`, walidacja wygenerowanego `dist/` przez `check:vite` i `check:pwa:vite`, Playwright, kontrole wizualne oraz deployment pozostają osobnymi workflow.


Główna konfiguracja Playwrighta automatycznie uruchamia `npm run build`, a następnie serwuje wyłącznie `dist/` przez Vite preview na porcie `4173`. Chromium działa w projektach `1440 × 900` oraz `390 × 844`, z jednym workerem i Service Workerami domyślnie zablokowanymi. Zestawy PWA włączają je jawnie; izolowany kontrakt Vite PWA używa osobnej konfiguracji na porcie `4274`.

Dostępne pozostają pełny entrypoint oraz skupione zestawy smoke, interactions, theme, responsive, SEO i PWA. Testy obejmują trasy, wspólny shell, motywy, interakcje klawiaturowe, responsywność, metadane, finalne assety, cache i zachowanie offline.

Wyniki wykonanych walidacji są dokumentowane w odpowiednim audycie lub zapisie wydania.

### Wdrożenie

Publiczna wersja pozostaje dostępna pod adresem wskazanym w sekcji „Wersja online”. Rootowy `netlify.toml` definiuje `npm run build` jako build oraz `dist` jako katalog publikacyjny.

Deployment produkcyjny jest uruchamiany manualnie z terminala dla istniejącego projektu Netlify. Repozytorium nie definiuje automatycznego deploymentu po commitach lub pushach ani integracji continuous deployment z GitHubem.

Przed manualną publikacją należy odtworzyć zatwierdzony graf zależności przez `npm ci`, zbudować i zweryfikować `dist/`, a następnie opublikować ten katalog bez ręcznej edycji. Skopiowany `_redirects` obsługuje alias `/thank-you`, a formularz w `dist/kontakt.html` zachowuje atrybuty Netlify Forms, honeypot `bot-field` i stronę docelową `/thank-you.html`.

### Dostępność

Projekt deklaruje cel WCAG 2.2 AA i implementuje konkretne mechanizmy wspierające ten kierunek, bez deklarowania formalnej zgodności:

- semantyczne landmarki, jeden `h1` na stronę, logiczne nagłówki i skip link;
- natywne kontrolki formularzy, widoczne etykiety, komunikacja pól wymaganych i style `:focus-visible`;
- mobilny drawer z `aria-expanded`, `aria-hidden`, `inert`, pułapką fokusu, obsługą `Escape` i zwrotem fokusu;
- accordion i filtry z synchronizowanymi stanami ARIA oraz obsługą klawiatury;
- przenoszenie fokusu na nagłówek docelowej sekcji po nawigacji do hasha;
- ograniczanie nieistotnego ruchu przez `prefers-reduced-motion`;
- projektowy validator kontrastu dla jawnie zdefiniowanych par w jasnym i ciemnym motywie.

### SEO

`scripts/site-config.mjs` definiuje sześć stron indeksowanych oraz sześć stron technicznych lub prawnych oznaczonych `noindex, nofollow`. Generator zapewnia stronom indeksowanym indywidualne tytuły i opisy, canonical, Open Graph, Twitter Card oraz JSON-LD typu `WebSite` lub `WebPage`.

`npm run build:html` synchronizuje metadane z `sitemap.xml`, `robots.txt` i `_redirects`. Kanonicznym obrazem społecznościowym jest lokalny plik `assets/og/og.png` o wymiarach `1200 × 630`; strony techniczne nie otrzymują canonicali ani metadanych społecznościowych.

### PWA i obsługa offline

`site.webmanifest` deklaruje tryb `standalone`, ikony `192 × 192` i `512 × 512`, trzy skróty oraz screenshoty dla szerokiego i wąskiego widoku. Service Worker jest rejestrowany po załadowaniu strony poza lokalnym środowiskiem developerskim na porcie `5173`.

Produkcyjny `dist/service-worker.js` jest generowany po buildzie Vite. Jego precache obejmuje wszystkie dwanaście opublikowanych dokumentów, odkryte haszowane assety runtime, lokalne fonty, branding, ikony motywu i manifestu oraz wymagane obrazy; screenshoty manifestu pozostają poza precache. Nawigacja używa sieci w pierwszej kolejności, zachowuje rzeczywiste odpowiedzi HTTP i przy braku sieci zwraca kopię znanego dokumentu albo `offline.html`. Aktywacja usuwa wyłącznie starsze cache z prefiksem projektu.

### Wydajność

- runtime nie ma zależności frameworkowych ani zewnętrznych skryptów;
- Inter i Literata są dostarczane lokalnie jako WOFF2 z `font-display: swap`, a head preloaduje tylko krytyczny plik Literata 700;
- ważne obrazy mają jawne wymiary, hero korzysta z `fetchpriority="high"`, a obrazy poniżej pierwszego widoku mogą używać `loading="lazy"`;
- `scripts/pwa-config.mjs` centralizuje budżety fontów i obrazu hero, a produkcyjny graf jest sprawdzany przez walidatory Vite/PWA i skupione testy przeglądarkowe;
- produkcja używa jednego haszowanego bundla CSS i jednego JavaScript z `/build/`, bez requestów do kanonicznych `/css/`, `/js/` lub wycofanego `assets/build/`.

Sekcja opisuje zastosowane mechanizmy; repozytorium nie przechowuje wyniku Lighthouse ani innej aktualnej metryki wydajnościowej.

### Kontekst projektu

Lauren English jest projektem portfolio KP_Code Digital Studio. Informacje o pochodzeniu projektu i jego kontekście portfolio pozostają w dokumentacji repozytorium oraz w portfolio KP_Code; publiczny interfejs koncentruje się na treściach edukacyjnych i nie wyświetla komunikatu przy pierwszej wizycie.

### Dane i trwałość stanu

- `js/data/packages.js` przechowuje trzy pakiety `start`, `regular` i `intensive`; homepage i `pakiety.html` korzystają z tych samych rekordów.
- `js/data/materials.js` zawiera statyczny katalog, a `materialAccess.js` i `materialFilters.js` centralizują stany dostępu, powiązania z pakietami i filtrowanie.
- dziennik postępów zapisuje cele i maksymalnie czternaście dni check-inów w `localStorage` pod kluczem `lauren_progress_v1`; dane można zresetować lub pobrać jako JSON.
- wybrany motyw jest również zapisywany lokalnie, z bezpiecznym fallbackiem pamięciowym, gdy Web Storage jest niedostępny.

Stan dziennika nie jest synchronizowany z kontem, bazą danych ani zdalną kopią zapasową. Formularz kontaktowy jest niezależną integracją Netlify Forms.

### Licencja

Lauren English jest własnościowym projektem Kamila Króla — KP_Code. Publiczny kod można przeglądać w portfolio oraz uruchamiać lokalnie do prywatnej, niekomercyjnej oceny. Kopiowanie, redystrybucja, publiczne wdrożenie, tworzenie utworów zależnych lub wykorzystanie komercyjne wymaga uprzedniej pisemnej zgody.

Pełne warunki, w których polska wersja jest rozstrzygająca, zawiera [LICENSE.md](LICENSE.md).

### Atrybucje

- Font Inter 4.001 pochodzi z oficjalnego projektu [rsms/inter](https://github.com/rsms/inter) w rewizji [`66647c0bb`](https://github.com/rsms/inter/commit/66647c0bb) i jest dołączony na licencji SIL Open Font License 1.1; tekst licencji znajduje się w [assets/fonts/OFL-Inter.txt](assets/fonts/OFL-Inter.txt).
- Font Literata jest dołączony na licencji SIL Open Font License 1.1; tekst licencji znajduje się w [assets/fonts/OFL-Literata.txt](assets/fonts/OFL-Literata.txt).
- Wykorzystane inline SVG pochodzą z Font Awesome Free v7.3.1. Oryginalne komentarze licencyjne są zachowane przy ikonach, zgodnie z [warunkami Font Awesome Free](https://fontawesome.com/license/free).

## EN

### Project Overview

Lauren English is a static multi-page educational website presenting an individual English-learning offer. The repository includes the homepage, services, packages, a materials catalogue, a browser-local progress journal, contact, legal documents, and technical pages for errors, offline mode, and form submission confirmation.

Each route is a standalone HTML document. The shared shell, metadata, and data-backed content are assembled by static Node.js scripts. `npm run build` creates the complete `dist/` output, where production HTML loads hashed CSS and JavaScript from `/build/` and the Service Worker consumes the final Vite graph. Canonical sources remain outside `dist/`; the project uses neither a frontend framework nor SPA routing.

### Live Version

[Open Lauren English](https://education-pr01-laurenenglish.netlify.app/)

### Key Features

- responsive shared header, focus-trapped mobile navigation, active navigation states, and a light/dark theme toggle;
- package and material data maintained in JavaScript modules and rendered to HTML at build time;
- a materials catalogue available without JavaScript and progressively enhanced with category, level, and access filters;
- a browser-local progress journal with weekly goals, daily check-ins, statistics, reset, and JSON export;
- a contact form configured for Netlify Forms with a honeypot and thank-you-page redirect;
- an FAQ accordion, anchor navigation with focus transfer, and animations that respect `prefers-reduced-motion`;
- generated SEO metadata, an application manifest, a Service Worker, and a dedicated offline fallback.

### Tech Stack

- **Runtime:** semantic HTML5, CSS, and Vanilla JavaScript using native ES modules;
- **CSS:** design tokens, BEM, mobile-first layouts, PostCSS, `postcss-import`, and cssnano;
- **Build:** static Node.js ESM scripts, multi-page Vite with PostCSS, and Sharp for images;
- **Development:** npm with `package-lock.json` and the Vite development server with HMR for local preview;
- **Code quality:** ESLint, Prettier, and project validators for HTML, content, data, CSS, SEO, PWA, and the production output;
- **Browser testing:** Playwright with Chromium desktop and mobile projects;
- **Hosting integration:** Netlify Forms, `_redirects` rules, and `netlify.toml` with manual `dist/` deployment.

### Architecture

- `scripts/shared-shell.mjs` generates the shared skip link, header, navigation, and footer for six public pages and three legal pages.
- `scripts/site-config.mjs` is the registry for routes, metadata, indexing policy, and public SEO assets.
- `scripts/content-renderers.mjs` connects data from `js/data/` with marked package and material regions in HTML.
- `css/style.css` preserves the `tokens → base → utilities → components → sections → pages` layer order.
- `js/main.js` initializes isolated feature modules; each module guards its DOM queries and exits when its component is absent from the page.
- `vite.config.mjs` derives twelve HTML inputs from the page registry and writes hashed production assets to `dist/build/`.
- `service-worker.template.js`, `scripts/pwa-config.mjs`, and the final Vite graph are the sources for the production `dist/service-worker.js`.

Root HTML files contain canonical page-specific content, but regions marked with `seo:*`, `shared-shell:*`, `package-*`, and `materials-*` comments must not be edited manually. `sitemap.xml`, `robots.txt`, and `_redirects` are generated routing assets. `.vite-public/` is temporary staging, while the complete `dist/` directory—including HTML, bundles, and the Service Worker—is generated publish output and must not be maintained manually.

### Project Structure

```text
.
├── index.html                 # homepage
├── uslugi.html                # services
├── pakiety.html               # package comparison
├── materialy.html             # materials catalogue
├── postepy.html               # browser-local progress journal
├── kontakt.html               # contact details and Netlify form
├── polityka-prywatnosci.html  # legal documents
├── regulamin.html
├── cookies.html
├── 404.html                   # technical pages
├── offline.html
├── thank-you.html
├── css/                       # tokens, base layers, components, sections, and pages
├── js/
│   ├── data/                  # packages, materials, access, filters, and progress definitions
│   ├── modules/               # interaction modules
│   ├── pages/                 # page logic
│   └── state/                 # safe browser-state operations
├── scripts/                   # assemblers, renderers, validators, and development server
├── assets/                    # source and public images, icons, fonts, and PWA assets
├── tests/e2e/                 # Playwright tests
├── docs/                      # architecture and workflow documentation
├── .vite-public/              # generated Vite public staging
├── dist/                      # generated publish directory
├── service-worker.template.js
├── service-worker.js          # root compatibility output for the older workflow
├── vite.config.mjs
├── playwright.config.mjs
├── netlify.toml               # Vite build and dist/ publish contract
├── site.webmanifest
├── package.json
└── LICENSE.md
```

### Installation

The repository uses npm and includes a committed `package-lock.json` using lockfile format v3. Clean installation for local development, verification, browser tests, and deployment preparation always reproduces this reviewed dependency graph:

```powershell
npm ci
npx playwright install chromium
```

`npm install` is reserved exclusively for intentionally adding, removing, or updating dependencies together with the corresponding `package.json` and `package-lock.json` changes; it is not a routine project setup command.

The supported contract is Node.js `>=22.14.0 <23` (the Node 22 line) and npm `10.9.2`. `.nvmrc` selects the locally verified Node.js `22.14.0`, while `packageManager` pins npm `10.9.2`; `engines` expresses compatibility but does not install a runtime.
### Local Development

```powershell
npm run dev
```

The command assembles HTML, prepares the `.vite-public/` staging directory, and starts the Vite development server, which serves the canonical project root—not `dist/`—at `http://localhost:5173/`. The port is pinned (`strictPort`), so an occupied port fails the start instead of silently moving the origin. A change to an assembler dependency (`scripts/shared-shell.mjs`, the page configuration, a renderer, or canonical data) reruns `npm run build:html`, and Vite reloads the page once the generated HTML is written. On this port, the application removes only its own local Service Worker registration and caches prefixed with `lauren-english-v`, preventing PWA state from masking source changes.

### Available Scripts

- `npm run dev` — assembles HTML, prepares public staging, and starts the Vite development server on port `5173`;
- `npm run build` — creates the complete production `dist/` directory and generates its Service Worker;
- `npm run prepare:vite-public` — recreates ignored `.vite-public/` staging for assets copied without transformation;
- `npm run check:vite` / `npm run check:pwa:vite` — validates the production graph and PWA contract inside `dist/`;
- `npm run build:html` / `npm run check:html` — updates or read-only checks HTML regions and routing assets;
- `npm run build:sw` / `npm run build:sw:vite` — generates the source-level root worker or production `dist/service-worker.js`, respectively;
- `npm run check:data` / `npm run check:content` — validates package and material data plus public-content integrity;
- `npm run check:css` — checks CSS architecture, theme tokens, and defined contrast pairs;
- `npm run check:seo` / `npm run check:pwa` — checks source metadata, routing, and PWA contracts;
- `npm run check:release` — runs the aggregate non-writing static release gate;
- `npm run lint:js` — runs ESLint for the project’s canonical JavaScript and module sources;
- `npm run test:e2e` — builds through Vite, serves only `dist/`, and runs the complete Playwright suite;
- `npm run test:e2e:smoke`, `npm run test:e2e:interactions`, `npm run test:e2e:theme`, `npm run test:e2e:responsive`, `npm run test:e2e:seo`, `npm run test:e2e:pwa` — run focused suites against `dist/`; `npm run test:e2e:pwa:vite` preserves the isolated Vite PWA contract;
- `npm run build:pwa-screenshots` — recreates the screenshots declared by the manifest;
- `npm run images` — generates deterministic JPEG fallbacks and AVIF and WebP variants for configured content images from canonical originals;
- `npm run check:images` — read-only checks every configured image output against its canonical original;
- `npm run format` — formats supported source files with Prettier.

### Production Build

```powershell
npm run build
```

`build` runs the HTML assembler, `.vite-public/` preparation, the multi-page Vite build, and the Service Worker generator for the output. It produces twelve HTML documents, hashed CSS and JavaScript bundles under `dist/build/`, required routing and static assets, and `dist/service-worker.js` derived from the final graph.

Canonical sources remain in the root HTML files and the `css/`, `js/`, `scripts/`, and `assets/image-sources/` directories. `dist/` is ignored, reproducible publish output, and none of its files should be edited manually.

`npm run check:vite` validates pages, hashed bundles, required assets, and the absence of direct-source paths, while `npm run check:pwa:vite` validates the production manifest, precache, and worker. The root `service-worker.js`, generated by `npm run build:sw` and validated by `npm run check:pwa`, remains a source-level contract and is not published.

### Images

Canonical editable originals for configured raster images live in `assets/image-sources/`. The `scripts/image-config.mjs` registry maps them to public paths under `assets/img/` and currently covers the homepage hero, contact hero, and Lauren portrait. Public JPEG fallbacks and AVIF and WebP variants are generated outputs and must not be edited as source files.

Run `npm run images` to regenerate the configured JPEG fallbacks and AVIF and WebP variants under `assets/img/` from the canonical originals. The script first validates the presence, readability, and dimensions of every canonical source; a preflight error stops it before any write. A missing original is never recreated automatically from a public fallback. `npm run check:images` recreates expected outputs in memory and detects missing or mismatched files without writing; AVIF is compared as decoded samples with strict bounds so codec-version differences do not force binary churn. In HTML, use native `<picture>` in AVIF, WebP, then JPEG fallback `<img>` order while preserving accessibility attributes, dimensions, and loading strategy. Image generation remains a separate step outside `npm run build`; public outputs are intentionally tracked and must be refreshed through `npm run images` after a canonical original changes.

### Testing and Validation

The project provides static validators for data, public content, HTML, CSS, SEO, and the source PWA contract, plus separate `check:vite` and `check:pwa:vite` commands for generated `dist/`. They complement rather than replace browser tests.

#### Non-writing release gate

```powershell
npm run check:release
```

The command runs `check:data`, `check:content`, `check:html`, `check:css`, `check:seo`, `check:images`, `check:pwa`, and `lint:js` in order. Every step only reads source, configuration, or tracked output, or lints it; the command does not generate, format, start a server, or change files.

`npm run images`, `npm run build`, generated `dist/` validation through `check:vite` and `check:pwa:vite`, Playwright, visual checks, and deployment remain separate workflows.


The main Playwright configuration automatically runs `npm run build` and then serves only `dist/` through Vite preview on port `4173`. Chromium runs projects at `1440 × 900` and `390 × 844`, with one worker and Service Workers blocked by default. PWA suites enable them explicitly; the isolated Vite PWA contract uses a separate configuration on port `4274`.

The complete entrypoint and focused smoke, interactions, theme, responsive, SEO, and PWA suites remain available. Tests cover routes, the shared shell, themes, keyboard interactions, responsive behavior, metadata, final assets, caching, and offline behavior.

Results of completed validation are documented in the relevant audit or release record.

### Deployment

The public deployment remains available at the URL listed under “Live Version.” Root `netlify.toml` defines `npm run build` as the build command and `dist` as the publish directory.

Production deployment is started manually from the terminal for the existing Netlify project. The repository defines neither commit- or push-triggered deployment nor GitHub-connected continuous deployment.

Before manual publication, reproduce the committed dependency graph with `npm ci`, build and verify `dist/`, and then publish that directory without manual edits. The copied `_redirects` handles the `/thank-you` alias, while the form in `dist/kontakt.html` retains Netlify Forms attributes, the `bot-field` honeypot, and `/thank-you.html` as its destination.

### Accessibility

The project states WCAG 2.2 AA as a target and implements concrete mechanisms supporting that direction without claiming formal conformance:

- semantic landmarks, one `h1` per page, logical headings, and a skip link;
- native form controls, visible labels, required-field communication, and `:focus-visible` styles;
- a mobile drawer with `aria-expanded`, `aria-hidden`, `inert`, focus trapping, `Escape` handling, and focus return;
- accordion and filters with synchronized ARIA state and keyboard support;
- focus transfer to the destination section heading after hash navigation;
- reduced non-essential motion through `prefers-reduced-motion`;
- a project contrast validator for explicitly defined light- and dark-theme pairs.

### SEO

`scripts/site-config.mjs` defines six indexable pages and six technical or legal pages marked `noindex, nofollow`. The generator gives indexable pages individual titles and descriptions, canonical links, Open Graph, Twitter Card, and `WebSite` or `WebPage` JSON-LD.

`npm run build:html` keeps the metadata synchronized with `sitemap.xml`, `robots.txt`, and `_redirects`. The canonical social image is the local `assets/og/og.png` file sized `1200 × 630`; technical pages receive neither canonical links nor social metadata.

### PWA and Offline Support

`site.webmanifest` declares `standalone` display mode, `192 × 192` and `512 × 512` icons, three shortcuts, and screenshots for wide and narrow views. The Service Worker is registered after page load outside the local development environment on port `5173`.

Production `dist/service-worker.js` is generated after the Vite build. Its precache contains all twelve published documents, discovered hashed runtime assets, local fonts, branding, theme and manifest icons, and required images; manifest screenshots remain outside the precache. Navigation is network-first, preserves real HTTP responses, and returns a cached known document or `offline.html` when the network is unavailable. Activation removes only older caches using the project prefix.

### Performance

- the runtime has no framework dependencies or external scripts;
- Inter and Literata are served locally as WOFF2 with `font-display: swap`, while the head preloads only the critical Literata 700 file;
- important images have explicit dimensions, the hero uses `fetchpriority="high"`, and below-the-fold images can use `loading="lazy"`;
- `scripts/pwa-config.mjs` centralizes font and hero-image budgets, while Vite/PWA validators and focused browser tests inspect the production graph;
- production uses one hashed CSS and one JavaScript bundle from `/build/`, without requests to canonical `/css/`, `/js/`, or retired `assets/build/` paths.

This section describes implemented mechanisms; the repository does not store a Lighthouse result or another current performance metric.

### Project Provenance

Lauren English is a KP_Code Digital Studio portfolio project. Project provenance and portfolio context remain in repository documentation and the KP_Code portfolio; the public interface focuses on educational content and does not display a first-visit notice.

### Data and State Persistence

- `js/data/packages.js` stores the three `start`, `regular`, and `intensive` packages; the homepage and `pakiety.html` use the same records.
- `js/data/materials.js` contains the static catalogue, while `materialAccess.js` and `materialFilters.js` centralize access states, package relationships, and filtering.
- the progress journal stores goals and up to fourteen days of check-ins in `localStorage` under `lauren_progress_v1`; users can reset the data or download it as JSON.
- the selected theme is also stored locally, with an in-memory fallback when Web Storage is unavailable.

Journal state is not synchronized with an account, database, or remote backup. The contact form is a separate Netlify Forms integration.

### License

Lauren English is a proprietary project owned by Kamil Król — KP_Code. The public source may be reviewed as portfolio work and run locally for private, non-commercial evaluation. Copying, redistribution, public deployment, derivative use, or commercial use requires prior written permission.

Full terms, with the Polish version prevailing, are available in [LICENSE.md](LICENSE.md).

### Attributions

- Inter 4.001 comes from the official [rsms/inter](https://github.com/rsms/inter) project at revision [`66647c0bb`](https://github.com/rsms/inter/commit/66647c0bb) and is included under the SIL Open Font License 1.1; the license text is available in [assets/fonts/OFL-Inter.txt](assets/fonts/OFL-Inter.txt).
- Literata is included under the SIL Open Font License 1.1; the license text is available in [assets/fonts/OFL-Literata.txt](assets/fonts/OFL-Literata.txt).
- Inline SVGs are sourced from Font Awesome Free v7.3.1. Original license comments are preserved next to the icons in accordance with the [Font Awesome Free terms](https://fontawesome.com/license/free).
