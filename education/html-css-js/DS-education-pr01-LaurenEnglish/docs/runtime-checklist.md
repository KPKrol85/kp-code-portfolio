# Runtime checklist (prod)

## Build

- Odtwórz zatwierdzony graf zależności z `package-lock.json`: `npm ci`.
- Utwórz kompletny output publikacyjny: `npm run build`.
- Sprawdź dwanaście stron, haszowane bundle, zasoby i wykluczone ścieżki: `npm run check:vite`.
- Sprawdź produkcyjny manifest, precache i Service Worker: `npm run check:pwa:vite`.
- Sprawdź parity i semantykę wspólnego shellu: `npm run check:html`.
- Sprawdź integralność publicznych treści i destinations: `npm run check:content`.
- Sprawdź tokeny, selektory i kontrast obu motywów: `npm run check:css`.
- Sprawdź routing, indeksowanie, metadane, JSON-LD, sitemapę i robots: `npm run check:seo`.
- Po celowej zmianie UI odtwórz aktualne screenshoty manifestu: `npm run build:pwa-screenshots`.
- Potwierdź, że `dist/` zawiera:
  - wszystkie dokumenty z `ALL_PAGES` w `scripts/site-config.mjs`;
  - dokładnie jeden haszowany bundle CSS i jeden JavaScript w `dist/build/`;
  - wygenerowany `dist/service-worker.js`;
  - `site.webmanifest`, `sitemap.xml`, `robots.txt`, `_redirects` i wymagane katalogi `dist/assets/`;
  - screenshoty manifestu `dist/assets/pwa/screenshots/home-desktop-1280x720.png` i `dist/assets/pwa/screenshots/home-mobile-720x1280.png`.
- Sprawdź, czy `dist/service-worker.js` nie zawiera placeholderów, a rewizja cache ma postać `<version z package.json>-<12 znaków fingerprintu>`.
- Potwierdź, że `dist/` nie zawiera kanonicznych `css/`, `js/`, `scripts/`, `.vite-public/`, `assets/image-sources/`, lokalnej `.netlify/` ani raportów testowych.
- Rootowe `npm run build:sw` i `npm run check:pwa` pozostają kontraktem źródłowym; rootowy `service-worker.js` nie jest publikowany.

## Runtime assets

- Otwórz każdy opublikowany dokument z `ALL_PAGES` w `scripts/site-config.mjs` (`index.html`, `uslugi.html`, `pakiety.html`, `materialy.html`, `postepy.html`, `kontakt.html`, `404.html`, `offline.html`, `thank-you.html`, `polityka-prywatnosci.html`, `regulamin.html`, `cookies.html`) z serwera obsługującego `dist/` i w DevTools → Network upewnij się, że:
  - dokument ładuje dokładnie jeden haszowany CSS i jeden moduł JavaScript z `/build/`; aktualne ścieżki należy odkrywać z outputu Vite, bez hardkodowania hashy;
  - nie ma requestów do kanonicznych `/css/`, `/js/` ani wycofanego `/assets/build/`;
  - `/assets/img/logo/logo.svg` zwraca HTTP 200 z MIME `image/svg+xml` i jest pobierane tylko raz mimo użycia w headerze i footerze;
  - fonty Inter 400/600/700 i Literata 700 ładują się z `/assets/fonts/` jako `font/woff2`, bez odpowiedzi 404, duplikatów i zewnętrznych requestów; Inter 500 nie jest requestowany, a jedyny preload wskazuje Literata 700;
  - manifest, obrazy, ikony i pozostałe zasoby z finalnego grafu zwracają właściwe statusy i MIME;
  - konsola nie zawiera błędów modułów ani błędów ładowania zasobów.

## Lokalny development

- Uruchom `npm run dev`; polecenie składa HTML, przygotowuje `.vite-public/` i startuje serwer Vite wyłącznie na `http://localhost:5173/`.
- Potwierdź, że przypięty port (`strictPort`) zgłasza zajęty port błędem zamiast cichej zmiany adresu, a serwer pozostaje w foreground i zatrzymuje się po `Ctrl+C`.
- Potwierdź, że serwowany jest kanoniczny root projektu, a nie `dist/`, oraz że nieznana ścieżka pozostaje prawdziwym `404` bez fallbacku SPA.
- Zmień zwykłe źródło CSS/JS i potwierdź aktualizację w przeglądarce. Następnie zmień zależność assemblera (`scripts/shared-shell.mjs`, konfigurację strony, renderer lub kanoniczne dane) i potwierdź, że `npm run build:html` kończy się przed przeładowaniem.
- Wymuś błąd assemblera wyłącznie w kontrolowanej lokalnej próbie: konsola serwera ma pokazać błąd, poprzedni wygenerowany HTML ma pozostać nienaruszony, a kolejna poprawna zmiana ma przywrócić workflow. Nie zostawiaj uszkodzonych źródeł.
- Na porcie `5173` potwierdź wyrejestrowanie wyłącznie `/service-worker.js` oraz usunięcie wyłącznie cache `lauren-english-v*`; obce rejestracje i cache muszą pozostać.

