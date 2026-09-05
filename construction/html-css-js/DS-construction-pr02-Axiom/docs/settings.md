# settings.md

## package.json scripts

### img:build
- **Command:** `node tools/images/build-images.mjs`
- **What it does:** Generuje warianty WebP i AVIF w `assets/img/_optimized/` wyłącznie dla źródeł i szerokości zadeklarowanych w `tools/images/build-images.mjs` na podstawie `srcset` utrzymywanych stron.
- **When to use:** Po zmianach w źródłach obrazów przed buildem release.

### img:clean
- **Command:** `node tools/images/build-images.mjs --clean`
- **What it does:** Czyści wygenerowane artefakty obrazów.
- **When to use:** Gdy chcesz wykonać pełny, czysty przebieg generowania obrazów.

### build:clean
- **Command:** `node tools/release/clean-dist.mjs`
- **What it does:** Usuwa katalog `dist`.
- **When to use:** Na początku pełnego procesu build.

### build:css
- **Command:** `node tools/css/build-css.mjs`
- **What it does:** Scala `@import` z `css/main.css` i minifikuje wynik do pośredniego bundla `dist/style.min.css`; finalną nazwę produkcyjną nadaje dopiero `build:hash`.
- **When to use:** Po zmianach w `css/` lub jako część `build`.

### min:css
- **Command:** `npm run build:css`
- **What it does:** Alias do `build:css`.
- **When to use:** Dla kompatybilności z wcześniejszym nazewnictwem komendy.

### build:js
- **Command:** `node tools/js/build-js.mjs`
- **What it does:** Rozwiązuje importy modułów od `js/main.js` i minifikuje wynik do pośredniego bundla `dist/script.min.js`; kolejność modułów w bundlu jest deterministyczna, a finalną nazwę produkcyjną nadaje `build:hash`.
- **When to use:** Po zmianach w `js/` lub jako część `build`.

### build:hash
- **Command:** `node tools/release/build-hash.mjs`
- **What it does:** Liczy SHA-256 z finalnych zminifikowanych bajtów obu pośrednich bundli, skraca skrót do 16 znaków szesnastkowych i zmienia ich nazwy na `style.<hash>.min.css` oraz `script.<hash>.min.js` w katalogu głównym `dist`; zapisuje `dist/build-manifest.json`, który jest źródłem finalnych nazw dla `build:sw`, `build:dist` i QA.
- **When to use:** Po `build:css` i `build:js`, przed `build:sw`; zwykle jako część `build`.

### build:sw
- **Command:** `node tools/sw/build-sw.mjs`
- **What it does:** Generuje z `sw.template.js` oba Service Workery: `sw.js` w katalogu głównym (profil lokalny, niezmieniony) i `dist/sw.js` (profil produkcyjny, który precache’uje dokładne nazwy bundli odczytane z `dist/build-manifest.json`), każdy z własną listą pre-cache i własną rewizją.
- **When to use:** Tylko gdy oba profile mają zostać odświeżone jednocześnie; wymaga wcześniejszego `build:hash` dla profilu produkcyjnego.

### build:sw:local
- **Command:** `node tools/sw/build-sw.mjs --profile=local`
- **What it does:** Generuje wyłącznie lokalny `sw.js` w katalogu głównym, bez wymagania `dist/build-manifest.json`.
- **When to use:** Jawnie przed lokalnymi testami PWA uruchamianymi przez `npm run serve`.

### build:sw:production
- **Command:** `node tools/sw/build-sw.mjs --profile=production`
- **What it does:** Generuje wyłącznie produkcyjny `dist/sw.js` z nazwami bundli odczytanymi z `dist/build-manifest.json`; nie zapisuje głównego `sw.js`.
- **When to use:** Po `build:hash`, przed `build:dist`; standardowo jako część `build`.

### build:dist
- **Command:** `node tools/release/build-dist.mjs`
- **What it does:** Składa artefakty produkcyjne do katalogu `dist`: kopiuje pliki statyczne, przepisuje odwołania w HTML na nazwy bundli z `dist/build-manifest.json` i zastępuje blok znaczników w `dist/_headers` dokładnymi regułami `immutable` dla obu bundli.
- **When to use:** Po `build:hash` i `build:sw:production`, bezpośrednio przed publikacją.

