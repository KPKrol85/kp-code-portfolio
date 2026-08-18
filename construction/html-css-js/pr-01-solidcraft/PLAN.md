# SolidCraft — Development Plan

**Last reviewed:** 2026-08-18
**Project type:** Static multi-page front-end website (HTML, CSS, vanilla ES modules) with a Node-based build and QA tooling layer; no backend in the repository
**Plan status:** Active

## Planning principles

- The plan reflects the current verified repository state; every item is backed by current source, configuration, or a re-verified `AUDIT.md` finding.
- Main items are checked only when all required subtasks are complete and the stated completion condition holds.
- Canonical sources are `css/style.css` + `css/modules/**`, `js/script.js` + `js/modules/**`, `js/theme-init.js`, `assets/img-src/**`; `css/style.min.css`, `js/*.min.js` and `assets/img/**` are generated and are never edited directly (`settings.md` — "Source vs Generated Assets").
- Significant completed changes are recorded separately in `CHANGELOG.md`; pending items stay only in this file.
- This plan is created from the current project state. No prior `PLAN.md` existed, so no completed planning history is reconstructed here.

## Current priorities

1. `PH1-01` — Serve correct MIME types in the accessibility gate so it scans the real rendering.
2. `PH1-02` — Repair the three broken legal links in the first-visit modal and return `check:predeploy` to a passing state.
3. `PH2-01` — Make the first-visit modal keyboard-operable and reliably dismissible.
4. `PH2-03` — Make one mechanism authoritative for the offer submenu and synchronise `aria-expanded`.
5. `PH3-01` — Bind button label colour to a theme-stable on-brand token that meets WCAG AA.

## Phase 1 — Quality gates and build contracts

**Goal:** Make the project's own validation and deployment contracts trustworthy, so every later phase can be verified against them.

- [ ] **PH1-01 — Serve correct MIME types from the accessibility gate's static server** — **Priority:** High
  - [ ] replace the `application/octet-stream` fallback in `scripts/qa-a11y.mjs` with a type map covering at least `.css`, `.js`, `.mjs`, `.json`, `.svg`, `.woff2`, `.png`, `.jpg`, `.webp`, `.avif`, `.ico`
  - [ ] align the equivalent branch in `scripts/check-links.mjs` so both harnesses share one convention
  - [ ] re-baseline the axe violation list produced against the corrected rendering and record which violations are pre-existing
  - **Completion condition:** during `npm run qa:a11y` the scanned page has the project stylesheet applied and `window.SC` defined, and the reported violations are reviewed against that corrected baseline
  - **Source:** `AUDIT.md` — P1-07

- [ ] **PH1-02 — Repair the first-visit modal's legal-document links** — **Priority:** High
  - [ ] point the `Regulamin`, `Polityka prywatności` and `Cookies` links in the project modal at the documents in `doc/`, using the root-relative convention already used by the footer
  - [ ] re-run the link checker and confirm no internal failures remain
  - **Completion condition:** `npm run check:links` reports no internal failures and all three modal links open the corresponding `doc/` page
  - **Source:** `AUDIT.md` — P1-01

- [ ] **PH1-03 — Make the deploy command produce the assets it publishes** — **Priority:** High
  - [ ] run the asset build (`build:css` + `build:js`) as part of the deploy path, or fail `scripts/build-dist.js` when a minified artefact is older than its canonical sources
  - [ ] keep the existing `ensureRequiredFilesExist()` presence check as a second guard
  - [ ] update `settings.md` — "Scripts" / "Deployment Notes" and the `README.md` maintenance sections to describe the new contract
  - **Completion condition:** a commit that edits a file under `css/modules/` or `js/modules/` and is deployed without a manual local build either produces regenerated minified output or fails the build
  - **Source:** `AUDIT.md` — P1-08

