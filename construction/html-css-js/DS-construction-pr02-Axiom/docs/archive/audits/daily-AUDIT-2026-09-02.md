# Daily Front-End Audit — Axiom

**Audit date:** 2026-08-30
**Project type:** Static multi-page front-end website (vanilla HTML/CSS/JS) with a Node build pipeline and static-hosting configuration
**Audit mode:** Static repository review
**Archived:** 2026-09-02

## Status review — 2026-09-01

**Status review date:** 2026-09-01
**Review mode:** verification of the existing findings against the current `main` implementation; no new audit was performed.

Everything below this section is the original audit as written on 2026-08-30. The evidence, current behavior, impact, and recommended direction of each finding, the overall assessment, and the senior rating describe the repository state observed on that date and are preserved unchanged. Only the `Status:` line under each finding, and the short `Resolution:` note where one is present, describe the repository as verified on 2026-09-01.

**Current status of the 2026-08-30 findings:**

- RESOLVED: 8
- PARTIALLY RESOLVED: 0
- OPEN: 0

## Status review — 2026-09-02

**Status review date:** 2026-09-02
**Review mode:** status verification of the optional improvement "Content-hashed filenames for production bundles" against the current implementation; no new audit was performed.

That optional improvement, listed under **Extra quality improvements**, is now implemented and verified; its `Status:` and `Resolution:` lines describe the repository as of 2026-09-02. Nothing else in this document changed — the 2026-08-30 audit, the 2026-09-01 status review, and the counters above are unaffected. Those counters cover the eight original 2026-08-30 findings only; the optional improvements are listed separately and were never counted among them.

One consequence is worth naming so the two dates are not read as one: the `P1-01` resolution below describes the cache policy as verified on 2026-09-01, when the production bundles still had fixed names and finite revalidated rules. Those two URLs no longer exist. The production bundles are now content-addressed and receive one-year `immutable` rules generated per build, while `/css/*` and `/js/*` — `js/theme-init.js` included — keep the finite revalidated caching `P1-01` established. The finding itself remains resolved; only the URLs it named changed.

## Overall assessment

The runtime implementation is in good shape. Component initialization is defensive, focus handling in the interactive components is implemented deliberately, the CSS layering has a single entry point, and every local reference in HTML, CSS, the manifest, and the service worker precache list resolves to an existing file. No runtime or accessibility blocker was detected from source inspection.

The current risk is concentrated in the repository and delivery contract rather than in the application code: the cache policy in `_headers` is keyed to source paths instead of the paths the build actually produces, more than half of the tracked image files are unreferenced yet still copied into the deployment output, and the repository has no ignore rules protecting it from build and dependency artifacts. None of these blocks continued development, but all three will keep costing effort at each deployment.

## Verified strengths

