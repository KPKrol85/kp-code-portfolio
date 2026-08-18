# SolidCraft — Final Technical Front-End Audit

**Audit date:** 2026-08-18
**Project type:** Static multi-page front-end website (HTML, CSS, vanilla ES modules) with a Node-based build and QA tooling layer; no backend in the repository
**Audit mode:** Final repository and implementation review
**Current readiness:** Needs important fixes

## 1. Executive assessment

SolidCraft is a coherent, well-structured static site. The source architecture is genuinely modular — seven CSS modules composed through a single `@import` entry point, nine ES modules behind one conditional bootstrap in `js/script.js`, one canonical image pipeline, and a deterministic `dist/` build that never mutates source HTML. Repository documentation (`README.md`, `settings.md`, `CHANGELOG.md`) is unusually honest: it states plainly that there is no test suite, no CI, and no verified installability, and it does not claim conformance it cannot support. No secrets, credentials, inline scripts, or inline style attributes were found anywhere in the HTML, and the committed Content-Security-Policy matches what the pages actually load.

The current defect load, however, is concentrated in exactly the areas a final review is meant to catch: the header's offer submenu never renders below 1024 px because the class the JavaScript toggles has no matching CSS rule; the contact form's entire custom validation and accessible-error layer never executes because the form omits `novalidate` and native constraint validation intercepts first; the mandatory first-visit modal links to three legal documents that return 404 and is not operable by keyboard in any reasonable way; button label colours fail WCAG AA contrast in one theme each; and `404.html` / `offline.html` reference every asset and link relatively, so both break whenever they are served from a nested URL — which is their normal case.

Two contract-level problems compound this. The project's own accessibility gate (`npm run qa:a11y`) serves CSS and module scripts as `application/octet-stream`, so it scans an unstyled, script-less page and cannot see any of the defects above. And the Netlify build command (`npm run build:dist`) only asserts that minified assets exist — it never rebuilds them — so production ships whatever `css/style.min.css` and `js/*.min.js` happen to be committed.

None of this is architectural. The foundations are sound and the corrections are local. The most important remaining risk category is **verified accessibility and error-path correctness**, followed by **build/deployment contract**. The project is suitable for continued development now, and for portfolio presentation or deployment after the P1 items are resolved.

## 2. Audit scope and verification

### Areas inspected

- Repository structure, tracked-file inventory (857 tracked files), Git working-tree state and history
- All HTML documents: `index.html`, `404.html`, `offline.html`, `thank-you.html`, six `oferta/` subpages, three `doc/` pages
- All CSS sources: `css/style.css` and the seven modules in `css/modules/`
- All JavaScript sources: `js/script.js`, `js/theme-init.js`, `js/sw-register.js` and the nine modules in `js/modules/`
- Service worker (`sw.js`), web manifest, `robots.txt`, `sitemap.xml`
- Build and QA tooling: `scripts/build-dist.js`, `scripts/images.js`, `scripts/generate-sitemap.mjs`, `scripts/check-links.mjs`, `scripts/check-html-assets.mjs`, `scripts/qa-a11y.mjs`, `scripts/verify-css-build.js`, `scripts/verify-js-build.js`, `scripts/utils/logger.js`
- Configuration: `package.json`, `package-lock.json`, `postcss.config.js`, `lighthouserc.json`, `netlify.toml`, `_headers`, `_redirects`, `.prettierignore`
- Documentation: `README.md`, `settings.md`, `CHANGELOG.md`, `LICENSE`
- Generated artefacts inspected only to verify the production contract: `css/style.min.css`, `js/script.min.js`, `js/theme-init.min.js`

### Verification performed

- `node scripts/check-links.mjs` — **executed and failed** (3 internal links returning HTTP 404; 50 external link checks reported as skipped because the audit environment has no outbound network)
- `node scripts/check-html-assets.mjs` — **executed and passed** (13 HTML files scanned)
- `git status` / `git diff --ignore-cr-at-eol` — executed; the three "modified" files differ only by line endings
- Headless Chromium runtime verification against a local static server serving the repository's **source** files with correct MIME types (`index.html`, `oferta/lazienki.html`, all CSS modules, all JS modules). Verified: navigation drawer and offer submenu at 390 px / 1000 px / 1280 px, keyboard focus behaviour on the dropdown trigger, project-modal focus and dismissal behaviour, lightbox DOM structure and gallery keyboard activation, contact-form submission paths (empty, fast, invalid phone), duplicate element IDs, heading order, `alt` coverage, `target="_blank"` `rel` coverage, horizontal overflow at 320/360/768/1440 px, and computed/rendered colour contrast in both themes
- Headless Chromium reproduction of the `scripts/qa-a11y.mjs` static server (CSS and JS served as `application/octet-stream`) to confirm what that gate actually renders
- Static inspection of every file listed under "Areas inspected"

### Verification limitations

- `npm run build:css`, `build:js`, `build:dist`, `build:sitemap`, `qa:a11y`, `qa:lhci` and `format:check` — **not executed**. `node_modules/` is absent, installing dependencies is outside the audit's remit, and the build writes tracked files (`css/style.min.css`, `js/*.min.js`). Their behaviour was inspected statically only.
- Runtime verification ran against **source** files, not against a produced `dist/` build. The committed minified artefacts were spot-checked for markers from the current sources (`project-banner-accepted`, `consent.maps`, `dd-oferta`, `hero:blurSync`, `.project-modal`, `.lb-backdrop`) and appear consistent, but a byte-level rebuild comparison was not performed.
- Images, fonts and the service worker were not present in the runtime harness; offline behaviour, PWA installability and image loading were **not** exercised at runtime.
- No live URL was supplied for this audit. A Netlify configuration and a canonical origin exist in the repository; whether the site is currently deployed and what revision is live was **not** verified.
- No screen-reader or assistive-technology testing was performed. Accessibility findings below are either directly reproducible in a browser (stated as such) or source-visible risks (labelled as such).
- No Lighthouse or field performance measurement was performed. No performance scores are claimed.
- External URLs (social profiles, `kp-code.pl`) were **not** validated; the link checker reported them as skipped.

