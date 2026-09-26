# settings.md

## Rola dokumentu i źródła definicji

Ten dokument jest miejscem utrzymania szczegółowej dokumentacji operacyjnej publicznych poleceń npm: ich wymagań, zachowania, wyboru pojedynczych kontroli i ograniczeń. Wykonywalne definicje pozostają w [`package.json`](../package.json) oraz wskazanych niżej skryptach i konfiguracjach; opis nie zastępuje tych plików.

[`README.md`](../README.md) pozostaje dwujęzycznym przewodnikiem po instalacji, pracy lokalnej, buildzie, weryfikacji i wdrożeniu. [`CONTEXT-PROJECT.md`](CONTEXT-PROJECT.md) utrzymuje kontrakty architektury, własność źródeł i relacje między dev, buildem, QA, CI i publikacją. Po zmianie poleceń aktualizuj szczegóły tutaj, a w pozostałych dokumentach tylko dotknięte instrukcje wejściowe lub kontrakty i odsyłacze.

## Wymagania

Polecenia uruchamiaj z katalogu głównego repozytorium po `npm ci`. Wymagane są Node.js i npm; zalecany jest Node.js 22, zgodnie z CI. Zależności w `package-lock.json` mają własne wymagania wersji Node.js; projekt nie przypina dokładnej lokalnej wersji ani nie deklaruje `engines` w `package.json`.

## Publiczny workflow

`npm run dev` → `npm run qa` → `npm run build` → `npm run preview` → `npm run qa:dist`.

Dev i preview używają portu 5173; uruchamiaj je osobno. Przed `qa`, `qa:dist`, `qa:server` lub `qa:dist:server` zatrzymaj ręczny serwer, aby runner QA miał wolny port i mógł uruchomić właściwy serwer. Bezpośrednie kontrole `qa:links`, `qa:links:external` i `qa:a11y` wymagają natomiast działającego dev albo preview pod `http://127.0.0.1:5173`. QA źródeł nie generuje produkcji, QA dist nie przebudowuje paczki; przed preview lub kontrolą dist wykonaj `npm run build`.