### build
- **Command:** `npm run build:clean && npm run build:css && npm run build:js && npm run build:hash && npm run build:sw:production && npm run build:dist`
- **What it does:** Uruchamia pełny pipeline produkcyjny od czyszczenia do złożenia `dist`.
- **When to use:** Standardowa komenda przed wdrożeniem.

### serve
- **Command:** `http-server -c-1 -p 8080`
- **What it does:** Serwuje katalog roboczy projektu na porcie 8080 z wyłączonym cache.
- **When to use:** Lokalny podgląd źródeł (bez budowania `dist`).

### serve:dist
- **Command:** `http-server dist -c-1 -p 8080`
- **What it does:** Serwuje tylko artefakty z katalogu `dist`.
- **When to use:** Weryfikacja finalnego pakietu produkcyjnego.

### qa:lighthouse
- **Command:** `node tools/qa/run-lighthouse.mjs`
- **What it does:** Uruchamia Lighthouse CI collect dla zdefiniowanych URL i zapisuje raporty do `reports/lighthouse`.
- **When to use:** Audyt jakości (performance/SEO/a11y/best practices) przed release.

### qa:a11y
- **Command:** `node tools/qa/run-pa11y.mjs`
- **What it does:** Uruchamia pa11y dla wskazanych URL i zapisuje raporty JSON do `reports/pa11y`.
- **When to use:** Kontrola dostępności przed publikacją.

### qa:references
- **Command:** `node tools/qa/check-references.mjs`
- **What it does:** Statycznie sprawdza odwołania lokalne deklarowane przez strony HTML, `css/**/*.css`, `manifest.webmanifest` i stałą listę precache z `tools/sw/build-sw.mjs`, a także kontrakt bundli produkcyjnych: własność nazw, brak nazw ze skrótem wpisanych na sztywno w skryptach i dokładnie jeden blok znaczników w kanonicznym `_headers`; nie wymaga serwera, przeglądarki ani katalogu `dist/`. Gdy istnieje `dist/build-manifest.json`, weryfikuje dodatkowo wygenerowany release: bundle, przepisany HTML, zawężony zestaw plików źródłowych publikowanych obok bundli, `dist/sw.js` i `dist/_headers`.
- **When to use:** Po zmianach ścieżek, nazw plików lub zawartości `assets/`, przed buildem oraz po buildzie przed publikacją.

### qa
- **Command:** `npm run qa:lighthouse && npm run qa:a11y`
- **What it does:** Odpala komplet QA (Lighthouse + pa11y).
- **When to use:** Jako quality gate przed wdrożeniem.

### build:head
- **Command:** `node tools/html/build-head.mjs`
- **What it does:** Aktualizuje sekcje `<head>` stron HTML na podstawie szablonu i metadanych.
- **When to use:** Po zmianach globalnych SEO/meta/head.

### lint
- **Command:** `eslint js tools tests sw.template.js vitest.config.mjs`
- **What it does:** Uruchamia ESLint dla przeglądarkowych modułów w `js/`, narzędzi Node w `tools/`, skupionych testów w `tests/`, źródła Service Workera `sw.template.js` i konfiguracji `vitest.config.mjs`.
- **When to use:** Po zmianach w JavaScripcie, przed commitem i przed release.

### test
- **Command:** `vitest run`
- **What it does:** Uruchamia 33 skupione testy Vitest w środowisku jsdom w 4 plikach (`tests/contact-form.test.js`, `tests/lightbox.test.js`, `tests/navigation.test.js`, `tests/cookies.test.js`) pokrywających zachowanie formularza kontaktowego, lightboxa, nawigacji i modala informacji o projekcie/cookies; nie wymaga serwera ani przeglądarki.
- **When to use:** Po zmianach w `js/components/forms.js`, `js/components/lightbox.js`, `js/components/navigation.js`, `js/components/cookies.js`, `js/utils/a11y.js` lub powiązanej konfiguracji, przed commitem i przed release.