## 3. Verified strengths

- **Single canonical source ownership for CSS and JS.** `css/style.css` composes seven modules by `@import`; `js/script.js:1-16` is the only bundle entry and `js/script.js:41-72` initialises each module only when its selectors exist on the page. `settings.md` — "Source vs Generated Assets" states the ownership rule explicitly and it matches the implementation.
- **Consistent listener lifecycle discipline.** Every re-entrant initialiser (`initNav`, `initScrollSpy`, `initHeaderShrink`, `initContactForm`, `initOfertaLightbox`, `initOfferPrefetch`, `initHomeHelpers`, `initSmoothTop`, `initScrollReveal`, `initThemeToggle`, `initRipple`, `initHeroBlurSync`) aborts its previous `AbortController` and registers listeners with `{ signal }`, with `ResizeObserver` / `MutationObserver` teardown on abort or `pagehide`.
- **Third-party content is consent-gated.** `js/modules/map-consent.js:12-37` injects the Google Maps iframe only after an explicit click, persists the decision under `consent.maps`, and no third-party script or frame loads before that. The `_headers` CSP allow-list matches exactly this runtime.
- **CSP is compatible with the actual markup.** Verified across all 13 HTML files: zero `style="…"` attributes and zero inline non-JSON-LD `<script>` blocks, so `script-src 'self'` / `style-src 'self'` do not require unsafe directives.
- **Deterministic, non-destructive production build.** `scripts/build-dist.js:112-145` rebuilds `dist/` from scratch, excludes `assets/img-src/`, and rewrites minified references only in the `dist/` copies (`scripts/build-dist.js:147-178`) — source HTML is never mutated.
- **Repository-side validation that catches real problems.** `scripts/check-links.mjs` resolves links against a temporary static server and validates fragment targets; in this audit it correctly surfaced three genuine broken links that no other check would have caught.
- **Coherent responsive image pipeline.** `scripts/images.js` covers all five source directories (`hero`, `oferta`, `gallery`, `og`, `screenshots`) with deterministic naming and AVIF/WebP/JPG output; every HTML asset reference resolves (`check:assets` passed).
- **Self-hosted fonts with `font-display: swap`** and four targeted `woff2` preloads (`index.html:158-161`); no external font origin is contacted.
- **Clean document structure on the home page.** Verified in a browser: no duplicate element IDs, no `<img>` without `alt`, no `target="_blank"` without `rel="noopener"`, sequential heading order (H1 → H2 → H3 with no skipped levels), and no horizontal overflow at 320, 360, 768 or 1440 px.
- **Scoped service-worker cache cleanup.** `sw.js:41` deletes only keys prefixed `solidcraft-v`, so unrelated caches on the same origin are never removed.
- **Minimal, honest client-side persistence.** Only three UI-preference keys (`theme`, `consent.maps`, `project-banner-accepted`); no personal data is stored client-side.
- **Documentation that does not overstate.** `README.md` — "Testy i walidacja" states there is no unit or functional test suite and that the configured commands were not executed while writing the documentation; the deployment section states the repository contains no CI/CD configuration; the PWA section states installability and offline behaviour were not verified. `LICENSE` is fully filled in and consistent with `package.json` (`"license": "SEE LICENSE IN LICENSE"`).

## 4. P0 — Critical risks

None detected.

## 5. P1 — Important issues worth fixing next

### [P1-01] Three legal-document links in the mandatory first-visit modal return HTTP 404

- **Classification:** Defect
- **Affected area:** Home page, legal/consent content, pre-deploy gate
- **Evidence:** `index.html:986`, `index.html:990`, `index.html:991`; verified by `node scripts/check-links.mjs`
- **Current behaviour:** The project modal links to `regulamin.html`, `polityka-prywatnosci.html` and `cookies.html` as root-relative-to-document paths, but those documents live in `doc/`. The link checker fails with three `internal link returned HTTP 404` errors. Under the deployed routing (`_redirects:31`), all three resolve to the 404 page.
- **Impact:** The modal states that using the site constitutes acceptance of the Terms, and the link to those Terms does not resolve. The two other legal links are equally unreachable from the modal. Because `check:predeploy` chains `check:links`, the project's own documented pre-deploy gate currently fails on `main`.
- **Recommended direction:** Point the three modal links at the `doc/` documents using the same path convention already used by the footer, and re-run the link checker.
- **Verification criteria:** `npm run check:links` reports PASS with no internal failures, and all three modal links open the corresponding `doc/` page.

### [P1-02] First-visit modal blocks the page but has no focus management, Escape handling, focus trap or scroll lock

