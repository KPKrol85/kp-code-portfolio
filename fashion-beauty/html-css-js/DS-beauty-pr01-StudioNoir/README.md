# Studio Noir — Hair & Style Atelier

Premium, single-page experience dla luksusowego studia fryzjerskiego. Projekt w duchu editorial: dużo whitespace, wysublimowana typografia, subtelne animacje i pełna dostępność.

## Struktura

```
/studio-noir/
  index.html
  offline.html
  404.html
  robots.txt
  sitemap.xml
  _redirects
  manifest.webmanifest
  service-worker.js
  /assets/
    /img/
    /fonts/
    /icons/
  /css/
    tokens.css
    base.css
    layout.css
    components.css
    sections.css
    style.css
    style.min.css
  /js/
    main.js
    reveal.js
    header.js
    nav.js
    lightbox.js
    booking.js
    theme.js
  package.json
  README.md
```

## Build

```bash
npm install
npm run build:css
npm run build:js
npm run images
```

## A11y

- Skip link i semantyczne landmarki.
- Focus-visible i pełna obsługa klawiatury.
- Obsługa prefers-reduced-motion.

## PWA

- Manifest, service worker (app shell + offline fallback) i osobna strona offline.

## Notatka o fontach

W środowisku bez dostępu do zewnętrznej sieci użyto placeholderów `.woff2`. Zastąp je docelowymi fontami (np. Playfair Display i Manrope) przed wdrożeniem produkcyjnym.