- [ ] **PH1-04 — Add the missing repository hygiene controls** — **Priority:** Medium
  - [ ] create `.gitignore` (new file) covering `node_modules/`, `dist/` and `.lighthouseci/`
  - [ ] create `.gitattributes` (new file) normalising tracked text files to LF, then renormalise the working tree
  - [ ] remove the two tracked duplicate gallery renditions whose filenames contain `" (1)"` from `assets/img/gallery/`
  - **Completion condition:** after a fresh `npm install` and `npm run build:dist`, `git status` is clean, `git diff --ignore-cr-at-eol` and `git diff` agree, and no tracked asset filename contains `" (1)"`
  - **Source:** `AUDIT.md` — P2-02

## Phase 2 — Entry-path and navigation accessibility

**Goal:** Make the two blocking interaction paths a visitor cannot avoid — the first-visit modal and the header offer submenu — correct, keyboard-operable and truthful in their ARIA state.

- [ ] **PH2-01 — Make the first-visit modal operable and reliably dismissible** — **Priority:** High
  - [ ] move focus into the dialog on open and restore it to a sensible element on dismissal
  - [ ] constrain Tab within the dialog and add an Escape dismissal path, reusing the focus pattern already implemented in `js/modules/lightbox.js` instead of introducing a second one
  - [ ] apply the existing `body.has-project-modal` scroll-lock class, which no code currently sets
  - [ ] wrap the `localStorage` read and write in `js/modules/project-banner.js` with the guarded helpers already used by `js/theme-init.js`, `js/modules/map-consent.js` and `js/modules/ui-core.js`, and set the hidden state before persisting
  - **Completion condition:** with the modal open, focus starts inside the dialog, Tab cycles only within it, Escape dismisses it, background scrolling is locked, focus returns after dismissal, and the modal is still dismissible when `localStorage` access throws
  - **Source:** `AUDIT.md` — P1-02, P2-12

- [ ] **PH2-02 — Define the navigation breakpoint once** — **Priority:** Medium
  - [ ] reconcile the `992px` / `991.98px` media queries in `js/modules/nav.js` with the `1024px` header breakpoint in `css/modules/layout.css`
  - [ ] reference the single agreed value from both layers so the drawer UI and the drawer logic switch at the same width
  - **Completion condition:** the viewport width at which the header switches between drawer and inline navigation is identical in CSS and JavaScript, verified at the boundary and at 1000 px
  - **Source:** `AUDIT.md` — P2-01

- [ ] **PH2-03 — Make one mechanism authoritative for the offer submenu state** — **Priority:** High
  - [ ] decide whether the `open` class toggled by `setDd()` in `js/modules/nav.js` or the CSS `:hover` / `:focus-within` rules own submenu visibility
  - [ ] implement the chosen mechanism in both layers: either add real `.dropdown.open` styles for the drawer and drive desktop visibility from the same class, or drop the class and synchronise `aria-expanded` with the CSS-driven state
  - [ ] ensure `focusFirstItem()` only targets elements that can actually receive focus
  - [ ] make the six service subpages reachable from the header below the navigation breakpoint
  - **Depends on:** `PH2-02`
  - **Completion condition:** below the navigation breakpoint, activating "Oferta" reveals the six submenu links and focus lands on the first one; at every viewport `aria-expanded` on the trigger matches the submenu's rendered visibility
  - **Source:** `AUDIT.md` — P1-03

## Phase 3 — Contrast and visible feedback states

**Goal:** Bring the primary controls and the contact form's feedback text to WCAG AA against their real rendered backgrounds, in both themes.

- [ ] **PH3-01 — Bind button labels to a theme-stable on-brand foreground token** — **Priority:** High
  - [ ] add a dedicated on-brand foreground token in `css/modules/tokens.css` that does not invert with the theme
  - [ ] bind `.btn` and `.project-modal__actions .btn` in `css/modules/components.css` to that token instead of `--fg` / `--bg`
  - [ ] re-measure the affected controls in both themes: hero CTAs, contact submit, subpage CTAs, modal accept
  - **Completion condition:** in both themes every `.btn` label measures at least 4.5:1 against its rendered background
  - **Source:** `AUDIT.md` — P1-05