- **Classification:** Defect
- **Affected area:** Home page entry, keyboard and assistive-technology accessibility
- **Evidence:** `index.html:978-997`; `js/modules/project-banner.js:1-19`; `css/modules/components.css:127-146`
- **Current behaviour:** Reproduced in headless Chromium. The dialog carries `role="dialog"` and `aria-modal="true"` and covers the whole viewport (`position: fixed; inset: 0; z-index: 1000`), yet `initProjectBanner` only flips the `hidden` attribute. After it appears: `document.activeElement` is still `<body>`, Escape does nothing, focus is not trapped, and `body` keeps `overflow: visible` (the `body.has-project-modal` rule at `css/modules/components.css:127-129` is never applied by any code). Its only control, `#projectBannerAccept`, is the 54th of 54 focusable elements in the document.
- **Impact:** Every first-time visitor is gated by this dialog. A keyboard-only user must traverse the entire page — which is visually obscured behind the overlay — to reach the accept button. Because `aria-modal="true"` instructs assistive technology to ignore content outside the dialog while focus remains outside it, screen-reader users are placed in an inconsistent context at the site's entry point. This is the most severe accessibility issue found.
- **Recommended direction:** On open, move focus into the dialog and restore it to the previously focused element on close; add Escape-to-accept or a documented dismissal path; constrain Tab within the dialog; apply the existing `has-project-modal` scroll-lock class. Reuse the focus pattern already implemented in `js/modules/lightbox.js` rather than introducing a new one.
- **Verification criteria:** With the modal open, focus starts inside the dialog, Tab cycles only within it, Escape dismisses it, background scrolling is locked, and focus returns to a sensible element after dismissal.

### [P1-03] The offer submenu's `open` class has no CSS, so the submenu never renders below 1024 px and its ARIA state contradicts what is displayed

- **Classification:** Defect
- **Affected area:** Primary navigation, accessibility
- **Evidence:** `js/modules/nav.js:132-138` (`setDd`), `js/modules/nav.js:156-183`; `css/modules/layout.css:250-260`, `css/modules/layout.css:397-411`
- **Current behaviour:** Reproduced in headless Chromium. `setDd()` toggles a class named `open` on `#dd-oferta`, but no rule matching `.dropdown.open` exists anywhere in `css/`. Submenu visibility is driven exclusively by `:hover` / `:focus-within` inside `@media (min-width: 1024px)`. Consequences measured directly: at 390 px, after opening the drawer and activating "Oferta", `#dd-oferta` has `class="open"` and the trigger reports `aria-expanded="true"` while the computed style is `display: none` and no submenu link is visible; `focusFirstItem()` targets an element that cannot receive focus. At 1280 px, keyboard focus on the trigger makes the submenu fully visible via `:focus-within` while `aria-expanded` remains `"false"`; hovering sets it to `"true"`.
- **Impact:** On phones and tablets the six service subpages are not reachable from the header at all — they are only reachable from the offer cards further down the home page. In both directions the exposed ARIA state is wrong: expanded-but-hidden on mobile, collapsed-but-visible for desktop keyboard users. Screen-reader users receive an announcement that does not match the rendered UI.
- **Recommended direction:** Make one mechanism authoritative. Either give the `open` class real styles for the sub-1024 px drawer and drive desktop visibility from the same class (updating `aria-expanded` on hover and focus alike), or drop the class from the JavaScript and synchronise `aria-expanded` with the CSS-driven `:hover`/`:focus-within` state.
- **Verification criteria:** Below 1024 px, activating "Oferta" reveals the six submenu links and focus lands on the first one; at every viewport, `aria-expanded` on the trigger matches the submenu's rendered visibility.

### [P1-04] The contact form's custom validation and accessible error messaging never execute

- **Classification:** Defect
- **Affected area:** Contact form, accessibility, user-facing error handling
- **Evidence:** `index.html:799-809` (form element, no `novalidate`); `js/modules/forms.js:181-210`
- **Current behaviour:** Reproduced in headless Chromium. Submitting the empty form fires **0** `submit` events and **4** `invalid` events: native constraint validation intercepts before the handler runs. Consequently the entire branch at `js/modules/forms.js:181-210` is unreachable for missing, too-short, too-long and unchecked-consent cases — no field receives `aria-invalid`, all four `.form-error` spans wired via `aria-describedby` stay empty, and the `role="status"` note stays blank. The mechanism itself works: with all required fields satisfied and a malformed phone number, the submit handler runs and correctly sets the error text, `aria-invalid="true"` and the status note.
- **Impact:** The accessible error pattern documented in `README.md` — "Dostępność" and `CHANGELOG.md` — "Added" (error messages associated with fields, `aria-invalid` handling, live status region) does not activate for the errors it was written for. Users get transient browser-native bubbles instead, which are not associated with the fields, disappear on scroll, and are inconsistently announced across browsers.
- **Recommended direction:** Add `novalidate` to the form so the submit handler owns validation, keeping the native constraint attributes for semantics and no-JavaScript fallback. Confirm that the existing per-field messages, `aria-invalid` toggling and status note then run for every required-field case.
- **Verification criteria:** Submitting the empty form leaves the browser bubble suppressed, sets `aria-invalid="true"` on each invalid field, renders the corresponding `.form-error` text, and announces the summary in the status region.

### [P1-05] Button label colours fail WCAG AA contrast — the default button in dark theme, the modal button in light theme

