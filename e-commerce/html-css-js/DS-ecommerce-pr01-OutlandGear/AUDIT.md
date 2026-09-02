# Outland Gear — Final Technical Front-End Audit

**Audit date:** 2026-08-01
**Project type:** Static multi-page demo e-commerce front end (MPA) built with semantic HTML, layered CSS, Vanilla JavaScript ES modules, local JSON data, and a Node.js build pipeline that generates `dist/` for Netlify deployment
**Audit mode:** Final repository and implementation review
**Current readiness:** Ready

## 1. Executive assessment

The implementation is coherent and matches its documented architecture. Product data flows through one validated loader, storage access is uniformly guarded, data-driven DOM construction avoids `innerHTML` for user- and data-derived content, and the design-token system is applied with unusual discipline — only 17 hardcoded colour values exist outside `css/tokens.css` across roughly 3,600 lines of CSS. Both CI workflows are real: linting and a production build on one, Playwright + axe scans on the other. The generated SEO output was verified byte-identical to a fresh regeneration from `data/`, and every asset path referenced from HTML resolves on disk.

No critical, important, or minor findings remain open. The prerender contract is now declared in the generated output and honoured by both detail-page modules, so the build's prerendered routes deliver their content without depending on JavaScript to reveal it.

The project is suitable for continued development and portfolio presentation within its documented demo scope.

## 2. Audit scope and verification

### Areas inspected

- Repository structure, `package.json` scripts and dependencies, `.gitignore`, `.gitattributes`, `.editorconfig`, `.prettierrc.json`, `eslint.config.mjs`, `stylelint.config.mjs`, `playwright.config.js`, `netlify.toml`, `LICENSE`
- Project documentation: `README.md` (both language sections), `CHANGELOG.md`, `docs/archive/audits/daily-AUDIT-2026-08-01.md`, `docs/archive/plans/PLAN-2026-08-01.md`
- All 15 root HTML pages and both shared partials (`partials/header.html`, `partials/footer.html`)
- All JavaScript sources: `js/app.js`, `js/config.js`, `js/utils.js`, and all 22 modules in `js/modules/`
- CSS entry point and layer order (`css/main.css`), tokens, base, layout, and all component and page stylesheets
- Application data: `data/products.json` (35 records), `data/categories.json`, `data/travel-kits.json` (3 records)
- Build and tooling: `scripts/build-dist.mjs`, `scripts/seo-config.mjs`, `scripts/preview-dist.mjs`, `scripts/optimize-images.mjs`
- Generated output, inspected only to verify the production contract: `dist/produkt/*/index.html`, `dist/assets/img/products/`
- Test suites: `tests/a11y/a11y.spec.js` (11 routes × 2 themes), `tests/a11y/a11y-interactive.spec.js` (interaction-only states × 2 themes)
- CI: `.github/workflows/code-quality-ci.yml`, `.github/workflows/accessibility-ci.yml`
- SEO and PWA surface: `robots.txt`, `sitemap.xml`, `assets/fav-icons/site.webmanifest`

### Verification performed

- `npx eslint js scripts tests` — executed and passed (exit 0)
- `npx stylelint "css/**/*.css"` — executed and passed (exit 0)
- `npx prettier --check .` — executed and passed (exit 0)
- `git status` / `git log` — executed; working tree clean, branch `main` up to date with `origin/main`
- Regenerated `robots.txt` and `sitemap.xml` in memory from `scripts/seo-config.mjs` and `data/*.json` and compared against the tracked files — both byte-identical; sitemap contains 46 URLs (8 static + 35 product slugs + 3 travel-kit slugs)
- Resolved all 124 image paths declared in `data/products.json` and `data/travel-kits.json` against the filesystem — all present
- Resolved all 107 `src`/`href` asset references across the root HTML pages and both partials against the filesystem — 0 missing
- Cross-checked all 9 `sprite.svg#…` references against the ids declared in `assets/svg/sprite.svg` — all present
- Grepped the JavaScript, script, HTML, and JSON sources for credential-like strings, `.env` files, `TODO`/`FIXME`/`HACK`/`debugger`, and `console.log` in application code — none found; `console` use in `js/` is limited to `error` and `warn` diagnostics
- Confirmed the local Node.js version (v22.22.3) falls inside the declared `engines.node` range (`>=20 <23`)
- Statically inspected all remaining findings against current source; every line reference in this document was re-read at audit time and again after the prerender and build-transform changes shifted line numbers in `scripts/build-dist.mjs`, `js/modules/travel-kits.js`, and `js/modules/product.js`
- `npm run build:html` run into a scratch copy of the repository to inspect generated output — 38 of 38 detail pages carry `data-prerendered="true"`, no root or template page carries it, and the `hidden` attribute is stripped from prerendered kit content while the `komplety.html` template retains it