- Reference integrity: a full static resolution pass over all 15 HTML pages, `css/**/*.css`, `manifest.webmanifest`, and the `sw.js` precache list found no broken local path.
- Defensive initialization: every component in `js/components/` returns early when its target element is absent, and all `localStorage` access is wrapped in `try/catch` (`js/utils/storage.js`).
- Focus handling in implemented interactions: focus trap and focus return in the lightbox and the modal, `inert` on the hidden back-to-top button, and `aria-expanded` / `aria-pressed` kept in sync in the navigation and theme toggle.
- Deterministic build tooling: the service worker revision is hashed from the built CSS, built JS, and `manifest.webmanifest` (`tools/sw/build-sw.mjs:10`), so the cache name follows the actual output.
- Single source for page metadata: `tools/templates/pages.meta.json` plus `tools/html/build-head.mjs` own the `<head>` sections.
- No runtime dependencies; `package.json` declares `devDependencies` only.
- Outbound links: all `target="_blank"` anchors carry `rel="noopener noreferrer"`.
- Delivered security headers: `_headers` defines CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy`.

## P0 — Critical risks

None detected.

## P1 — Important issues worth fixing next

### [P1-01] Cache policy in `_headers` does not match the paths the build produces

- **Status:** RESOLVED — implemented and recorded in CHANGELOG.md
- **Resolution:** `_headers` now gives `/style.min.css` and `/script.min.js` their own finite, revalidated rules and limits one-year `immutable` caching to the version-segmented font paths, so no unversioned file — `js/theme-init.js` included — is pinned in client caches for a year (PLAN task `PH1-02`).
- **Classification:** Contract mismatch
- **Evidence:** `_headers:9`, `_headers:12`, `_headers:15`; `tools/release/build-dist.mjs:84`
- **Current behavior:** `build:dist` rewrites the HTML to reference `style.min.css` and `script.min.js` at the deployment root. Those two files match only the `/*` rule and are therefore served with `Cache-Control: no-cache`. The `immutable`, one-year rules apply to `/css/*` and `/js/*`, which in the built output hold the copied, unversioned sources — including `js/theme-init.js`, which production pages still load directly.
- **Impact:** The two production bundles are never cached by browsers, while an unversioned file that does change (`js/theme-init.js`) is pinned in client caches for a year with no filename-based way to invalidate it.
- **Recommended direction:** Align the header rules with the actual output paths, and cache long-lived only those assets whose filenames change when their content changes.

### [P1-02] Over half of the tracked image files are unreferenced but still shipped

- **Status:** RESOLVED — implemented and recorded in CHANGELOG.md
- **Resolution:** `tools/images/build-images.mjs` now derives its output from the widths and formats the page `srcset` declarations consume, and a reference scan over the current `assets/img/` (543 files) resolves every file, so nothing unreferenced reaches the deployment output (PLAN task `PH2-02`).
- **Classification:** Maintenance risk
- **Evidence:** `assets/img/` (1547 files, 811 without any reference); `tools/release/build-dist.mjs:20`
- **Current behavior:** A reference scan across HTML, CSS, JS, `manifest.webmanifest`, and `sw.js` resolves 736 of 1547 files under `assets/img/`. The remainder includes generated width and format variants in `assets/img/_optimized/` that no `srcset` uses, duplicate originals such as `assets/img/realizacje/budowa-domu-03-800x600-dup.*`, and the parallel `instalacja-elektryczna-01-*` set that no page references. `build:dist` copies the whole `assets` directory, so all of it reaches the deployment output.
- **Impact:** Repository and deployment payload grow with content nothing uses (`assets/img` is 117 MB, of which `_optimized` is 44 MB), and it is no longer obvious which image files are load-bearing when the gallery changes.
- **Recommended direction:** Decide which variants the pages actually consume, remove or stop generating the rest, and keep the copy step limited to the referenced set.

### [P1-03] Repository has no ignore rules

- **Status:** RESOLVED — implemented and recorded in CHANGELOG.md
- **Resolution:** The repository now has a root `.gitignore` excluding `node_modules/`, `/dist/`, and `/reports/` (PLAN task `PH1-01`).
- **Classification:** Maintenance risk
- **Evidence:** no `.gitignore` in the repository; `package.json:31` (`build:clean`), `tools/qa/run-lighthouse.mjs:6`, `tools/qa/run-pa11y.mjs:6`
- **Current behavior:** The documented workflow creates `node_modules/`, `dist/`, and `reports/`, and none of them is excluded from version control.
- **Impact:** A routine `git add -A` after `npm install`, `npm run build`, or `npm run qa` commits dependency trees, build output, and audit reports into the repository history.
- **Recommended direction:** Add ignore rules covering the dependency directory, the build output directory, and the QA report directory.

## P2 — Minor refinements

### [P2-01] Root `sw.js` is generated in shape but owned by no script

- **Status:** RESOLVED — implemented and recorded in CHANGELOG.md
- **Resolution:** `tools/sw/build-sw.mjs` now renders both the root `sw.js` and `dist/sw.js` from `sw.template.js` under declared local and production precache profiles, and the root file carries a generated-file header naming its source and generator (PLAN task `PH1-03`).
- **Classification:** Maintenance risk
- **Evidence:** `sw.js:1`, `sw.template.js:1`, `tools/sw/build-sw.mjs:7`
- **Current behavior:** `sw.js` in the repository root mirrors `sw.template.js` with a fixed revision (`55c6c79a26c373a8`) and a precache list pointing at `/css/main.css` and `/js/main.js`. The only generator, `build:sw`, writes to `dist/sw.js` and never touches the root file, so template changes do not propagate to it and its revision never changes.
- **Impact:** The service worker served during local development, and from any deployment that publishes the repository root, drifts from the canonical template with no signal when it becomes stale.
- **Recommended direction:** Give the root file a declared owner — either generate it from the template as part of the build or drop it in favor of the generated output.

### [P2-02] Consent modal offers acceptance only

- **Status:** RESOLVED — implemented and recorded in CHANGELOG.md
- **Resolution:** Section 6 of `legal/polityka-cookies.html` now states that the project provides no in-site preference panel or withdrawal control and directs users to the browser's site-data controls, so the policy describes the acceptance-only dialog the project actually implements (PLAN task `PH3-03`).
- **Classification:** Contract mismatch
- **Evidence:** `js/components/cookies.js:15`, `js/components/cookies.js:36`, `js/components/cookies.js:74`; `legal/polityka-cookies.html` (section 6)
- **Current behavior:** The modal locks page scrolling, traps focus, suppresses `Escape`, and exposes a single control that stores `cookie_consent` with a 182-day lifetime. No control anywhere in the project changes or clears that record, while the cookie policy describes withdrawing consent at any time and points to browser settings or an in-site mechanism "if implemented".
- **Impact:** Visitors cannot proceed without accepting, and once accepted there is no in-site path back; the policy text and the implemented behavior only line up through the policy's conditional wording.
- **Recommended direction:** Either add a decline or withdraw path reachable after acceptance, or narrow the policy wording so it describes only the mechanism the project actually provides.

### [P2-03] Structured data exists in two places, one of which is never loaded

- **Status:** RESOLVED — implemented and recorded in CHANGELOG.md
- **Resolution:** The unused `js/structured-data/` directory was removed, leaving the inline `application/ld+json` blocks in the maintained pages as the single structured-data source (PLAN task `PH3-02`).
- **Classification:** Maintenance risk
- **Evidence:** `js/structured-data/` (15 files); inline `application/ld+json` blocks in `index.html`, `services/*.html`, `legal/*.html`
- **Current behavior:** JSON-LD is embedded inline in the pages. The JSON files under `js/structured-data/` are not fetched, imported, or consumed by any build step.
- **Impact:** Two representations of the same business, service, and breadcrumb data can drift apart, and it is unclear which one an editor should update.
- **Recommended direction:** Make one representation canonical — either generate the inline blocks from the JSON files or remove the unused directory.

### [P2-04] Utility pages are marked indexable

- **Status:** RESOLVED — implemented and recorded in CHANGELOG.md
- **Resolution:** `404.html` and `offline.html` now declare `noindex, follow`, matching `success.html`, with the policy declared in `tools/templates/pages.meta.json` (PLAN task `PH3-01`).
- **Classification:** Defect
- **Evidence:** `offline.html:11`, `404.html:11`
- **Current behavior:** Both pages declare `index, follow` and a self-referencing canonical, while neither appears in `sitemap.xml`. `success.html`, by contrast, correctly declares `noindex, follow`.
- **Impact:** The offline fallback is served with a normal status code and can be indexed as thin duplicate content; the indexing policy across utility pages is inconsistent.
- **Recommended direction:** Apply the same `noindex` treatment already used on `success.html` to the offline and error pages.

### [P2-05] Inert configuration and dead code

- **Status:** RESOLVED — implemented and recorded in CHANGELOG.md
- **Resolution:** The inert `_redirects` file, the unused `postcss.config.json`, and the unused `js/sections/faq.js` stub were removed, and `_redirects` was dropped from the `rootFilesToCopy` contract in `tools/release/build-dist.mjs`, so the production copy step no longer expects it (PLAN task `PH5-01`).
- **Classification:** Maintenance risk
- **Evidence:** `_redirects`, `postcss.config.json`, `js/sections/faq.js`
- **Current behavior:** `_redirects` contains only comments describing intended rules (www-to-apex, HTTPS, trailing slashes, custom 404) and defines none of them. `postcss.config.json` configures `postcss-import`, `postcss-nested`, and `postcss-preset-env`, none of which is declared in `package.json`, and `build:css` inlines `@import` with its own script before running `cssnano-cli`. `js/sections/faq.js` exports an empty function that nothing imports; the FAQ is native `<details>` markup.
- **Impact:** Three files suggest behavior the project does not have, which costs review time and invites changes that have no effect.
- **Recommended direction:** Remove each file or restore the behavior it advertises.

## Extra quality improvements

### Wire the reference-integrity check into an npm script

- **Status:** RESOLVED — implemented and recorded in CHANGELOG.md
- **Resolution:** `tools/qa/check-references.mjs` runs as `npm run qa:references` and resolves the local references declared by the HTML pages, `css/**/*.css`, `manifest.webmanifest`, and the canonical precache inputs (PLAN task `PH2-01`).
- **Evidence:** The audit's static pass over HTML, CSS, `manifest.webmanifest`, and the `sw.js` precache list resolved every local path; nothing in the repository performs that check automatically.
- **Potential value:** The multi-page structure with 15 pages, generated `<head>` sections, and a hand-maintained precache list makes broken paths easy to introduce and cheap to catch mechanically.
- **Scope boundary:** Optional. Nothing is currently broken; this protects a property the project already satisfies.

### Content-hashed filenames for production bundles

- **Status:** RESOLVED — implemented, verified, and recorded in CHANGELOG.md on 2026-09-02
- **Resolution:** `build:hash` hashes the final minified CSS and JavaScript bytes with SHA-256 truncated to 16 lowercase hexadecimal characters and emits deterministic content-addressed production filenames; `dist/build-manifest.json` owns those names and drives both the production HTML rewrite and the production service-worker precache; `build:dist` generates exact `Cache-Control: public, max-age=31536000, immutable` rules for the two bundle URLs into `dist/_headers` while `/css/*` and `/js/*` keep finite revalidated caching; and `npm run qa:references` verifies the resulting release (PLAN task `O-01`).
- **Evidence:** `tools/css/build-css.mjs`, `tools/js/build-js.mjs` emit fixed names `style.min.css` and `script.min.js`.
- **Potential value:** Stable filenames are what forces the cache policy into the all-or-nothing choice behind P1-01; hashed names would make long-lived immutable caching safe for the main bundles.
- **Scope boundary:** Optional and larger than the P1-01 fix, which can be resolved with header rules alone.

## Verification performed

- Inspected: repository structure and all 15 HTML pages, `css/` layers and `css/main.css`, `js/` modules (`core`, `components`, `sections`, `utils`), all nine build and QA scripts in `tools/`, `package.json` and `package-lock.json`, `manifest.webmanifest`, `sw.template.js` and `sw.js`, `_headers`, `_redirects`, `robots.txt`, `sitemap.xml`, `assets/`, `README.md`, `CHANGELOG.md`, `settings.md`, `LICENSE`.
- Executed: a read-only static reference-resolution pass over HTML, CSS, manifest, and service worker precache entries; a read-only reference scan of `assets/img/`; JSON parse checks of `package.json`, `package-lock.json`, and `manifest.webmanifest`; `npm pkg get license`.
- Not executed: `npm run build`, `npm run qa:lighthouse`, `npm run qa:a11y`, and the image pipeline — all of them write tracked or generated files, install nothing, and fall outside a read-only audit.
- No runtime verification: no browser session, no assistive-technology testing, no measurement of loading behavior. Findings about caching, CSP, indexing, and service worker behavior are derived from configuration and source, not from a live deployment.
- Git state: `git status` through the current environment returns an incomplete listing (it cannot remove `.git/index.lock`), so it was not used as evidence; findings rest on file contents.

## Senior rating

**Rating:** 7/10

The application layer is above the level typical for a static company site: defensive module initialization, deliberate focus management, a coherent token and layer structure in CSS, zero runtime dependencies, and a build whose service worker revision is derived from real output. No P0 was found and no user-facing defect surfaced during static review. The points held back are all in the repository and delivery contract — cache headers that do not describe the built artifacts, an asset directory where the majority of files serve no page, no ignore rules, and a service worker file no script owns. These are correctable without touching the architecture, and the rating should move up once the delivery contract matches what the build actually produces.