- **Classification:** Defect
- **Affected area:** Design tokens, all call-to-action buttons, theming
- **Evidence:** `css/modules/components.css:201-212` (`.btn { background: var(--brand); color: var(--fg) }`); `css/modules/components.css:184-190` (`.project-modal__actions .btn { color: var(--bg) }`); `css/modules/tokens.css:2-5` and `css/modules/tokens.css:95-96`
- **Current behaviour:** Measured in headless Chromium from computed styles and rendered pixels. The button background is `--brand` (`#f59e0b`), which does not change with the theme, while the label colour is bound to `--fg` / `--bg`, which invert. In dark theme every default `.btn` renders `rgb(229,231,235)` on `#f59e0b` — **1.73:1**. In light theme the modal accept button renders `#ffffff` on `#f59e0b` — **2.15:1**. Both labels are 15.2 px / 700, i.e. normal-size text under WCAG, where AA requires 4.5:1. The mirrored cases pass (default button in light theme 8.72:1; modal button in dark theme 8.72:1).
- **Impact:** The site's primary conversion controls — hero CTAs, the contact-form submit button, subpage CTAs — are low-contrast for every dark-theme visitor, and the modal's only control is low-contrast for every light-theme visitor (light is the default). The theme toggle is a headline feature of the project, so one of the two supported themes is always affected.
- **Recommended direction:** Introduce a dedicated on-brand foreground token that stays constant across themes (the dark ink already used in light theme meets AA against `--brand`), and bind both `.btn` and `.project-modal__actions .btn` to it instead of to `--fg` / `--bg`.
- **Verification criteria:** In both themes, every `.btn` label measures at least 4.5:1 against its rendered background.

### [P1-06] `404.html` and `offline.html` use relative references, so both break when served from a nested URL

- **Classification:** Contract mismatch
- **Affected area:** Error handling, offline fallback, deployment routing
- **Evidence:** `404.html:35`, `404.html:147` and its in-page link list; `offline.html:17`, `offline.html:19`; `_redirects:31`; `sw.js:65`
- **Current behaviour:** Both pages reference `css/style.css`, `js/theme-init.js`, `js/sw-register.js`, `js/script.js`, every favicon and every navigation link relatively. The `_redirects` catch-all rewrites unmatched paths to `/404.html` while keeping the requested URL, and the service worker returns the cached `/offline.html` body for the failed navigation's URL. For any request below the root — `/oferta/anything`, or an offline navigation to `/oferta/remonty.html` — those references resolve to `/oferta/css/style.css`, `/oferta/js/script.js`, `/oferta/doc/regulamin.html` and so on, none of which exist.
- **Impact:** The 404 page renders unstyled, without JavaScript, and with every recovery link broken in exactly the situation it exists for. The offline fallback degrades the same way for any subpage navigation, which is the main case the service worker's `offline.html` handling was built for.
- **Recommended direction:** Switch both documents to root-relative references (`/css/style.css`, `/js/…`, `/oferta/…`, `/doc/…`), matching the convention already used for `/manifest.webmanifest` and `sw.js`'s precache list.
- **Verification criteria:** Requesting a non-existent nested path renders the styled 404 page with working navigation links, and an offline navigation to a subpage renders the styled offline page.

### [P1-07] The accessibility gate scans a page with no CSS and no application JavaScript

- **Classification:** Defect
- **Affected area:** QA tooling, pre-deploy gate
- **Evidence:** `scripts/qa-a11y.mjs:134-137` — the static server's `Content-Type` branch
- **Current behaviour:** The server used by `qa:a11y` returns `text/html` for `.html` and `application/octet-stream` for everything else, including `css/style.css` and `js/script.js`. Reproducing that exact server in headless Chromium: the module script is blocked with *"Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of `application/octet-stream`. Strict MIME type checking is enforced for module scripts per HTML spec."*, `window.SC` stays `undefined`, and the stylesheet is not applied (the header renders `position: static` instead of `fixed`). Only the classic `theme-init.js` executes. `scripts/check-links.mjs:250` has the same MIME branch, but there it is harmless because that script only inspects HTTP status codes.
- **Impact:** `npm run qa:a11y` — and therefore `npm run check:predeploy` — reports on an unstyled document with no navigation, no lightbox, no theme, no form enhancement and no modal. Its contrast, visibility, focus and ARIA results do not describe the shipped site, and it structurally cannot detect P1-02, P1-03, P1-04 or P1-05. `README.md` presents this run as the project's accessibility control, so the gate currently provides false assurance.
- **Recommended direction:** Serve correct MIME types (`text/css`, `text/javascript`) from the `qa:a11y` static server, then re-baseline the reported violations.
- **Verification criteria:** During `npm run qa:a11y` the scanned page has `window.SC` defined and the project stylesheet applied; the run's violation list is reviewed against that corrected baseline.

### [P1-08] Production deploys ship the committed minified assets; the deploy command never rebuilds them

- **Classification:** Contract mismatch
- **Affected area:** Build pipeline, deployment
- **Evidence:** `netlify.toml:1-3`; `package.json` — `scripts.build:dist`; `scripts/build-dist.js:12-16` and `scripts/build-dist.js:38-47`
- **Current behaviour:** The deploy command is `npm run build:dist`, which runs `scripts/build-dist.js` and then `build:sitemap`. It never runs `npm run build`. `ensureRequiredFilesExist()` only asserts that `css/style.min.css`, `js/script.min.js` and `js/theme-init.min.js` **exist**; it does not check that they correspond to the current sources. Regenerating them is a manual step documented in `README.md` — "Utrzymanie projektu" and `settings.md` — "Source vs Generated Assets". A marker spot-check of the currently committed artefacts found no drift, but nothing in the pipeline enforces that.
- **Impact:** Any commit that changes `css/modules/**` or `js/modules/**` without a local `npm run build` deploys current HTML alongside stale styles and scripts. The failure is silent — the build succeeds, the site loads, and only behaviour is wrong.
- **Recommended direction:** Make the deploy command run the asset build before assembling `dist/` (or have `build-dist` fail when the minified artefacts are older than their sources), so the published bundle cannot diverge from the committed source.
- **Verification criteria:** A commit that edits a CSS or JS module and is deployed without a manual build either produces updated minified output or fails the build.

