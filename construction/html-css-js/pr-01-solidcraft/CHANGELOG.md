# Changelog

All significant changes to this project are documented in this file.

## [Unreleased]

### Added

- Added the initial project implementation as a dedicated repository, covering the home page, six service subpages in `oferta/`, three legal document pages in `doc/`, and the `thank-you.html`, `404.html`, and `offline.html` pages.
- Added a modular front-end source architecture with ES modules in `js/modules/` (navigation, UI core, forms, lightbox, map consent, prefetch, project banner) and CSS modules composed through `@import` in `css/style.css`.
- Added a contact form with client-side validation, `aria-invalid` error state handling, honeypot and heuristic anti-spam checks, a submit timeout, and a live status message region.
- Added a gallery and service lightbox with keyboard support for Enter/Space activation, Escape, arrow navigation, focus trap, and focus restore to the triggering element.
- Added a light/dark theme toggle with pre-render theme resolution in `js/theme-init.js` that reads the stored preference and falls back to `prefers-color-scheme`.
- Added consent-gated map embedding that injects the iframe only after user acceptance and persists the decision under the `consent.maps` key in `localStorage`.
- Added a dismissible project notice banner whose accepted state is persisted in `localStorage`.
- Added a service worker with a versioned cache name, network-first HTML handling with an `offline.html` fallback, cache-first static asset handling, and deletion of outdated caches on activation.
- Added `manifest.webmanifest` and favicon assets providing PWA install metadata.
- Added SEO metadata across pages, including canonical links, Open Graph and Twitter Card tags, JSON-LD structured data, `robots.txt`, and `sitemap.xml`.

### Changed

- **Breaking:** Replaced the MIT license with the proprietary KP_Code Proprietary Project License v1.0 and set the `license` field in `package.json` to `SEE LICENSE IN LICENSE`. Reuse, redistribution, and public deployment now require prior written permission from the copyright owner.

### Build and Tooling

- Added a production asset pipeline that builds `css/style.min.css` with PostCSS and bundles `js/script.min.js` and `js/theme-init.min.js` with esbuild, each followed by a build verification script (`scripts/verify-css-build.js`, `scripts/verify-js-build.js`).
- Added the `dist/` deployment build (`scripts/build-dist.js`) that copies runtime files, rewrites references to minified assets, and generates the sitemap for the configured site URL.
- Added Netlify deployment configuration: `netlify.toml` with the `npm run build:dist` command and `dist` publish directory, `_redirects` for canonical paths and the 404 fallback, and `_headers` with security headers including a Content-Security-Policy.
- Added a `sharp`-based image pipeline (`scripts/images.js`) that generates responsive AVIF, WebP, and JPG variants from `assets/img-src/`.
- Added a local development workflow based on `live-server` with separate CSS and JS watch tasks, and Prettier formatting scripts.

### Testing

- Added an accessibility QA script (`scripts/qa-a11y.mjs`) running axe-core through Playwright.
- Added internal link and HTML asset reference checkers (`scripts/check-links.mjs`, `scripts/check-html-assets.mjs`) combined into a `check:predeploy` gate together with the accessibility run.
- Added a Lighthouse CI configuration (`lighthouserc.json`) with defined quality thresholds.

### Documentation

- Added a bilingual (Polish and English) `LICENSE` file with a prevailing-language clause and filled project, repository, and copyright fields.
- Updated the license sections of `README.md` to reference the `LICENSE` file and state the non-open-source status and the licensing contact address.
- Added bilingual (Polish and English) `README.md` documentation covering the technology stack, project structure, development and build workflows, deployment, accessibility, SEO, and maintenance rules, together with `settings.md` describing pipeline and operational rules.
