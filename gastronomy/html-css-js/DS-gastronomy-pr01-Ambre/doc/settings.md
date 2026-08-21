# settings.md

## npm scripts (z `package.json`)

### `build:css`
- **Command:** `postcss css/style.css -o css/style.min.css --no-map && node -e "..."`
- **What it does:** Bundle’uje CSS do `css/style.min.css` i sprawdza, czy w wynikowym pliku nie został `@import`.
- **When to use:** Przed publikacją artefaktów CSS lub przed testem środowiska produkcyjnego.
- **Technical note:** Każdy build nadpisuje `css/style.min.css`; ręczne zmiany w tym pliku zostaną utracone.

### `build:js`
- **Command:** `esbuild js/script.js --bundle --minify --target=es2018 --outfile=js/script.min.js --log-level=warning && node -e "..."`
- **What it does:** Bundle’uje i minifikuje JS do `js/script.min.js`, następnie waliduje brak składni `import` w bundle.
- **When to use:** Przed deployem i przy weryfikacji kompatybilności bundle dla runtime bez modułów.
- **Technical note:** Każdy build nadpisuje `js/script.min.js`; ręczne zmiany w tym pliku zostaną utracone.

### `build`
- **Command:** `npm run build:css && npm run build:js`
- **What it does:** Uruchamia pełny build front-end (CSS + JS).
- **When to use:** Standardowy krok przygotowania artefaktów.

### `watch:css`
- **Command:** `postcss css/style.css -o css/style.min.css --watch --no-map`
- **What it does:** Obserwuje zmiany CSS i odświeża `style.min.css`.
- **When to use:** Podczas lokalnej pracy nad stylingiem.

### `watch:js`
- **Command:** `esbuild js/script.js --bundle --minify --target=es2018 --outfile=js/script.min.js --watch`
- **What it does:** Obserwuje moduły JS i przebudowuje bundle.
- **When to use:** Podczas lokalnej pracy nad JS.

### `img:opt`
- **Command:** `node scripts/optimize-images.mjs`
- **What it does:** Uruchamia optymalizację obrazów zgodnie z konfiguracją skryptu.
- **When to use:** Przy aktualizacji assetów graficznych.

### `img:webp`
- **Command:** `node scripts/optimize-images.mjs --webp`
- **What it does:** Generuje warianty WebP.
- **When to use:** Gdy potrzebujesz odświeżyć tylko format WebP.

### `img:avif`
- **Command:** `node scripts/optimize-images.mjs --avif`
- **What it does:** Generuje warianty AVIF.
- **When to use:** Gdy potrzebujesz odświeżyć tylko format AVIF.

### `img:clean`
- **Command:** `node -e "require('fs').rmSync('assets/img/_optimized', { recursive: true, force: true })"`
- **What it does:** Czyści wygenerowane obrazy z `assets/img/_optimized`.
- **When to use:** Przed pełną regeneracją assetów lub przy porządkowaniu repo.

### `img:verify`
- **Command:** `node scripts/img-verify.mjs`
- **What it does:** Weryfikuje obecność/stan wygenerowanych obrazów.
- **When to use:** Po optymalizacji obrazów, przed commitem.

### `qa`
- **Command:** `npm run qa:links && npm run qa:seo && npm run qa:a11y && npm run qa:lighthouse && npm run qa:html && npm run qa:js && npm run qa:css`
- **What it does:** Uruchamia pełny pakiet QA.
- **When to use:** Przed wydaniem lub jako pipeline quality gate.

### `qa:links`
- **Command:** `node scripts/qa-links.mjs`
- **What it does:** Sprawdza integralność linków/anchorów.
- **When to use:** Po zmianach nawigacji, URL-i i treści.

### `qa:seo`
- **Command:** `node scripts/qa-seo.mjs`
- **What it does:** Waliduje SEO i structured-data (metadata, canonical, OG, JSON-LD).
- **When to use:** Po zmianach head/meta/schema.

### `qa:html`
- **Command:** `html-validate index.html menu.html galeria.html cookies.html polityka-prywatnosci.html regulamin.html 404.html offline.html`
- **What it does:** Waliduje składnię i jakość HTML.
- **When to use:** Po zmianach w strukturze stron.

### `qa:js`
- **Command:** `eslint --max-warnings 0 "js/**/*.js" "scripts/**/*.mjs"`
- **What it does:** Lintuje kod JS i skrypty narzędziowe.
- **When to use:** Po każdej zmianie JS.

### `qa:css`
- **Command:** `stylelint --max-warnings 0 "css/**/*.css"`
- **What it does:** Lintuje CSS.
- **When to use:** Po każdej zmianie stylów.

### `qa:a11y`
- **Command:** `node scripts/qa-a11y.mjs`
- **What it does:** Uruchamia automatyczny audyt dostępności (Playwright + axe).
- **When to use:** Po zmianach UI, nawigacji, formularzy i komponentów interaktywnych.

### `qa:lighthouse`
- **Command:** `lhci autorun --config=./lighthouserc.json`
- **What it does:** Uruchamia Lighthouse CI na zdefiniowanej konfiguracji.
- **When to use:** Do kontroli wydajności, SEO i best-practices przed wdrożeniem.