### [P1-09] Gallery items expose two nested tab stops, and Enter on the link opens the raw JPEG instead of the lightbox

- **Classification:** Defect
- **Affected area:** Service subpages, gallery, keyboard accessibility
- **Evidence:** `js/modules/lightbox.js:204-230`; `oferta/lazienki.html:481-483` (pattern repeated across all six `oferta/` pages)
- **Current behaviour:** Reproduced in headless Chromium on `oferta/lazienki.html`. Each gallery item is `<a class="gallery-item" href="…-2048x1536.jpg">` wrapping `<picture><img>`. The lightbox adds `role="button"` and `tabindex="0"` to the inner `<img>` and binds click and Enter/Space handlers **to the image only**. Focusing the anchor and pressing Enter navigated the browser to `bathr-01-2048x1536.jpg`; the lightbox did not open. Tabbing then reaches the image, which does open the lightbox — so every gallery item consumes two tab stops and places an interactive control inside a link.
- **Impact:** Keyboard users leave the site into a bare image file on their first activation attempt, on all six service subpages (36 gallery items in total), and lose the caption, navigation and focus-restore behaviour the lightbox provides. Nested interactive elements are also an invalid structure that automated accessibility tools flag as a serious violation.
- **Recommended direction:** Bind the lightbox to the existing `<a class="gallery-item">` (preventing its default navigation) and stop promoting the inner `<img>` to a focusable control, so the anchor remains the single tab stop and the raw-image `href` stays as the no-JavaScript fallback.
- **Verification criteria:** Each gallery item is a single tab stop; Enter and Space on it open the lightbox without navigating; with JavaScript disabled the link still opens the full-size image.

### [P1-10] A demonstration site publishes a fictitious contractor as a real, indexable local business

- **Classification:** Content integrity risk
- **Affected area:** Structured data, public content, privacy
- **Evidence:** `index.html:43-63` (`GeneralContractor` JSON-LD); `index.html:654` (rating claim); `index.html:607-641` (client-logo section); `index.html:216` and `index.html:879` (navigation label); `robots.txt`, `sitemap.xml`, `index.html:10`
- **Current behaviour:** The site is explicitly demonstrational — `index.html:983-985` and `README.md` — "Przegląd projektu" both say so. Nonetheless every page is `index, follow`, listed in the sitemap, and the home page emits `GeneralContractor` structured data for "SolidCraft" containing a specific street address in Tarnów, opening hours, a telephone number, the author's real business email (identical to `package.json` — `author.email`) and `sameAs` links to the author's real personal social profiles. Visible copy adds "Średnia ocen 4.9/5 na podstawie 128 opinii" with no supporting source, a "Firmy, które nam zaufały" section of six unlabelled logos, and testimonial cards with named authors. The header link "Realizacje" points at that client-logo section, whose accessible name is "Firmy, które nam zaufały".
- **Impact:** Search engines are given machine-readable assertions that a company that does not exist operates from a specific physical address with a specific phone number, and the author's real contact details are attached to it. The rating, client logos and testimonials are presented as factual trust signals. The demo disclaimer lives only inside a dismissible modal and in structured data is absent entirely. The navigation label also misdescribes its destination.
- **Recommended direction:** Decide explicitly whether the demo is meant to be indexed. If it is, strip or neutralise the business-identity claims — remove the postal address, phone and `sameAs` from the structured data or drop the `GeneralContractor` type, mark the rating, logos and testimonials as illustrative, and align the "Realizacje" label with the section it opens. If it is not, set the pages to `noindex` and remove them from the sitemap.
- **Verification criteria:** No structured data asserts a physical business location or contact identity for SolidCraft, unsupported trust claims are visibly marked as sample content, and the navigation label matches its target section's heading.

## 6. P2 — Minor refinements

### [P2-01] Navigation breakpoints disagree: JavaScript uses 992 px, CSS uses 1024 px

- **Classification:** Contract mismatch
- **Affected area:** Navigation, responsive behaviour
- **Evidence:** `js/modules/nav.js:59`, `js/modules/nav.js:119`, `js/modules/nav.js:157`; `css/modules/layout.css:336`
- **Current behaviour:** The JavaScript treats `min-width: 992px` as desktop and `max-width: 991.98px` as mobile; the CSS switches the header to its desktop layout only at `min-width: 1024px`. Confirmed at a 1000 px viewport: the hamburger button is still displayed and `.nav-menu` is still `display: none` (mobile CSS), while `openMobileOnce()` and the drawer-closing handler both take their desktop branch.
- **Impact:** In the 992–1023 px band the drawer UI is shown but driven by desktop logic, so hover handlers are live for a menu that is opened by tapping and the mobile submenu branch is skipped entirely. It is a 32 px window, but it is a real tablet-landscape range.
- **Recommended direction:** Define the navigation breakpoint once and reference the same value from both layers.
- **Verification criteria:** The viewport width at which the header switches between drawer and inline navigation is identical in CSS and JavaScript.

### [P2-02] Repository hygiene controls are absent