### Verification limitations

- `npm run build` was not executed. `scripts/build-dist.mjs:732` writes `robots.txt` and `sitemap.xml` into the repository root, which are tracked files, so the build is outside this audit's read-only constraint. Their content was verified in sync by regenerating them in memory instead.
- `npm run qa:a11y` was not executed in the audit environment. Its Playwright `webServer` runs `npm run build` (`playwright.config.js`), and no Playwright browser binaries are present there; installing them would require a dependency install, which is outside audit scope. The suite was subsequently run locally by the project owner after the prerender and build-transform changes, passing 42 of 42 — that run is the only test evidence behind those changes, and no browser, runtime, or full-build verification of them was performed in the audit environment.
- No browser or runtime verification was performed. Findings describing rendered behaviour are derived from source and are labelled as such.
- No live deployment was inspected; no live URL was supplied for this audit. `README.md` links to a Netlify address and `scripts/seo-config.mjs:1` declares it as the SEO origin, but deployment status was not verified.
- Colour-contrast compliance was not fully verified, because reliable computed-style analysis was not available in this environment.
- Disabled-control contrast cannot be covered by this project's automated suite: `axe-core` 4.11.2 skips any disabled or inert node inside `colorContrastMatches` (`node_modules/axe-core/axe.js:27543-27556`), so an axe scan returns the same result with or without a fix for that state. Any future work on disabled-state contrast must be verified by direct browser measurement.

## 3. Verified strengths