## Responsive smoke test

- Sprawdź wszystkie opublikowane dokumenty z `ALL_PAGES` przy szerokości desktopowej i mobilnej.
- Potwierdź, że przy szerokościach 320, 390, 768, 1024 i 1440 px nagłówki Literata z polskimi znakami nie powodują nowych przesunięć, nakładania treści ani poziomego overflow.
- Na pierwszej wizycie strony indeksowanej potwierdź bezpośredni dostęp do treści bez blokującego dialogu oraz bez portfolio, koncepcyjnych, demonstracyjnych lub symulacyjnych komunikatów.

## Playwright E2E

- Odtwórz zatwierdzony graf zależności z `package-lock.json`: `npm ci`.
- Zainstaluj Chromium: `npx playwright install chromium`.
- Uruchom pełny zestaw przez `npm run test:e2e`; współdzielony serwer Playwrighta wykona `npm run build` i poda wyłącznie `dist/` przez Vite preview na porcie `4173`.
- W razie potrzeby uruchom osobno `npm run test:e2e:smoke`, `npm run test:e2e:interactions`, `npm run test:e2e:theme` lub `npm run test:e2e:responsive`; mapowania muszą pozostać zgodne z `package.json`.
- Routing i metadane uruchom przez `npm run test:e2e:seo`; trasy z `INDEXABLE_PAGES` i wymagane zasoby muszą zwracać `200`, a nieznane ścieżki prawdziwy HTTP `404` bez fallbacku SPA.
- Lifecycle i offline uruchom przez `npm run test:e2e:pwa`; izolowany kontrakt Vite PWA pozostaje dostępny jako `npm run test:e2e:pwa:vite` na porcie `4274`. Oba zestawy jawnie włączają Service Workery.
- Widoki bazowe to Chromium desktop `1440 × 900` oraz mobile `390 × 844`; responsive suite dodatkowo sprawdza szerokości 320, 768 i 1024 px.
- Raport HTML otwórz przez `npm run test:e2e:report`; lokalne `playwright-report/`, `test-results/` i `blob-report/` pozostają poza Git.
- Zwykłe E2E używa izolowanych kontekstów i blokuje Service Workery, aby nie korzystać ze starego cache ani zapisanego stanu; tylko zakres PWA przełącza `serviceWorkers` na `allow`.

## SEO i routing

- Potwierdź origin `https://education-pr01-laurenenglish.netlify.app` w `scripts/site-config.mjs`.
- Potwierdź, że canonical i `og:url` są identyczne na wszystkich sześciu stronach z `INDEXABLE_PAGES`: `index.html`, `uslugi.html`, `pakiety.html`, `materialy.html`, `postepy.html` i `kontakt.html`.
- Potwierdź kanoniczny raster `assets/og/og.png` (`image/png`, `1200 × 630`) oraz odpowiedź HTTP `200`.
- Potwierdź `noindex, nofollow` i brak canonical na wszystkich dokumentach z `UTILITY_PAGES`: `404.html`, `offline.html`, `thank-you.html`, `polityka-prywatnosci.html`, `regulamin.html` i `cookies.html`.
- Potwierdź, że `sitemap.xml` zawiera wyłącznie sześć tras z `INDEXABLE_PAGES`, bez niezweryfikowanych `lastmod`.
- Potwierdź pojedynczy wpis `Sitemap:` w `robots.txt` i brak catch-all rewrite do `index.html` w `_redirects`.

## Service Worker i offline

- `npm run build:sw:vite`, wywoływane przez `npm run build`, generuje `dist/service-worker.js` dopiero po odkryciu finalnych assetów w `dist/build/`. Precache musi dokładnie łączyć `PUBLISHED_DOCUMENT_PATHS`, odkryte haszowane assety runtime i `STATIC_PRECACHE_PATHS`, bez ścieżek źródłowych lub developerskich.
- Oczekuj jednego bieżącego cache `lauren-english-v<version>-<fingerprint>`. Identyczne wejścia nie zmieniają rewizji; zmiana szablonu, konfiguracji lub treści precache zmienia fingerprint.
- Instalacja jest atomowa z perspektywy aktywnego workera: `skipWaiting` następuje dopiero po pełnym precache, a błąd usuwa niekompletny nowy cache. Aktywacja przejmuje klientów i usuwa wyłącznie starsze cache zaczynające się od `lauren-english-v`; inne cache originu muszą pozostać.
- Online wszystkie trasy z `PUBLISHED_DOCUMENT_PATHS`, wyprowadzone z `ALL_PAGES`, działają network-first. Tylko pełna, nieprzekierowana odpowiedź HTML `200` znanej trasy może odświeżyć jej wpis. Nieznana trasa online pozostaje realnym `404` i nie jest zapisywana.
- Offline każdy znany opublikowany dokument korzysta ze swojej kopii precache. Inna nawigacja pokazuje `offline.html`; nie używaj homepage jako fallbacku.
- Statyczne cache-first dotyczy jawnych assetów finalnego precache, w tym haszowanych bundli Vite, ikon instalacyjnych i trzech ikon skrótów, współdzielonego logo, lokalnych fontów oraz wymaganych fallbacków JPEG i wariantów AVIF/WebP. Screenshoty manifestu, kanoniczne `/css/` i `/js/`, `.vite-public/`, `assets/image-sources/` i wycofane `assets/build/` nie są precachowane. Zapisywane są tylko same-origin żądania `GET` HTTP(S) z pełną odpowiedzią `200`; query string jest normalizowany do jednej ścieżki. Nie zapisuj `206`, 4xx/5xx, redirectów, opaque, cross-origin ani innych metod.