- **Classification:** Maintenance risk
- **Affected area:** Repository, contributor workflow, deployed assets
- **Evidence:** no `.gitignore` and no `.gitattributes` at the repository root; `git status` reports `css/modules/subpages.css`, `js/modules/project-banner.js` and `sw.js` as modified while `git diff --ignore-cr-at-eol` is empty; `assets/img/gallery/elec-01-2048x1536 (1).avif` and `assets/img/gallery/tilling-04-768x576 (1).avif` are tracked
- **Current behaviour:** Three problems share one root. There is no `.gitignore`, although the documented workflow creates `node_modules/`, `dist/` and `.lighthouseci/` — `.prettierignore` already lists `dist/`, so their existence is expected. There is no `.gitattributes` and `core.autocrlf` is unset, so three files now carry CRLF against LF blobs and show as 744 changed lines of pure line-ending noise. Two duplicate gallery renditions with `" (1)"` in the filename are tracked and are copied into `dist/` on every deploy.
- **Impact:** After `npm install` the working tree fills with untracked build and dependency output that is one `git add -A` away from being committed; real changes are hidden inside whole-file line-ending diffs, making review and `git blame` unreliable; two unused binaries ship to production.
- **Recommended direction:** Add a `.gitignore` covering `node_modules/`, `dist/` and `.lighthouseci/`; add a `.gitattributes` normalising text files to LF; remove the two duplicate gallery renditions.
- **Verification criteria:** After a fresh `npm install` and `npm run build:dist`, `git status` is clean, and no tracked asset filename contains `" (1)"`.

### [P2-03] Form status and error colours were authored for a neutral background, not the orange contact section

- **Classification:** Defect
- **Affected area:** Contact form feedback, accessibility
- **Evidence:** `index.html:760` (`<section id="kontakt" class="cta">`), `css/modules/sections.css:569-571` (`.cta { background: var(--brand-grad); color: #fff }`), `css/modules/sections.css:662-665` (`.form .form-note`), `css/modules/sections.css:666-670` (`.form .form-error`); `js/modules/forms.js:51-56`
- **Current behaviour:** The contact section paints `linear-gradient(135deg, #f59e0b, #c2410c)` and sets `color: #fff`, behind a `rgba(255,255,255,0.1)` form panel. Against that, the status note inherits white — measured at roughly 2.9:1 in a browser — and field errors render `#dc2626`, i.e. red on orange, which is below AA across the whole gradient and is a poor hue pairing for colour-vision deficiency. `showNote()` toggles `is-ok` and `is-err` classes that have **no** CSS rule anywhere in `css/`, so success and failure states are visually identical.
- **Impact:** The messages users need most — "Sprawdź format numeru telefonu.", "Nie udało się wysłać formularza." and the success confirmation — are the least legible text on the page and cannot be told apart.
- **Recommended direction:** Give `.is-ok` and `.is-err` explicit styles chosen against the rendered gradient, and pick an error colour that clears 4.5:1 there; do not rely on hue alone to distinguish the two states.
- **Verification criteria:** Success and error states are visually distinct, and both the status note and field errors measure at least 4.5:1 against the contact section's rendered background.

### [P2-04] Submitting within two seconds of load silently discards everything the user typed

- **Classification:** Defect
- **Affected area:** Contact form, anti-spam handling
- **Evidence:** `js/modules/forms.js:38-39`, `js/modules/forms.js:173-180`
- **Current behaviour:** Reproduced in headless Chromium. When the honeypot is filled, the message looks spammy, or less than 2000 ms have elapsed since `initContactForm` ran, the handler calls `form.reset()` and returns without touching the status region. A form completed and submitted inside that window came back with every field cleared and an empty status note.
- **Impact:** A user whose browser autofills the form and who clicks promptly loses their input with no explanation and no indication that anything was sent or rejected. Silently destroying user input is worse than rejecting it.
- **Recommended direction:** Keep the heuristics, but stop clearing the user's input on the timing branch — leave the values in place and surface a short retry message in the existing status region.
- **Verification criteria:** A submission rejected by the timing heuristic preserves all entered values and produces a visible, announced message.

### [P2-05] Service-worker precache omits assets the cached pages require

- **Classification:** Contract mismatch
- **Affected area:** Service worker, offline behaviour
- **Evidence:** `sw.js:5-29` (`ASSETS`); `index.html:17` and `index.html:1000-1001`; `css/modules/layout.css:180-185`, `css/modules/layout.css:261-272`
- **Current behaviour:** The precache list contains the HTML pages, the manifest, `css/style.min.css`, `js/script.min.js` and the favicons — but not `js/theme-init.min.js`, `js/sw-register.js` or any of the six `woff2` files. Static assets are served cache-first with no offline fallback, so those requests fail when offline. `theme-init` is the script that removes the `no-js` class and applies the stored theme, and `css/modules/layout.css` has dedicated `.no-js` navigation rules.
- **Impact:** An offline visit to a cached page renders in the no-JavaScript navigation fallback with the stored theme ignored and system fonts substituted. Additionally, the cache write inside the fetch handler (`sw.js:61`, `sw.js:77`) is a floating promise that is not passed to `event.waitUntil`, so it can be dropped if the worker is terminated first.
- **Recommended direction:** Add the theme-init bundle, the registration script and the font files to the precache list, keep `CACHE_VERSION` bumped alongside, and hand the runtime cache writes to `event.waitUntil`.
- **Verification criteria:** With the network disabled, a cached page renders with the correct theme, the enhanced navigation and the project fonts.

### [P2-06] Lightbox controls are rendered outside the dialog they operate

- **Classification:** Source-visible risk
- **Affected area:** Lightbox, assistive-technology accessibility
- **Evidence:** `js/modules/lightbox.js:29-72`
- **Current behaviour:** Verified in a browser: `.lb-close`, `.lb-prev` and `.lb-next` are appended directly to `<body>` as siblings of `.lb-wrap`, so the close button's parent is `BODY` and none of the three controls is inside the element carrying `role="dialog"` and `aria-modal="true"`. The keyboard focus trap covers them explicitly, so keyboard operation works.
- **Impact:** `aria-modal="true"` instructs assistive technology to ignore everything outside the dialog subtree. Screen readers that honour it may not expose the close and navigation buttons when browsing the dialog, leaving no discoverable way to close or navigate the lightbox other than Escape. Not confirmed against a real screen reader in this audit.
- **Recommended direction:** Append the three control buttons inside `.lb-wrap` so the dialog's accessible subtree contains its own controls; keep the existing fixed positioning.
- **Verification criteria:** All lightbox controls are descendants of the `aria-modal` dialog element and remain reachable by Tab and by assistive-technology browsing.

