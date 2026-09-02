# Kontrakt poleceń npm

Plik `package.json` jest wykonywalnym źródłem prawdy. Poniższy opis rozróżnia codzienny szybki zestaw, skupione testy E2E i pełną bramkę jakości.

## Główne punkty wejścia

### `dev`

- **Command:** `live-server --host=127.0.0.1 --port=4183 --ignore=node_modules,dist`
- **Purpose:** Serwuje katalog źródłowy pod `http://127.0.0.1:4183` z przeładowaniem po zmianie plików; port leży poza zakresem serwerów QA.
- **Use:** Codzienna praca nad źródłami. Nie buduje `dist/` i nie zastępuje serwerów uruchamianych przez skrypty QA.

### `build`

- **Command:** `node scripts/build-dist.mjs`
- **Purpose:** Czyści `dist/`, buduje minifikowane `css/style.min.css` i `js/script.min.js`, kopiuje wymagane zasoby i przepisuje odwołania HTML na artefakty produkcyjne.
- **Use:** Standardowe przygotowanie katalogu produkcyjnego. Czytelne pliki źródłowe pozostają w `css/` i `js/`; pliki `.min.*` istnieją wyłącznie w `dist/`.

### `lint`

- **Command:** `npm run lint:js && npm run lint:css && npm run lint:text`
- **Purpose:** Agreguje lint JavaScriptu, CSS i publicznego tekstu.
- **Use:** Po zmianach źródłowych, przed `qa:fast`.

### `qa:fast`

- **Command:** `npm run lint && npm run qa:html && npm run qa:links && npm run qa:seo && npm run qa:schema && npm run qa:csp`
- **Purpose:** Szybka, niezmieniająca plików kontrola źródeł i integralności projektu bez szerokich testów przeglądarkowych oraz Lighthouse.
- **Use:** Codzienna bramka podczas pracy.

### `test:e2e`

- **Command:** `npm run test:e2e:reservation && npm run test:e2e:demo-legal && npm run test:e2e:scroll-to-top && npm run test:e2e:legal-tables && npm run test:e2e:lightbox && npm run test:e2e:gallery-status`
- **Purpose:** Uruchamia deterministycznie sześć skupionych regresji przeglądarkowych.
- **Use:** Po zmianach interakcji formularza, dialogu, wspólnego sterowania przewijaniem, responsywnego osadzania tabel prawnych, lightboxa galerii i podglądu dania lub statusu ukończenia galerii.

### `qa`

- **Command:** `npm run qa:fast && npm run qa:nojs && npm run test:e2e && npm run qa:a11y && npm run qa:lighthouse`
- **Purpose:** Najpełniejsza skonfigurowana bramka jakości: szybkie QA, zachowanie bez JavaScriptu, skupione E2E, automatyczna dostępność i Lighthouse CI.
- **Use:** Przed wydaniem lub jako pełny pipeline jakości. Jest wyraźnie droższa od `qa:fast`.

## Skrypty lintujące

- `lint:js` — `eslint --max-warnings 0 "js/**/*.js" "scripts/**/*.mjs"`.
- `lint:css` — `stylelint --max-warnings 0 "css/**/*.css"`.
- `lint:text` — `node scripts/text-lint.mjs`.

## Skrypty QA

- `qa:html` — waliduje osiem stron źródłowych przez HTML-Validate.
- `qa:links` — sprawdza lokalne linki i kotwice.
- `qa:seo` — sprawdza metadane SEO, canonicale i JSON-LD.
- `qa:schema` — egzekwuje politykę obecności JSON-LD na właściwych stronach.
- `qa:csp` — tylko sprawdza, czy hashe CSP w `_headers` są aktualne; nie zapisuje pliku.
- `qa:nojs` — sprawdza bazowe zachowanie stron bez JavaScriptu w przeglądarce.
- `qa:a11y` — uruchamia automatyczny audyt Playwright + axe na ośmiu stronach w dwóch jawnych stanach: pierwszej wizyty z otwartym modalem informacyjnym oraz stanu po akceptacji, czyli pełnej strony osiąganej przez kliknięcie wysyłanego z projektem przycisku akceptacji. Przed każdym skanem axe weryfikuje warunki wstępne stanu — widoczność i `aria-hidden` modala, kontrakt `inert` na tle oraz obecność treści głównej w drzewie dostępności Chromium — więc wynik nie może zostać zgłoszony dla niewłaściwego stanu strony. Wynik raportowany jest osobno dla każdej pary strona–stan. Pełne pokrycie po akceptacji obejmuje wszystkie osiem stron; skan modal-open dotyczy wyłącznie stron faktycznie zawierających modal, a strony narzędziowe bez niego (`offline.html`, `404.html`) zgłaszają jawne pominięcie tego stanu zamiast sztucznie tworzonego modala. Na koniec wykonywana jest kontrola negatywna: wyłącznie w czasie działania wstrzykiwany jest niepoprawny obraz poza modalem, co potwierdza, że skan pełnej strony go wykrywa i na nim nie przechodzi, a skan modal-open go nie widzi; zaszczepiony znacznik nigdy nie trafia do źródeł projektu.
- `qa:lighthouse` — uruchamia Lighthouse CI zgodnie z `lighthouserc.json`.
- `qa:server` — sprawdza odpowiedzi lokalnego serwera statycznego używanego przez narzędzia jakości; nie potwierdza działania wdrożenia publicznego.

## Skupione testy E2E

- `test:e2e:reservation` — regresje wysyłania formularza rezerwacji i natywnego fallbacku.
- `test:e2e:demo-legal` — regresje początkowego dialogu informacyjnego i jego pamięci akceptacji.
- `test:e2e:scroll-to-top` — regresje wspólnego przycisku przewijania do góry.
- `test:e2e:legal-tables` — regresje poziomego przepełnienia, dostępności i obsługi klawiaturą tabel na stronach prawnych przy szerokościach 320 px i 390 px.
- `test:e2e:lightbox` — regresje przywracania stanu dokumentu przez lightbox galerii: dokładna poprzednia wartość `scroll-behavior` w stylu inline elementu głównego, zachowana pozycja przewijania i powrót fokusu do klikniętego elementu galerii we wszystkich obsługiwanych ścieżkach zamknięcia (przycisk zamykania, Escape/cancel, tło i natywne zamknięcie dialogu). Sprawdza też kontrakt trybów: galeria otwiera sesję przeglądaną z licznikiem oraz nawigacją, a podgląd dania w menu pozostaje pojedynczy, z ukrytymi i niedostępnymi z klawiatury przyciskami nawigacji.
- `test:e2e:gallery-status` — regresje ukończonego statusu galerii: treść statusu dokładnie równa `Wszystko załadowane`, bez zbędnych znaków i obcych węzłów tekstowych, dekoracyjna ikona SVG wykluczona z drzewa dostępności oraz niezmienione filtrowanie galerii i moment pojawienia się stanu ukończonego.

## CSP

- `csp:hash` — regeneruje hashe skryptów inline w `_headers`; jest jawnym poleceniem utrzymaniowym zmieniającym plik.
- `qa:csp` — wykonuje wyłącznie weryfikację i należy do `qa:fast` oraz pełnego `qa`.

## Obrazy

- `img:opt` — generuje skonfigurowane warianty WebP i AVIF.
- `img:webp` — generuje tylko warianty WebP.
- `img:avif` — generuje tylko warianty AVIF.
- `img:clean` — usuwa katalog `assets/img/_optimized`; używaj świadomie przed pełną regeneracją.
- `img:verify` — sprawdza obecność i spójność wygenerowanych wariantów obrazów.