- [ ] **PH3-02 — Style the contact form's status and error states for the orange section background** — **Priority:** Medium
  - [ ] add explicit `.is-ok` and `.is-err` rules, which `showNote()` toggles but which have no CSS anywhere in `css/`
  - [ ] choose status-note and field-error colours that clear 4.5:1 across the `--brand-grad` gradient rendered by `.cta`
  - [ ] distinguish success from failure by more than hue alone
  - **Completion condition:** success and error states are visually distinct, and both the status note and the field errors measure at least 4.5:1 against the contact section's rendered background
  - **Note:** the states reachable today are the phone-format error, the send-failure error and the success confirmation; the remaining required-field error cases become reachable with `PH4-01`
  - **Source:** `AUDIT.md` — P2-03

## Phase 4 — Contact form correctness

**Goal:** Make the implemented and documented validation, accessible error messaging and anti-spam behaviour actually execute without destroying user input.

- [ ] **PH4-01 — Let the submit handler own contact form validation** — **Priority:** High
  - [ ] add `novalidate` to the contact form in `index.html`, keeping the native constraint attributes for semantics and the no-JavaScript fallback
  - [ ] confirm the existing branch in `js/modules/forms.js` then runs for missing, too-short, too-long and unchecked-consent cases
  - [ ] verify the Netlify Forms submission path (`name="contact"`, `netlify-honeypot`, `action="/thank-you.html"`) is unaffected
  - **Completion condition:** submitting the empty form suppresses the browser bubble, sets `aria-invalid="true"` on each invalid field, renders the matching `.form-error` text, and announces the summary in the `role="status"` region
  - **Source:** `AUDIT.md` — P1-04

- [ ] **PH4-02 — Stop discarding user input on the anti-spam timing branch** — **Priority:** Medium
  - [ ] keep the honeypot, content heuristic and 2000 ms timing checks
  - [ ] remove the `form.reset()` call from the timing rejection path so entered values are preserved
  - [ ] surface a short retry message in the existing status region instead of returning silently
  - **Completion condition:** a submission rejected by the timing heuristic preserves all entered values and produces a visible, announced message
  - **Source:** `AUDIT.md` — P2-04

- [ ] **PH4-03 — Tie the capture-phase trim listener to the module's abort signal** — **Priority:** Low
  - [ ] replace the four-argument `form.addEventListener("blur", handler, true, { signal })` call in `js/modules/forms.js` with a single options object carrying both `capture` and `signal`
  - **Completion condition:** every listener registered in `js/modules/forms.js` is bound to the module's `AbortController` signal
  - **Source:** `AUDIT.md` — P2-09

## Phase 5 — Error, offline and cache contracts

**Goal:** Make the recovery pages and the service worker work in the nested-URL and offline situations they exist for.

- [ ] **PH5-01 — Convert `404.html` and `offline.html` to root-relative references** — **Priority:** High
  - [ ] rewrite stylesheet, script, favicon and navigation references in both documents to root-relative paths, matching the convention already used for `/manifest.webmanifest` and the `sw.js` precache list
  - [ ] re-run `npm run check:assets` and `npm run check:links`
  - **Completion condition:** requesting a non-existent nested path renders the styled 404 page with working recovery links, and an offline navigation to a subpage renders the styled offline page
  - **Source:** `AUDIT.md` — P1-06

- [ ] **PH5-02 — Complete the service-worker precache list and secure its runtime cache writes** — **Priority:** Medium
  - [ ] add `js/theme-init.min.js`, `js/sw-register.js` and the six `assets/fonts/*.woff2` files to the `ASSETS` list in `sw.js`
  - [ ] bump `CACHE_VERSION` alongside the precache change
  - [ ] pass the runtime cache writes in the fetch handler to `event.waitUntil` instead of leaving them as floating promises
  - **Depends on:** `PH5-01`
  - **Completion condition:** with the network disabled, a cached page renders with the stored theme, the enhanced (non-`no-js`) navigation and the project fonts
  - **Source:** `AUDIT.md` — P2-05

## Phase 6 — Gallery and lightbox interaction