### [P2-07] Lightbox replaces every thumbnail's descriptive `alt` with one generic label

- **Classification:** Defect
- **Affected area:** Gallery and offer cards, accessibility
- **Evidence:** `js/modules/lightbox.js:204-208`
- **Current behaviour:** Every bound thumbnail receives `aria-label="Powiększ zdjęcie"`, which overrides its `alt`. Verified on the home page: all six offer thumbnails announce the identical name despite carrying distinct `alt` text such as "Nowoczesna łazienka po remoncie" and "Kafelkowanie tarasu i kuchni". The same applies to the six gallery items on each service subpage.
- **Impact:** Screen-reader users receive an identical, non-distinguishing name for every image control on the page, losing the descriptive text that already exists in the markup.
- **Recommended direction:** Compose the accessible name from the image's own `alt` rather than replacing it, so each control is individually identifiable. (Resolving P2-06's sibling issue — moving activation onto the `<a>` per P1-09 — removes the need for the override on subpages.)
- **Verification criteria:** Each thumbnail control exposes an accessible name derived from its own `alt` text.

### [P2-08] `.ft-contact-icon` declares a 3318 px width

- **Classification:** Defect
- **Affected area:** Footer styling
- **Evidence:** `css/modules/layout.css:667-672`
- **Current behaviour:** The rule sets `width: 3318px; height: 18px; flex: 0 0 18px`. The flex basis constrains the rendered size inside the current flex row, so the visible layout is unaffected today; the declared width is plainly a typo for `18px`.
- **Impact:** No current visual defect, but the rule breaks the moment the icon is used outside a flex context, and it is a latent trap for anyone refactoring the footer.
- **Recommended direction:** Correct the width to match the icon's intended size.
- **Verification criteria:** `.ft-contact-icon` declares a width consistent with its height and flex basis.

### [P2-09] `addEventListener` is called with four arguments, so an abort signal is silently dropped

- **Classification:** Defect
- **Affected area:** Contact form, listener lifecycle
- **Evidence:** `js/modules/forms.js:146-154`
- **Current behaviour:** The trimming `blur` listener is registered as `form.addEventListener("blur", handler, true, { signal })`. `addEventListener` accepts three arguments; the third (`true`) is interpreted as `useCapture` and the fourth object is ignored, so this listener alone is not tied to the module's `AbortController`.
- **Impact:** It is the single exception to an otherwise consistent teardown pattern. Re-initialising the form would leave a stale capture-phase listener attached, and the inconsistency invites the same mistake elsewhere.
- **Recommended direction:** Pass a single options object containing both `capture` and `signal`.
- **Verification criteria:** Every listener in `js/modules/forms.js` is registered with the module's abort signal.

### [P2-10] `preventDefault()` is called inside a passive touch listener

- **Classification:** Defect
- **Affected area:** Lightbox, console hygiene
- **Evidence:** `js/modules/lightbox.js:341-356`
- **Current behaviour:** The double-tap-to-fullscreen `touchend` listener is registered with `{ passive: true, signal }` and calls `e.preventDefault()` on the second tap. In a passive listener that call has no effect and browsers emit a console warning.
- **Impact:** The intended suppression of the browser's default double-tap behaviour never happens, and production consoles carry a recurring warning on touch devices.
- **Recommended direction:** Either register that listener as non-passive so `preventDefault()` applies, or drop the call and accept the browser default.
- **Verification criteria:** Double-tapping the lightbox viewport produces the intended behaviour with no passive-listener warning in the console.

### [P2-11] ScrollSpy registers a new `scrollend` listener on every scroll event

- **Classification:** Source-visible risk
- **Affected area:** Scroll spy, runtime performance
- **Evidence:** `js/modules/nav.js:343-367`
- **Current behaviour:** `onScroll` throttles `compute()` through `requestAnimationFrame`, but calls `scheduleComputeAfterScroll()` unthrottled on every scroll event. In browsers that support `scrollend`, each call adds another one-shot `scrollend` listener. The listeners do remove themselves when the event finally fires, so they do not leak — but a single sustained scroll gesture can accumulate hundreds of them, and all of them run `compute()` in the same frame when scrolling stops.
- **Impact:** A burst of redundant `getBoundingClientRect()` reads across every tracked section at the end of each scroll gesture — a plausible source of jank on lower-end devices. Not measured in this audit.
- **Recommended direction:** Register the `scrollend` listener once for the module's lifetime, or guard the scheduling so at most one pending listener exists at a time.
- **Verification criteria:** At most one pending `scrollend` listener exists at any moment during continuous scrolling.

### [P2-12] `project-banner.js` accesses `localStorage` without the guard used everywhere else

