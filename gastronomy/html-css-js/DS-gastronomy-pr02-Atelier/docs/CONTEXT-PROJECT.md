# Atelier No.02 — Project Context

**Project type:** Static multi-page website (frontend-only, vanilla HTML/CSS/JS); no backend service
**Context status:** Active
**Last reviewed:** 2026-09-23

## Project identity

Atelier No.02 (`package.json` name: `atelier-no-02-restaurant`) is a multi-page demonstration website for a fictional fine-dining restaurant, built by Kamil Król under the KP_Code Digital Studio brand. It has no booking system, no CMS, and no custom backend; the contact form depends on Netlify Forms for delivery.

The site has 11 canonical pages: `index` (home), `about`, `menu`, `gallery`, `contact`, `cookies`, `polityka-prywatnosci` (privacy policy), `regulamin` (terms), `offline`, `thank-you`, and `404`. User-facing content is Polish-primary (`lang="pl"` on every page); `README.md` is maintained bilingually (Polish, then a full English translation).

The project is governed by a proprietary KP_CODE license (`LICENSE`), not an open-source license — see [Project boundaries](#project-boundaries).

## Project intent

The repository is explicitly positioned as KP_Code Digital Studio reference/portfolio work (`package.json` keywords include `portfolio`; `LICENSE` frames permitted use around "portfolio review, code review, testing, or educational study"). Treat it as a technically serious reference implementation: architecture, accessibility, semantics, maintainability, and content/metadata integrity are expected to hold up under technical review, not just visual review.

## Technology stack

- **Interface:** HTML5, layered CSS (`@import`-based, no preprocessor), vanilla JavaScript via native ES Modules — no frontend framework or UI library. Self-hosted local WOFF2 fonts.
- **Build:** Node.js/npm scripts, PostCSS (`postcss-import`, `cssnano`) for CSS, esbuild for JS bundling/minification (target `es2018`).
- **Images:** Sharp + `fast-glob` (`scripts/images/build-images.js`) generate AVIF/WebP/JPEG variants from source images and copy SVGs.
- **Quality tooling:** ESLint (flat config), html-validate (its Node API over the composed source pages in `scripts/qa-html.js`, its CLI over `dist/`), pa11y-ci (WCAG2AA via HTML CodeSniffer), a custom linkinator-based link checker (`scripts/qa-links.js`), and a custom Node contract validator (`scripts/validate-dist.js`).
- **Dev/runtime glue:** `http-server` for preview and as the base of the composing dev server (`scripts/dev-server.js`), a custom managed-server QA runner (`scripts/qa-server.js`), a hand-written Service Worker (`sw.js`) and Web App Manifest (`manifest.webmanifest`) for PWA/offline behavior.
- No runtime dependencies are declared — `package.json` has no `dependencies` key, only `devDependencies`. Node.js 22 is recommended to match CI; dependencies in `package-lock.json` have their own Node.js version requirements. The project does not pin an exact local Node.js version or declare an `engines` field in `package.json`.

## Architecture

Static multi-page site: each route has its own HTML template at the repository root, and the shared header and footer exist once, in `partials/header.html` and `partials/footer.html`. Every template carries exactly one whole-line `<!-- partial:header -->` and one `<!-- partial:footer -->` marker where the component belongs. `composeHtml()` in `scripts/build-config.js` splices the partials in before any page is delivered — in memory on every request in the development server (`scripts/dev-server.js`), and before `dist/` is written in the build — so every served, validated and published document is complete static HTML that needs no JavaScript for its navigation or footer. The composer is deliberately narrow: two registered partials, no variables, conditionals, nesting or arbitrary file inclusion, and a malformed, unknown, repeated or missing marker or a hand-written copy of either component fails with the page and line to correct.

Two JS entry points, selected per page by which `<script type="module">` the page loads:

- `js/script.js` → `js/app/init.js` — full entry, used by `index`, `about`, `menu`, `gallery`, `contact`, `thank-you`, `offline`. Runs common initializers, then page-specific initializers selected by `document.body.dataset.page` (`<body class="page page--<name>" data-page="<name>">`).
- `js/core.js` — reduced entry, used by `404`, `cookies`, `polityka-prywatnosci`, `regulamin`. Runs only the shared initializers (icons, misc, demo modal, nav, reveal, theme toggle); no page-specific features.

`js/bootstrap.js` loads separately (`<script defer>` in `<head>`) on every page, outside both bundles: it syncs the `theme-color` meta tag to the active theme and registers `/sw.js` (registration is skipped on `localhost`/`127.0.0.1`/`::1`).

CSS has a single entry, `css/style.css`, which `@import`s layered partials in a fixed order — `base` (tokens, reset, base, typography) → `layout` → `components` → `pages`. `postcss-import` inlines these into one file at build time; there is no CSS-in-JS or scoped-component styling.

## Canonical source ownership

- **Canonical:** root `*.html` page templates, `partials/header.html` and `partials/footer.html` (the only copy of the shared header and footer), `css/style.css` and its imported partials, `js/**/*.js` sources, `sw.js`, `data/menu.json`, `assets/img-src/**` (image sources), and `scripts/*.js` (build/QA tooling). `scripts/build-config.js` is the single source of truth for the page list, the partial registry and `composeHtml()`, root runtime files, copied asset entries, and the source→production filename map; `build-dist.js`, `validate-dist.js`, `dev-server.js`, `qa-html.js`, and `README.md`'s structure listing all derive from it.
- **Generated, gitignored (`dist/`):** the composed `dist/*.html` pages, `dist/css/style.min.css`, `dist/js/script.min.js`, `dist/js/core.min.js`, and the rest of the prepared production package; templates and `partials/` are never copied into it. Entirely rebuilt by `npm run build`; never hand-edited or committed. Not present in a checkout until a build runs.
- **Generated, but tracked:** `assets/img-optimized/**`, produced from `assets/img-src/**` by `npm run images:build` (a separate workflow, not part of `npm run build`). Source HTML/CSS/`data/menu.json` reference it directly, so it must be regenerated and committed after source-image changes.
- `sw.js` is hand-maintained; the build only rewrites its embedded CSS/JS path references for the `dist/` copy. `js/bootstrap.js` is copied into `dist/` verbatim (not rewritten, not bundled).

## Project structure

```text
./
├── index.html, about.html, menu.html, gallery.html, contact.html
├── cookies.html, polityka-prywatnosci.html, regulamin.html
├── offline.html, thank-you.html, 404.html   # 11 canonical page templates
├── partials/
│   ├── header.html              # canonical shared header
│   └── footer.html              # canonical shared footer
├── css/
│   ├── style.css                # single entry; @imports the layers below
│   ├── base/                    # tokens, reset, base, typography
│   ├── layout/                  # layout, grid, header, footer
│   ├── components/              # nav, buttons, cards, forms, lightbox, modal, ...
│   └── pages/                   # home, about, contact, menu, gallery, legal, system-pages
├── js/
│   ├── script.js                # full entry -> app/init.js
│   ├── core.js                  # reduced entry (404 + 3 legal pages)
│   ├── bootstrap.js             # theme-color sync + SW registration, loaded on every page
│   ├── app/init.js              # data-page dispatch, common + per-page initializers
│   ├── core/                    # dom.js, scrollspy.js
│   └── features/                # demo-modal, form, gallery, icons, lightbox, menu, misc, nav, network, reveal, theme
├── data/menu.json               # canonical menu content
├── assets/
│   ├── img-src/                 # tracked image sources
│   ├── img-optimized/           # tracked; generated by `npm run images:build`
│   ├── fonts/, icons/, docs/menu.pdf
├── scripts/
│   ├── build-config.js          # source of truth: pages, partials + composeHtml(), runtime files, asset entries, prod filename map
│   ├── build-dist.js, validate-dist.js, qa-links.js, qa-server.js
│   ├── dev-server.js            # npm run dev: pages composed per request, assets served from source
│   ├── qa-html.js               # html-validate over the composed source pages
│   └── images/build-images.js
├── docs/
│   ├── CHANGELOG.md, CONTEXT-PROJECT.md, settings.md
│   └── archive/
│       ├── audits/, plans/       # superseded audits and completed plans
│       └── improvements/         # completed UI (2026-09-24), QUALITY (2026-09-25), UX (2026-09-26) reports
├── .github/workflows/quality.yml  # CI: qa -> build -> qa:dist
├── manifest.webmanifest, sw.js, robots.txt, sitemap.xml
├── _headers, _redirects         # Netlify hosting rules
├── package.json, package-lock.json
├── AGENTS.md                     # local agent instructions
├── dist/                        # generated production package (gitignored)
└── LICENSE
```

## Development conventions

- **Shared header/footer:** edit them only in `partials/header.html` and `partials/footer.html`. A page template references each with one whole-line `<!-- partial:header -->` / `<!-- partial:footer -->` marker, whose indentation the partial takes; skip links, breadcrumbs, `<main>`, `<noscript>`, entry scripts, the demo modal and page-specific inline scripts stay in the template. The partials carry no page-specific state: nav `aria-current` and the footer year are set at runtime by `js/features/misc.js`.
- **Page identity:** `<body class="page page--<name>" data-page="<name>">` on every page; `js/app/init.js` reads `dataset.page` (falling back to `dataset.template`) to select page-specific initializers.
- **SVG icons:** a shared inline registry (`js/features/icons.js`) holds path data for 7 retained Font Awesome Free icons keyed by `data-icon`, and fills empty `<svg data-icon="...">` placeholders at runtime. Preserve the Font Awesome Free 7.1.0 attribution comments in that file and in `assets/icons/svg-icon/*.svg`.
- **Design tokens:** colors, breakpoints, shadows, and focus-ring values are centralized as CSS custom properties in `css/base/tokens.css`.
- **JS modules:** native ES Modules under `js/app/`, `js/core/`, `js/features/`; feature modules export `init*` functions composed by the two entry points. `scripts/**/*.js` are Node CommonJS (no `type: module` in `package.json`).
- **Menu content:** `data/menu.json` is the single source for menu items (category, title, description, price, tags, responsive image variants); `menu.html` fetches and renders it with search/tag filtering. Static HTML cards remain in the page markup as a fallback when JavaScript or the fetch is unavailable — keep both in sync when editing menu content.
- **Per-page metadata contract:** `scripts/validate-dist.js` enforces that title, meta description, `og:title`, breadcrumb terminal name, and canonical URL are unique per page, and that `og:url`/breadcrumb self-references match the page's own canonical URL.

## Quality contracts

- **Accessibility:** semantic landmarks, skip links, field labels, and visible focus states throughout; mobile navigation, the lightbox, and the demo-notice dialog manage focus and support keyboard interaction; form validation toggles `aria-invalid` and status messages use `aria-live` regions. Automated accessibility auditing is configured through pa11y-ci; it does not establish full WCAG conformance or cover every form state. The [operational reference](settings.md#qaa11y) owns the scenario inventory and its limitations.
- **Motion:** animations respect `prefers-reduced-motion`; the reveal-on-scroll module also shows content immediately when `IntersectionObserver` is unavailable.
- **SEO/metadata:** every page has a title and description. The eight content pages also have canonical links, Open Graph and Twitter Card tags, and JSON-LD (`Organization`, plus per-page types such as `Restaurant`/`BreadcrumbList`). System-page exceptions: `404.html` has no canonical, Open Graph, Twitter Cards or JSON-LD; `offline.html` has canonical and Open Graph, but no Twitter Cards or JSON-LD; `thank-you.html` has canonical, but no Open Graph, Twitter Cards or JSON-LD. `scripts/validate-dist.js` requires titles and descriptions, checks uniqueness of the metadata fields it tracks and consistency of declared self-references, and permits these omissions. Production HTML must match the transformed composed sources.
- **Images/performance:** `<picture>`/`srcset` with AVIF/WebP/JPEG variants, explicit dimensions, and selective `loading="lazy"`; the homepage preloads its two referenced variable fonts and the hero image (`fetchpriority="high"`); font-face declarations use `font-display: swap`. No Lighthouse or Core Web Vitals results are recorded in the repository.

## Data and state

- `data/menu.json` holds static menu content (items, categories, descriptions, prices, tags, responsive image variant metadata). There is no CMS or remote API.
- Menu search/filter state lives in page memory only and is not persisted.
- `localStorage` stores the theme choice under `kp-theme` and demo-notice acknowledgement under `kp-demo-accepted` (a legacy `kp_demo_legal_ack` key is also read); all storage access is wrapped in `try/catch`.
- Cache Storage (via `sw.js`) holds precached pages/assets for offline support. There is no account system or cross-device sync.

## Build and generated output

Detailed command behavior, prerequisites and limitations are maintained in [settings.md](settings.md); executable definitions remain in [`package.json`](../package.json) and the referenced scripts/configuration. [README](../README.md) provides bilingual entry-point instructions. This context retains the architectural contracts and relationships between the stages.

- **Dev:** `npm run dev` serves repository sources through `scripts/dev-server.js` on `127.0.0.1:5173` without HTTP caching or a production build. Pages are composed in memory per request; assets remain unbuilt. No files are written or watched; refresh after source edits. Routing and error behavior are documented in the [dev reference](settings.md#dev).
- **Build:** `npm run build` recreates the production package from composed templates, runtime files and tracked assets, transforms HTML/Service Worker references, emits CSS/JS bundles only into `dist/`, and checks integrity. [Operational stages and failure behavior](settings.md#build) are maintained in the command reference.
- **Preview:** `npm run preview` serves only the existing `dist/` on port 5173 with HTTP caching disabled; build first and stop `dev` before preview.
- **Images:** `npm run images:build` is separate and manually triggered; it is not part of `npm run build`.
- Only `dist/` is gitignored generated output; `assets/img-optimized/` is generated but tracked (see [Canonical source ownership](#canonical-source-ownership)).

## Testing and verification

- **Source QA:** `npm run qa` combines lint, source/partial contracts, composed HTML validation, links and accessibility checks through the same composing server as development. It rejects generated bundles among sources and does not build production.
- **Production QA:** `npm run qa:dist` validates an existing package after `npm run build`, including integrity, HTML, links and accessibility through preview. It does not rebuild. Every `dist/` page must equal `productionHtml(composeHtml(template))`, carry no partial marker, and `partials/` must be absent; runtime assets and metadata remain subject to the validator's contracts.
- **Focused checks and diagnostics:** [settings.md](settings.md#packagejson-scripts) documents each public npm check, the `qa:server` / `qa:dist:server` selectors and their limitations. [HTML diagnostics](settings.md#qahtml) preserve composed-page positions and identify the canonical template or partial and its source line.
- **Server ownership:** full QA and managed-server checks require port 5173 to be free; direct link/accessibility checks require a running dev or preview server. See the [operational workflow](settings.md#publiczny-workflow) for execution and cleanup behavior.
- **CI:** [`.github/workflows/quality.yml`](../.github/workflows/quality.yml) runs on push/PR to `main` and manual dispatch, using `ubuntu-latest` and Node 22. It installs locked dependencies, checks sources, builds, then validates the package. CI does not deploy; [README](../README.md#continuous-integration) lists the public invocations.
- There is no unit or component test suite; verification is static analysis, contract/schema checks, and accessibility/link auditing against a running server.
- These are configured checks, not evidence of a successful run or a live deployment.

## Deployment

- The repository prepares a static `dist/` package together with root-level `_headers`/`_redirects` in Netlify's format: differentiated caching (long-cache immutable for `assets/*`, must-revalidate for HTML/CSS/JS), baseline security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, Cross-Origin-*), and a `/* → /404.html` catch-all returning a 404 status.
- The contact form (`contact.html`) is wired for Netlify Forms (`data-netlify`, `netlify-honeypot`, hidden `form-name` field) with a redirect to `thank-you.html`.
- Manifest, Service Worker, and canonical/Open Graph metadata assume deployment at a domain root.
- CI builds and validates the package but does not publish it. The project owner deploys `dist/` manually through Netlify CLI after `npm run build`; see the [README deployment guide](../README.md#deployment) and [operational prerequisites](settings.md#ci-i-ręczne-wdrożenie). This repository does not itself verify that a deployment is live or reflects the current source.
- Only `dist/` is deployable: the root page templates carry partial markers and are not complete pages.

## Project boundaries

- Frontend-only: no backend service, database, authentication, or booking system.
- The restaurant is a fictional demonstration brand; content and SEO metadata do not imply real-world indexing, ranking, or business operation.
- Contact-form delivery, PWA installability, and the state of any deployed site are outside what this repository's own checks verify.
- Proprietary license (`LICENSE`, KP_CODE Proprietary Project License v1.0; Polish text controls in case of conflict with the English text): the repository is source-available for review, not open source. Reuse, redistribution, derivative works, and commercial use all require the owner's prior written permission.

## Maintenance rules

- Never hand-edit anything in `dist/`, including `css/style.min.css`, `js/script.min.js`, or `js/core.min.js` — run `npm run build` instead.
- After changing `assets/img-src/**`, re-run `npm run images:build` and commit the regenerated `assets/img-optimized/**`.
- When adding, removing, or renaming a page or root runtime file, update `scripts/build-config.js` together with `sw.js` and `manifest.webmanifest`, and check `sitemap.xml`. A new page template needs both partial markers.
- Change the shared header or footer only in `partials/`; never paste either block into a page template — `composeHtml()` rejects the copy.
- When cached assets change, bump `CACHE_VERSION` in `sw.js`. A release that changes precached content also needs a newly recorded `PRECACHE_FINGERPRINT`; build integrity checks reject a mismatch. Calculation, failure handling and check limitations are maintained in the [operational reference](settings.md#qadistintegrity).
- Keep per-page metadata (title, description, `og:title`, breadcrumb name, canonical, `og:url`) unique and self-consistent; `scripts/validate-dist.js` enforces this against both source and built output.
