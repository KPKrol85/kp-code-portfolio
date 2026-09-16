# settings.md

## package.json scripts

### `build:css`
- command: `postcss css/style.css -o css/style.min.css --no-map`
- what it does: kompiluje i minifikuje główny arkusz CSS do `css/style.min.css`.
- when to use: przed wydaniem produkcyjnym lub testem wariantu prod.

### `build:js`
- command: `esbuild js/script.js --bundle --minify --outfile=js/script.min.js --target=es2018`
- what it does: bundluje i minifikuje JS do `js/script.min.js`.
- when to use: przed wydaniem produkcyjnym lub testem wariantu prod.

### `build`
- command: `npm run build:css && npm run build:js`
- what it does: uruchamia pełny build assetów produkcyjnych CSS/JS.
- when to use: przed deploymentem i przed `check:server:prod`.

### `images:build`
- command: `node scripts/images/build-images.js`
- what it does: generuje/aktualizuje zoptymalizowane warianty obrazów.
- when to use: po dodaniu lub podmianie obrazów źródłowych.

### `dev:server`
- command: `http-server -p 5173 -c-1`
- what it does: uruchamia lokalny serwer statyczny na porcie `5173` z wyłączonym cache.
- when to use: codzienny development lokalny.

### `lint`
- command: `eslint "js/**/*.js"`
- what it does: sprawdza jakość i zgodność kodu JS z regułami ESLint.
- when to use: przed commitem/PR oraz w pipeline QA.

### `validate:html`
- command: `html-validate "*.html"`
- what it does: waliduje pliki HTML w katalogu głównym.
- when to use: po zmianach w HTML oraz przed release.

### `check:links`
- command: `npm run check:links:dev`
- what it does: alias na developerski wariant testu linków.
- when to use: kompatybilność ze starszym workflow; preferowany bezpośrednio `check:links:dev`.

### `check:links:dev`
- command: `linkinator http://127.0.0.1:5173/ http://127.0.0.1:5173/about.html http://127.0.0.1:5173/menu.html http://127.0.0.1:5173/gallery.html http://127.0.0.1:5173/cookies.html http://127.0.0.1:5173/polityka-prywatnosci.html http://127.0.0.1:5173/regulamin.html http://127.0.0.1:5173/offline.html http://127.0.0.1:5173/thank-you.html http://127.0.0.1:5173/404.html --recurse --check-fragments --silent --concurrency 4 --timeout 10000 --retry --skip "^https://|\.min\.(css|js)(\?.*)?$"`
- what it does: sprawdza linki i anchory lokalnie; ignoruje referencje `.min.css/.min.js` zgodnie ze strategią dev.
- when to use: codzienny QA w środowisku nie-minifikowanym.

### `check:links:prod`
- command: `linkinator http://127.0.0.1:5173/ http://127.0.0.1:5173/about.html http://127.0.0.1:5173/menu.html http://127.0.0.1:5173/gallery.html http://127.0.0.1:5173/cookies.html http://127.0.0.1:5173/polityka-prywatnosci.html http://127.0.0.1:5173/regulamin.html http://127.0.0.1:5173/offline.html http://127.0.0.1:5173/thank-you.html http://127.0.0.1:5173/404.html --recurse --check-fragments --silent --concurrency 4 --timeout 10000 --retry --skip "^https://"`
- what it does: sprawdza linki i anchory bez ignorowania `.min.*`.
- when to use: QA release po buildzie.

### `check:a11y`
- command: `pa11y-ci`
- what it does: automatyczny audyt dostępności WCAG2AA dla URL z `.pa11yci`.
- when to use: po zmianach UI/CSS/HTML i przed release.

### `check:server`
- command: `cross-env WAIT_ON_TIMEOUT=60000 WAIT_ON_INTERVAL=250 start-server-and-test dev:server http-get://127.0.0.1:5173 "npm run check:links:dev && npm run check:a11y"`
- what it does: uruchamia serwer i wykonuje dev-safe test linków oraz test dostępności.
- when to use: lokalny preflight quality gate.

### `check:server:prod`
- command: `cross-env WAIT_ON_TIMEOUT=60000 WAIT_ON_INTERVAL=250 start-server-and-test "npm run build && npm run dev:server" http-get://127.0.0.1:5173 "npm run check:links:prod"`
- what it does: buduje assety produkcyjne i uruchamia ścisły test linków pod release.
- when to use: przed wdrożeniem lub w CI release.

### `check`
- command: `npm run lint && npm run validate:html && npm run check:server`
- what it does: uruchamia pełny pakiet kontroli jakości dla developmentu.
- when to use: standardowy gate przed merge/release.