- **Classification:** Source-visible risk
- **Affected area:** Project modal, storage resilience
- **Evidence:** `js/modules/project-banner.js:7`, `js/modules/project-banner.js:15`
- **Current behaviour:** `js/theme-init.js:6-18`, `js/modules/map-consent.js:26-36` and `js/modules/ui-core.js:166-178` all wrap storage access in `try`/`catch`. This module does not. In a context where `localStorage` access throws — storage blocked by browser settings, a restricted private-browsing mode, or a full quota — the read throws during initialisation, and the write throws inside the click handler *before* `banner.hidden = true` is reached.
- **Impact:** In those contexts the blocking modal cannot be dismissed at all, which locks the entire page behind an overlay (see P1-02 for the modal's other issues).
- **Recommended direction:** Apply the same guarded read/write helpers used by the other storage consumers, and set the hidden state before persisting.
- **Verification criteria:** With `localStorage` unavailable, the modal still appears once, the accept button still dismisses it, and no uncaught exception is thrown.

## 7. Extra quality improvements

### Add functional browser tests using the Playwright dependency already declared

- **Relevant area:** `package.json` — `devDependencies.playwright`; `scripts/qa-a11y.mjs`
- **Current evidence:** Playwright is already a declared dependency and already drives a headless static-server harness for the accessibility scan, but no functional test exists. Every P1 defect in this audit that involved runtime behaviour was reproducible in a few lines against that same kind of harness.
- **Potential value:** Regression coverage for the navigation drawer, the offer submenu, the lightbox and the contact-form submission paths, at essentially zero new dependency cost. `README.md` — "Roadmap" already names this as an open item.
- **Scope boundary:** Optional. The project ships without automated functional tests today and is not required to have them.

### Automate service-worker cache versioning

- **Relevant area:** `sw.js:2-29`; `README.md` — "Utrzymanie projektu"
- **Current evidence:** `CACHE_VERSION` and the precache list are maintained by hand, and static assets are served cache-first under unhashed filenames (`style.min.css`, `script.min.js`). The README already documents that the version must be bumped manually whenever cached assets change.
- **Potential value:** Removes a class of silent staleness where returning visitors keep old CSS or JavaScript indefinitely after a deploy where the version bump was forgotten. Deriving the version and the precache list during `build:dist` would close it.
- **Scope boundary:** Optional. The manual process is documented and currently consistent; this is a durability improvement, not a defect.

### Consolidate the sitemap source of truth

- **Relevant area:** `sitemap.xml`; `scripts/generate-sitemap.mjs`; `scripts/build-dist.js:17-26`
- **Current evidence:** A hand-maintained `sitemap.xml` with `lastmod` values from September 2025 is tracked at the root and copied into `dist/`, where `build:sitemap` then overwrites it with generated output that contains no `lastmod`. The tracked file therefore never reaches production, but it is what a maintainer sees and edits.
- **Potential value:** Removing the unused tracked copy (or generating it in place) eliminates a second source of truth that can drift from the real published sitemap.
- **Scope boundary:** Optional. The current ordering is correct and documented in `README.md` — "SEO"; no incorrect sitemap is currently published.

### Extend accessibility scanning beyond four pages

- **Relevant area:** `scripts/qa-a11y.mjs:12-19`
- **Current evidence:** The scan covers `index.html`, `404.html`, `oferta/lazienki.html`, `doc/polityka-prywatnosci.html` and, if present, `offline.html`. The remaining five service subpages and two document pages are not scanned, and the six subpages share the gallery structure identified in P1-09.
- **Potential value:** Once P1-07 is resolved and the gate scans the real rendering, broadening coverage would exercise the structures where the current defects actually live.
- **Scope boundary:** Optional and worth doing only after P1-07; scanning more pages against an unstyled, script-less rendering would add cost without adding signal.

## 8. Current readiness conclusion

**Status:** Needs important fixes

No finding prevents the project from being built, deployed or developed further, and no critical security, data-loss or runtime-breakage risk was detected. The architecture, tooling and documentation are in good shape and need no restructuring.

What stands between the current state and a confident release is a set of ten concrete, local defects — three of them in paths a first-time visitor cannot avoid (the entry modal's broken legal links and inoperable keyboard behaviour, the mobile offer submenu), two in error handling that only surfaces when something goes wrong (form validation, the 404 and offline pages), one in colour contrast that always affects one of the two supported themes, one in public content integrity, and two in contracts that make the project's own quality gates less trustworthy than they appear (`qa:a11y`'s MIME types, the deploy command's use of committed artefacts).

For portfolio presentation specifically, P1-01, P1-02, P1-03, P1-05 and P1-10 are the ones a reviewer would encounter directly. For deployment, P1-06 and P1-08 matter most. Once the P1 set is resolved and `npm run check:predeploy` passes against a corrected `qa:a11y`, this project would sit comfortably in "Ready with minor refinements".

## 9. Senior rating

**Rating:** 6/10

Judged as a static, framework-free, locally-persisted marketing site with a Node build layer — not against an application with a backend.

The upper half of the score is earned: clear canonical source ownership, disciplined module boundaries and listener lifecycles, a real and deterministic build, genuinely useful repository-side validation, a CSP that matches the actual runtime, consent-gated third-party content, clean document structure with no duplicate IDs or missing `alt` text and no horizontal overflow at any tested width, and documentation that consistently refuses to claim more than the implementation supports. That combination is well above what this project category usually shows.

The score is held down by the volume and nature of the confirmed defects rather than by any structural weakness. Two implemented, documented features do not work as described — the mobile offer submenu never renders, and the accessible form-validation layer never executes — and both were reproducible in a browser within minutes. Colour contrast fails WCAG AA on primary controls in whichever theme is not the one the tokens were tuned for. The error and offline pages break precisely in the situations they exist for. Most significantly for a *final* audit, the project's own accessibility gate scans a page with neither CSS nor JavaScript applied, which is why these defects survived to this point; that single tooling fault is what separates a 6 from an 8 here, because it means the existing green checks were not measuring the shipped site. Correcting the P1 set is a bounded amount of work against an architecture that is already sound.