## Manifest i krytyczne zasoby

- `/site.webmanifest` musi zwrócić `application/manifest+json`, zawierać komplet wymaganych pól, dokładnie trzy unikalne skróty do `/pakiety.html`, `/materialy.html` i `/postepy.html`, instalacyjne PNG `192 × 192` i `512 × 512` oraz screenshoty `1280 × 720` (`wide`) i `720 × 1280` (`narrow`). Wszystkie trasy i assety muszą zwracać `200`, a rozmiary i MIME muszą odpowiadać deklaracjom.
- Nie deklaruj `maskable`, dopóki osobna ikona nie ma zweryfikowanej strefy bezpiecznej.
- Hero ma używać `<picture>` z kolejnością AVIF, WebP i fallbackiem JPEG `/assets/img/hero/hero-01.jpg`; przeglądarka ma pobrać dokładnie jeden obsługiwany wariant o wymiarach `1600 × 1200`, z `loading="eager"`, `fetchpriority="high"` i bez przesunięcia layoutu.
- Budżety fontów i obrazu hero muszą odpowiadać `CRITICAL_ASSET_BUDGET` w `scripts/pwa-config.mjs`. Produkcyjny request graph musi zawierać jeden haszowany CSS i jeden JavaScript z `/build/`, bez requestów do `/css/`, `/js/`, `assets/build/`, zewnętrznych fontów lub duplikatów.

## Netlify

- Rootowy `netlify.toml` musi definiować `[build]`, `command = "npm run build"` oraz `publish = "dist"` bez duplikowania reguł z `_redirects`.
- Deployment produkcyjny pozostaje manualną czynnością terminalową wobec istniejącego projektu i adresu. Commity ani pushe nie uruchamiają deploymentu, a repozytorium nie konfiguruje GitHub continuous deployment, branch deployów ani workflow GitHub Actions.
- `.netlify/` pozostaje lokalne i ignorowane; nie zapisuj w śledzonej konfiguracji identyfikatorów witryny, tokenów, credentials ani metadanych linkowania.
- Potwierdź, że `dist/` zawiera wszystkie dwanaście dokumentów z `ALL_PAGES`, haszowane `build/`, wymagane `assets/`, `dist/service-worker.js`, manifest, sitemapę, robots i `_redirects`.
- Potwierdź, że `dist/kontakt.html` zachowuje `data-netlify="true"`, honeypot `bot-field`, ukryte `form-name` i action `/thank-you.html`.
- Nie publikuj rootowych źródeł, `.vite-public/`, `assets/image-sources/`, lokalnej konfiguracji, testów ani raportów przeglądarkowych.

## Manualna kontrola po wdrożeniu

- W bezpiecznym kontekście HTTPS otwórz DevTools → Application → Service Workers i potwierdź aktywny `/service-worker.js`, właściwy scope `/` oraz kontrolę strony po odświeżeniu.
- Kliknij **Update**, odśwież i potwierdź, że po aktywacji pozostaje jeden cache `lauren-english-v*`; cache o innej nazwie testowej nie może zostać usunięty.
- Przy połączeniu online potwierdź `200` wszystkich tras z `PUBLISHED_DOCUMENT_PATHS` i prawdziwy `404` dla nieznanej trasy. Następnie włącz Offline i sprawdź ten sam zestaw tras oraz osobny fallback nieznanej trasy.
- W Network potwierdź jeden haszowany CSS i JavaScript z `/build/`, budżety z `CRITICAL_ASSET_BUDGET`, brak `inter-500.woff2`, brak requestów `/css/`, `/js/` i `/assets/build/` oraz brak błędów konsoli, strony i zasobów.
- Nie deklaruj zweryfikowanego browser install prompt na podstawie samych testów localhost; lokalnie potwierdzane są manifest, ikony, bezpieczny kontekst, rejestracja, aktywacja, kontrola i cache.