**Goal:** Make each gallery item a single, correct tab stop and give the lightbox an accessible structure that matches its `aria-modal` contract.

- [ ] **PH6-01 — Bind gallery activation to the anchor instead of the inner image** — **Priority:** High
  - [ ] bind the lightbox click and Enter/Space handlers to `a.gallery-item` and prevent its default navigation
  - [ ] stop promoting the inner `<img>` to a focusable control with `tabindex="0"` and `role="button"`
  - [ ] keep the raw-image `href` as the no-JavaScript fallback
  - [ ] confirm the corrected pattern across all six `oferta/` subpages
  - **Completion condition:** each gallery item is a single tab stop, Enter and Space open the lightbox without navigating, and with JavaScript disabled the link still opens the full-size image
  - **Source:** `AUDIT.md` — P1-09

- [ ] **PH6-02 — Correct the lightbox's accessible structure** — **Priority:** Medium
  - [ ] append `.lb-close`, `.lb-prev` and `.lb-next` inside `.lb-wrap` so the `aria-modal` dialog contains its own controls, keeping the current fixed positioning
  - [ ] compose each thumbnail control's accessible name from its own `alt` text instead of overriding every one with `aria-label="Powiększ zdjęcie"`
  - [ ] keep the existing focus trap and focus-restore behaviour intact
  - **Depends on:** `PH6-01`
  - **Completion condition:** all lightbox controls are descendants of the `aria-modal` dialog element and remain Tab-reachable, and each thumbnail control exposes a name derived from its own `alt`
  - **Source:** `AUDIT.md` — P2-06, P2-07

## Phase 7 — Public content integrity

**Goal:** Resolve the mismatch between the site's demonstrational purpose and the indexable business identity it publishes.

- [ ] **PH7-01 — Align the published business identity with the project's demonstrational purpose** — **Status:** Blocked — **Priority:** High
  - **Blocker:** no recorded decision on whether the demo site is intended to be indexed; the two remediation paths (neutralise the identity claims, or `noindex` the site) are mutually exclusive
  - **Unblocks when:** the indexing intent is decided and recorded in `README.md`
  - [ ] if indexed: remove the postal address, telephone and `sameAs` profile links from the `GeneralContractor` JSON-LD in `index.html`, or drop the `GeneralContractor` type
  - [ ] if indexed: mark the 4.9/5 rating claim, the "Firmy, które nam zaufały" logo section and the testimonial cards as illustrative sample content
  - [ ] if indexed: align the "Realizacje" navigation label with the heading of the section it opens
  - [ ] if not indexed: set the pages to `noindex` and remove them from `sitemap.xml` and its generator
  - **Completion condition:** no structured data asserts a physical business location or contact identity for SolidCraft, unsupported trust claims are visibly marked as sample content, and the navigation label matches its target section — or the site is consistently non-indexable
  - **Source:** `AUDIT.md` — P1-10

## Phase 8 — Runtime and styling corrections

**Goal:** Remove the contained code-level defects that produce latent traps, console warnings and redundant work at runtime.

- [ ] **PH8-01 — Correct the `.ft-contact-icon` width declaration** — **Priority:** Low
  - [ ] replace the `width: 3318px` declaration in `css/modules/layout.css` with a value consistent with its `18px` height and flex basis
  - **Completion condition:** `.ft-contact-icon` declares a width consistent with its height, and the footer renders unchanged
  - **Source:** `AUDIT.md` — P2-08

- [ ] **PH8-02 — Resolve the passive double-tap listener in the lightbox** — **Priority:** Low
  - [ ] either register the `touchend` listener as non-passive so its `preventDefault()` applies, or drop the call and accept the browser default
  - **Completion condition:** double-tapping the lightbox viewport produces the intended behaviour with no passive-listener warning in the console
  - **Source:** `AUDIT.md` — P2-10