- All four product-consuming features route through one validated, memoized loader. `cart.js`, `catalog.js`, `product.js`, and `travel-kits.js` each import `loadNormalizedProducts` from `js/modules/product-data.js:120-166`, which validates required fields, applies defaults, detects duplicate ids and slugs, and cross-checks category/subcategory against `data/categories.json`.
- Every browser-storage access is guarded and degrades to a user-visible notice rather than a silent failure (`js/modules/storage.js:14-30`, `js/modules/theme.js:12-25`, `js/modules/legal-modal.js:16-31`, surfaced through `js/modules/cart.js:17-46`).
- Data-driven DOM construction is safe throughout: cart rows, catalog cards, product specs, and travel-kit cards are built with `document.createElement` and `textContent`. `innerHTML` is used only to clear containers, to insert the project's own static partial files (`js/modules/partials.js:36`), and for one summary block built from numeric currency output (`js/modules/cart.js:186-196`).
- A pre-paint inline script resolves and applies the theme before stylesheets render (`index.html:36-49`), so a stored or system dark preference does not flash light on load — a real gap that this project has closed rather than deferred.
- Generated SEO output is derived from live data rather than hand-maintained, and is currently in sync: `scripts/seo-config.mjs:46-60` builds the sitemap from `data/products.json` and `data/travel-kits.json`, and regeneration reproduces the tracked files exactly.
- Indexing policy is applied deliberately rather than uniformly: `produkt.html` and `komplety.html` carry `noindex, follow` as templates, cart/checkout/confirmation pages carry `noindex`, and only the build-generated `/produkt/<slug>/` and `/komplety/<slug>/` pages receive index directives with per-item titles, descriptions, canonicals, and JSON-LD (`scripts/build-dist.mjs:309-451`, `500-641`).
- The prerender contract is declared in the output rather than inferred by the client: build-generated detail pages carry `data-prerendered="true"` on their page root, both detail-page modules read it through one shared helper (`js/modules/routes.js:41-42`), and the build throws if the root it expects to mark is absent (`scripts/build-dist.mjs:197-211`) — so the marker cannot silently stop being applied.
- The token system is applied consistently: outside `css/tokens.css` only 17 raw hex values remain across all component and page stylesheets, and both themes declare matching semantic tokens rather than overriding component rules.
- Accessible interaction patterns are implemented uniformly rather than ad hoc — focus trapping, focus restoration, and `aria-expanded`/`aria-hidden`/`aria-current`/`aria-pressed` synchronisation appear in the drawer, search panel, dropdowns, gallery, and modal (`js/modules/nav.js:47-191`, `js/modules/legal-modal.js:88-120`, `js/modules/theme.js:47-58`).
- Closed interactive containers are removed from the layout with `display: none` rather than merely visually hidden (`css/components/nav.css:339-350`, `css/components/dropdown.css:60-77`), so no focusable content sits inside an `aria-hidden` subtree at rest.
- The project's demo boundary is stated where a user encounters it, not only in documentation: the checkout action reads "Złóż zamówienie (demo)" (`checkout.html:198`), the confirmation page is titled accordingly, and `README.md` explicitly records the absence of an order backend, accounts, payments, and a service worker.
- Two independent CI workflows exercise the project on every pull request and push to `main`: lint plus a real production build (`.github/workflows/code-quality-ci.yml`) and the axe suite (`.github/workflows/accessibility-ci.yml`).

## 4. P0 — Critical risks

None detected.

## 5. P1 — Important issues worth fixing next

None detected.

## 6. P2 — Minor refinements

None detected.

## 7. Extra quality improvements

None detected.

## 8. Current readiness conclusion

**Status:** Ready

No blocker prevents the project from being built, deployed, or used, and no P0, P1, or P2 finding is open. The prerender contract is explicit in the generated output and honoured by both detail-page modules, so the prerendered routes deliver their content to clients that do not execute JavaScript.

No optional quality improvements remain documented in Section 7.

This status reflects a repository-level review with static analysis and the linters actually executed, plus one owner-run `npm run qa:a11y` pass. It is not an accessibility certification, a security guarantee, a browser-compatibility guarantee, or a statement about production performance, none of which were verified here.

## 9. Senior rating

**Rating:** 9/10

The architecture is coherent and the discipline behind it is visible in places that are usually neglected: one validated data loader serving every consumer, storage access guarded without exception, safe DOM construction throughout, a token system with almost no leakage, deliberate per-page indexing policy, and generated SEO output that regeneration reproduces exactly. Two CI workflows do real work, and the pre-paint theme script shows attention to a detail many projects leave broken. The documentation is largely honest about the project's limits — no order backend, no accounts, no service worker — which is rarer than it should be.

The prerender contract earns particular credit: it is not an assumption the client makes about the server's output but a marker declared in the HTML, read through one shared helper, with the build failing loudly if the marked root disappears. The detail-page modules treat the served document as the baseline and refuse to render a product that the page's own canonical link and `Product` schema do not name.

It is held at 9 rather than 10 by one remaining structural gap, narrower now than when this rating was first written: the build's named HTML-transform functions and its prerender output are covered by tests in `tests/build/` (`npm run test:build`), run in CI before the production build. The two asset-path rewrites in `createDistHtml` — which point generated pages at `main.min.css`/`app.min.js` — are not exercised by that suite; a pattern there could still stop matching with the build exiting 0 and nothing noticing. This is not a deep architectural problem, and it is correctable without touching the structure the project has built — but it is the one thing standing between this project and a full score now that every P0, P1, and P2 finding is resolved.