Runner QA używa API http-server w tym samym procesie: dla źródeł uruchamia ten sam składający serwer co `npm run dev`, dla dist zwykły http-server. Domyślnie sprawdza linki, następnie dostępność; zamyka serwer także po błędzie i nie wymaga ps-tree/wmic.exe. Przykłady wyboru jednej kontroli znajdują się przy [`qa:server`](#qaserver) i [`qa:dist:server`](#qadistserver).

Poniższe opisy dotyczą skonfigurowanych kontroli, nie wyników ich wykonania. Automatyczny audyt nie potwierdza pełnej zgodności WCAG, dostawy formularza, instalowalności PWA ani działania wdrożonej witryny.

## package.json scripts

### `dev`

- command: `npm run dev`
- definition: [`scripts/dev-server.js`](../scripts/dev-server.js)
- what it does: Serwuje źródła repozytorium na 127.0.0.1:5173 bez cache i bez builda. Każdą stronę (`/`, `/strona.html`, `/strona`) składa w pamięci z szablonu i partiali przy każdym żądaniu; nieistniejący adres zwraca złożoną stronę 404 ze statusem 404. Błąd składania daje odpowiedź 500 w postaci tekstu wskazującego stronę. CSS, moduły ES, bootstrap, dane i zasoby serwuje bez zmian. Nie zapisuje plików, nie obserwuje zmian ani nie minifikuje; zmiana źródeł jest widoczna po odświeżeniu. Szablon otwarty bezpośrednio z dysku nie zawiera nagłówka ani stopki. Rejestracja Service Workera przez `js/bootstrap.js` jest pomijana na localhost, 127.0.0.1 i ::1.

### `build`

- command: `npm run build`
- definition: [`package.json`](../package.json); etapy opisano poniżej przy `build:static`, `build:css`, `build:js` i `qa:dist:integrity`.
- what it does: Najpierw sprawdza obecność wymaganych plików i składa wszystkie 11 stron z szablonów i partiali; błąd na tym etapie pozostawia poprzedni dist. Następnie zastępuje dist złożonymi stronami, zasobami runtime i konfiguracją hostingu, przekształca referencje HTML/SW, buduje CSS oraz oba wejścia JS i sprawdza kompletność. Nie generuje obrazów ani nie kopiuje assets/img-src/. Szczegóły kontroli i postępowanie przy niezgodnym skrócie precache opisuje [`qa:dist:integrity`](#qadistintegrity).

### `preview`

- command: `npm run preview`
- definition: [`package.json`](../package.json)
- what it does: Serwuje wyłącznie istniejący dist na 127.0.0.1:5173 bez cache. Najpierw build; zatrzymaj dev.

### `qa`

- command: `npm run qa`
- definition: [`package.json`](../package.json); poszczególne kontrole opisano poniżej.
- what it does: Waliduje źródła: ESLint, kontrakt zasobów i partiali, HTML złożonych stron oraz linki/fragmenty/CSS i dostępność na składającym serwerze dev.

### `qa:dist`

- command: `npm run qa:dist`
- definition: [`package.json`](../package.json); poszczególne kontrole opisano poniżej.
- what it does: Waliduje istniejącą produkcję: kompletność, HTML oraz linki/fragmenty/CSS i dostępność na preview. Nie buduje.

### `build:static`

- command: `npm run build:static`
- definition: [`scripts/build-dist.js`](../scripts/build-dist.js), [`scripts/build-config.js`](../scripts/build-config.js)
- what it does: Składa wszystkie strony z szablonów i partiali, zanim usunie dist; błąd składania pozostawia poprzedni dist. Następnie zastępuje dist statycznymi plikami runtime, złożonymi stronami HTML i kopią SW. Nie minifikuje.

### `build:css`

- command: `npm run build:css`
- definition: [`package.json`](../package.json), [`postcss.config.js`](../postcss.config.js)
- what it does: PostCSS/postcss-import/cssnano przetwarza css/style.css; wyjście wyłącznie dist/css/style.min.css, bez source map.

### `build:js`

- command: `npm run build:js`
- definition: [`package.json`](../package.json)
- what it does: esbuild bundluje i minifikuje oba wejścia js/script.js i js/core.js dla targetu es2018; wyjście wyłącznie dist/js/script.min.js i dist/js/core.min.js.

### `images:build`

- command: `npm run images:build`
- definition: [`scripts/images/build-images.js`](../scripts/images/build-images.js)
- what it does: Osobny generator obrazów assets/img-src/ → assets/img-optimized/. Zastępuje zawartość katalogu wynikowego wariantami odpowiadającymi źródłom i kopiuje SVG; wynik pozostaje śledzony w Git. Nie jest częścią builda.

### `lint`

- command: `npm run lint`
- definition: [`package.json`](../package.json), [`eslint.config.mjs`](../eslint.config.mjs)
- what it does: ESLint dla `js/**/*.js`, Service Workera `sw.js` i `scripts/**/*.js`; konfiguracja flat config ustawia odpowiednie zmienne globalne i typ modułu dla kodu przeglądarki, workera i Node.js.

### `qa:source`

- command: `npm run qa:source`
- definition: [`scripts/validate-dist.js`](../scripts/validate-dist.js)
- what it does: Sprawdza brak wygenerowanych minifikowanych plików w css/js oraz kontrakty złożonych stron, w tym znaczniki partiali i brak ręcznie wklejonego nagłówka lub stopki w szablonach.

### `qa:html`

- command: `npm run qa:html`
- definition: [`scripts/qa-html.js`](../scripts/qa-html.js), [`scripts/build-config.js`](../scripts/build-config.js), [`.htmlvalidate.json`](../.htmlvalidate.json)
- what it does: Waliduje html-validate 11 złożonych stron źródłowych z konfiguracją .htmlvalidate.json, takich jak z `npm run dev`. Każdy komunikat zachowuje stronę oraz linię i kolumnę w złożonym HTML, a dodatkowo wskazuje kanoniczny plik do edycji i jego oryginalną linię (szablon strony lub partials/header.html albo partials/footer.html). Kolumny źródłowe nie są przeliczane; brak wiarygodnego mapowania jest jawnie zgłaszany przy zachowaniu diagnostyki złożonej strony.

### `qa:links`

- command: `npm run qa:links`
- definition: [`scripts/qa-links.js`](../scripts/qa-links.js)
- what it does: Sprawdza wszystkie 11 stron, lokalne linki, zasoby, fragmenty, importy CSS i fonty. Pomija zewnętrzne adresy, a nie bundle produkcyjne. Wymaga działającego dev albo preview na porcie 5173.

### `qa:links:external`

- command: `npm run qa:links:external`
- definition: [`scripts/qa-links.js`](../scripts/qa-links.js)
- what it does: Opcjonalnie sprawdza również linki zewnętrzne na działającym serwerze.

### `qa:a11y`

- command: `npm run qa:a11y`
- definition: [`package.json`](../package.json), [`.pa11yci`](../.pa11yci)
- what it does: pa11y-ci, WCAG2AA/htmlcs, 12 scenariuszy — wszystkie 11 stron po załadowaniu oraz `contact.html?a11y=form-errors`. Dodatkowy scenariusz akceptuje informację demo, przenosi fokus przez trzy puste pola i czeka na `aria-invalid="true"` oraz niepuste komunikaty błędów dla każdego pola. Wymaga działającego dev albo preview na porcie 5173; nie sprawdza wysyłki formularza ani wszystkich jego stanów, np. komunikatu po próbie wysłania.

### `qa:server`

- command: `npm run qa:server`
- definition: [`scripts/qa-server.js`](../scripts/qa-server.js)
- what it does: Zarządza składającym serwerem dev (scripts/dev-server.js) na 127.0.0.1:5173. Domyślnie uruchamia linki, następnie pa11y; nie wymaga builda.
- focused usage: `npm run qa:server -- --check=links` uruchamia tylko kontrolę linków; `npm run qa:server -- --check=a11y` tylko dostępność. Selektor można podać raz, wyłącznie w jednej z tych postaci; błędny wybór przerywa polecenie przed uruchomieniem serwera. Wybrana kontrola nie zastępuje pełnego `npm run qa`.

### `qa:dist:integrity`

- command: `npm run qa:dist:integrity`
- definition: [`scripts/validate-dist.js`](../scripts/validate-dist.js), [`scripts/build-config.js`](../scripts/build-config.js), [`sw.js`](../sw.js)
- what it does: Sprawdza 11 stron, zasoby, CSS, manifest, obrazy menu, bootstrap i precache SW; porównuje każdą stronę dist ze złożonym szablonem po przekształceniu produkcyjnym; odrzuca źródła, znaczniki i partiale w dist. Oblicza również SHA-256 z wpisów `FILES_TO_CACHE` i wskazanych plików w dist, normalizując końce linii plików tekstowych do LF, i porównuje go z `PRECACHE_FINGERPRINT` w `sw.js`. Niezgodność przerywa kontrolę oraz `npm run build` i wypisuje `CACHE_VERSION`, zapisany oraz obliczony skrót. Dla wydania zmieniającego precache należy podnieść `CACHE_VERSION`, zapisać obliczony fingerprint i ponowić build; kontrola nie sprawdza wzrostu wersji względem poprzedniego wydania.

### `qa:dist:html`

- command: `npm run qa:dist:html`
- definition: [`package.json`](../package.json), [`.htmlvalidate.json`](../.htmlvalidate.json)
- what it does: Waliduje wyłącznie HTML w dist.

### `qa:dist:server`

- command: `npm run qa:dist:server`
- definition: [`scripts/qa-server.js`](../scripts/qa-server.js)
- what it does: Zarządza serwerem preview na 127.0.0.1:5173 dla istniejącego `dist/`. Domyślnie uruchamia linki, następnie pa11y. Wymaga wcześniejszego `npm run build`; sam nie buduje paczki.
- focused usage: `npm run qa:dist:server -- --check=links` uruchamia tylko kontrolę linków; `npm run qa:dist:server -- --check=a11y` tylko dostępność. Selektor działa razem z `--dist` ustawionym przez ten skrypt npm i podlega tym samym zasadom co w `qa:server`. Wybrana kontrola nie zastępuje pełnego `npm run qa:dist`.

## Własność plików

Szablony stron w katalogu głównym, partials/header.html i partials/footer.html, css/style.css, moduły CSS, wejścia JS i sw.js są kanonicznymi źródłami. Wspólny nagłówek i stopka istnieją wyłącznie w partials/; szablony wskazują je znacznikami `<!-- partial:header -->` i `<!-- partial:footer -->`. scripts/build-config.js utrzymuje listę stron, rejestr partiali z composeHtml(), pliki runtime i mapowanie ścieżek. Build składa strony z partiali i zmienia tylko referencje zasobów w złożonych kopiach HTML i w kopii SW; bootstrap jest kopiowany bez zmian. dist/ pozostaje ignorowany. Nie generuj ani nie edytuj css/style.min.css, js/script.min.js ani js/core.min.js w źródłach.

Usunięte komendy build:dist, clean:dist, dev:server, validate:html, check* i osobne build:js:script/core są pokryte przez powyższy workflow. Nie zmieniono zależności ani targetu es2018.

## CI i ręczne wdrożenie

Wykonywalna konfiguracja CI znajduje się w [`.github/workflows/quality.yml`](../.github/workflows/quality.yml); kolejność publicznych poleceń opisuje [README](../README.md#ciągła-integracja). CI buduje i weryfikuje paczkę, ale jej nie publikuje.

Przed ręcznym wdrożeniem przez Netlify CLI wykonaj `npm run build` i publikuj wyłącznie `dist/`, w katalogu głównym domeny. Szablony źródłowe z markerami partiali nie są gotową witryną. Paczka zawiera `_headers` i `_redirects`; dostawa Netlify Forms zależy od konfiguracji hostingu i nie jest potwierdzana przez lokalne kontrole. Kontekst publikacji opisuje sekcja [Wdrożenie](../README.md#wdrożenie).