- [ ] **PH8-03 — Register the ScrollSpy `scrollend` listener once** — **Priority:** Low
  - [ ] register the `scrollend` listener for the module's lifetime, or guard `scheduleComputeAfterScroll()` so at most one pending listener exists
  - **Completion condition:** at most one pending `scrollend` listener exists at any moment during continuous scrolling
  - **Source:** `AUDIT.md` — P2-11

## Phase 9 — Documentation sync and final verification

**Goal:** Bring the project's canonical documents back in line with the corrected implementation and confirm the pre-deploy gate passes end to end.

- [ ] **PH9-01 — Synchronise the canonical documents with the corrected contracts** — **Priority:** Medium
  - [ ] update `settings.md` where the pipeline contract changed (`PH1-03`, `PH1-04`)
  - [ ] update the `README.md` accessibility, PWA, testing and maintenance sections where the described behaviour changed
  - [ ] record the significant completed changes in `CHANGELOG.md` under `[Unreleased]`
  - [ ] mark the resolved `AUDIT.md` findings as addressed rather than deleting the audit record
  - **Depends on:** `PH1-03`, `PH1-04`
  - **Completion condition:** no canonical document describes behaviour that the implementation no longer has
  - **Source:** `README.md`, `settings.md`, `CHANGELOG.md`, `AUDIT.md`

- [ ] **PH9-02 — Confirm the pre-deploy gate passes against the corrected implementation** — **Priority:** Medium
  - [ ] run `npm run check:html`
  - [ ] run `npm run qa:a11y` against the corrected static server and review the remaining violations
  - [ ] run `npm run format:check`
  - [ ] run `npm run build` and `npm run build:dist` and confirm the produced `dist/` contains regenerated minified assets
  - **Depends on:** `PH1-01`, `PH1-02`, `PH1-03`
  - **Completion condition:** `npm run check:predeploy` completes without failures and the produced `dist/` build matches the current canonical sources
  - **Source:** `settings.md` — "QA / Validation", `AUDIT.md` — P1-01, P1-07

## Optional future improvements

- [ ] **O-01 — Add functional browser tests on the existing Playwright dependency**
  - **Value:** regression coverage for the navigation drawer, the offer submenu, the lightbox and the contact-form submission paths, at no new dependency cost — `playwright` is already declared and already drives the `qa:a11y` harness
  - **Scope boundary:** explicitly non-blocking; the project ships without functional tests today
  - **Source:** `README.md` — "Roadmap", `AUDIT.md` — section 7

- [ ] **O-02 — Adopt `check:predeploy` as a required gate in a CI workflow**
  - **Value:** the documented pre-deploy gate would run automatically instead of depending on a local run; the repository currently contains no CI configuration
  - **Scope boundary:** explicitly non-blocking; worth doing only after `PH1-01` and `PH1-02`, so the gate is meaningful and green
  - **Source:** `README.md` — "Roadmap"

- [ ] **O-03 — Derive the service-worker cache version and precache list during the build**
  - **Value:** removes the silent-staleness class where a forgotten manual `CACHE_VERSION` bump leaves returning visitors on old unhashed `style.min.css` / `script.min.js`
  - **Scope boundary:** explicitly non-blocking; the manual process is documented in `README.md` and currently consistent
  - **Source:** `README.md` — "Roadmap", `AUDIT.md` — section 7

- [ ] **O-04 — Consolidate the sitemap source of truth**
  - **Value:** the tracked root `sitemap.xml` is copied into `dist/` and then overwritten by `build:sitemap`, so the file a maintainer edits never reaches production; removing or generating it in place eliminates the second source
  - **Scope boundary:** explicitly non-blocking; no incorrect sitemap is currently published
  - **Source:** `AUDIT.md` — section 7

- [ ] **O-05 — Extend accessibility scanning beyond the four scanned pages**
  - **Value:** the remaining five `oferta/` subpages and two `doc/` pages are unscanned, and the subpages carry the gallery structure addressed by `PH6-01`
  - **Scope boundary:** explicitly non-blocking; valuable only after `PH1-01`, otherwise it scans more unstyled, script-less pages
  - **Source:** `README.md` — "Roadmap", `AUDIT.md` — section 7
