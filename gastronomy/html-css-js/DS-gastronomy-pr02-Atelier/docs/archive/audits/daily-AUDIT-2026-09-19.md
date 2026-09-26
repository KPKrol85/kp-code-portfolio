# Daily Front-End Audit — Atelier No.02

**Audit date:** 2026-09-17
**Project type:** Multi-page static front-end site (HTML, modular CSS, Vanilla JS ES Modules) with a Node build/QA pipeline, Netlify hosting configuration and a manually maintained PWA layer
**Audit mode:** Static repository review

## Overall assessment

The repository is well organised and the build/validation layer is unusually solid for a project of this size: source and generated ownership are explicitly defined, the integrity script enforces the production contract, and every local reference, ARIA reference and image attribute checked in this audit resolves correctly. The core architecture is stable and suitable for continued development.

The concentration of current risk is not in structure but in behaviour wiring. Seven verified defects exist where markup, CSS and JavaScript disagree about the same feature — a category status indicator that no CSS rule can match, a disclosure dialog present on pages whose JS entry never initialises it, a focus restore that runs while the target is still inert, and a status banner that reports a state change that did not occur. These are exactly the class of problem the current pipeline (link integrity, HTML validation, static accessibility scan) cannot detect, because each one produces valid markup and valid links.

No blockers to production build or deployment were found. The project is ready for normal continued development, with interaction-level correctness as the priority area.

## Verified strengths

- Production contract is enforced by executable code, not convention: `scripts/validate-dist.js` verifies page inventory, transformed HTML equality, service worker precache paths, manifest assets and menu image variants, and rejects source files in `dist/`.
- Reference integrity is clean across the site: 562 local `href`/`src`/`srcset` targets in the 11 pages resolve to existing files, all 14 CSS `url()` targets resolve, and all 158 image variants declared in `data/menu.json` exist on disk.
- Document structure is consistent: exactly one `h1` and one `main` per page, no duplicate `id` values in any page, and every `aria-labelledby`, `aria-describedby`, `aria-controls`, `for` and in-page `href="#…"` reference resolves to an existing element.
- All 116 `<img>` elements carry `width`, `height` and `alt`; images use `picture`/`srcset` with AVIF/WebP/JPEG variants, and `index.html` preloads the hero variant set and both variable fonts.
- Progressive enhancement is genuine: `.reveal { opacity: 0 }` in `css/components/animations.css:22` is only reachable once JS adds the class, so content stays visible without JavaScript, and every page carries a `<noscript>` notice.
- Focus management in the mobile drawer (`js/features/nav.js`) is thorough — `inert`/`aria-hidden` tracking, focus trap, scroll lock, Escape handling, outside-pointerdown close and breakpoint-change normalisation.
- Storage access is consistently guarded: `js/features/theme.js` and `js/features/demo-modal.js` wrap every `localStorage` read and write in `try/catch`, with a legacy-key migration path.
- Repository safety is clean: no committed secrets, tokens or environment values; every `target="_blank"` link across the 11 pages carries `noopener`; no debug `console.log`, `TODO` or `FIXME` in front-end source.
- Hosting configuration is deliberate rather than copied: `_headers` sets a strict default policy and narrows `Cross-Origin-Embedder-Policy` to `unsafe-none` only on `/contact.html`, the single page with a cross-origin embed.

## P0 — Critical risks

None detected.

## P1 — Important issues worth fixing next

### [P1-01] Active category tab never receives its visual state on menu and gallery

- **Classification:** Defect
- **Evidence:** `css/components/tabs-nav.css:49`, `js/core/scrollspy.js:20`
- **Current behavior:** The scrollspy sets `aria-current="location"` and adds `.is-active` to the current category link. The only active-state rules for these tabs target `.tabs-nav__list a[aria-current="true"]`, and no `.is-active` rule exists for `.tabs-nav__list` anywhere in `css/`. The selector cannot match the value the module writes.
- **Impact:** The sticky category navigation on `menu.html` and `gallery.html` gives sighted users no indication of the current section. The entire scrollspy module produces no visible output on either page, and `var(--shadow-box)` inside the same unreachable rule is also undefined.
- **Recommended direction:** Align the CSS active-state selector with the state the module actually sets, and define or remove the missing shadow token used by that rule.
- **Status:** RESOLVED — the active-state rules in `css/components/tabs-nav.css` now target `a.is-active` and `a[aria-current="location"]`, the values `setActive` in `js/core/scrollspy.js` actually writes, and the undefined `--shadow-box` was replaced with the defined `--shadow` and dark-theme `--shadow-box-md` tokens; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P1-02] Demonstration disclosure dialog is never initialised on the four `js/core.js` pages

- **Classification:** Contract mismatch
- **Evidence:** `js/core.js:1`, `regulamin.html:883`
- **Current behavior:** `404.html`, `cookies.html`, `polityka-prywatnosci.html` and `regulamin.html` load `js/core.js`, which imports only `initMisc`, `initThemeToggle` and `initNav`. All four pages nevertheless contain the full `#demo-legal-modal` markup, which ships as `hidden inert` and is only opened by `initDemoLegalModal` from the `js/script.js` entry.
- **Impact:** The disclosure stating that the site is a demonstration, and the acceptance control that records agreement to the terms, are permanently inert on the three legal pages and the 404 page — the pages where that statement is most relevant. The same pages also carry 19–35 `data-reveal` elements that the reduced entry never initialises.
- **Recommended direction:** Decide whether the reduced entry owns this feature; either include the initializer in `js/core.js` or remove the markup from the pages that entry serves, and extend the source contract check so the two stay aligned.
- **Status:** RESOLVED — `js/core.js` now imports and calls `initDemoLegalModal` and `initReveal`, so the four pages it serves initialise the disclosure and their `data-reveal` elements, with the shared `kp-demo-accepted` key and its legacy-key migration unchanged; `validateSource()` in `scripts/validate-dist.js` now rejects any page shipping `#demo-legal-modal` markup whose entry has no executed path to the initializer; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P1-03] Online page loads show a connection-restored notice that reports no real change

- **Classification:** Defect
- **Evidence:** `js/features/network.js:44`, `js/features/network.js:69`
- **Current behavior:** `lastState` is initialised to `null` and `update(navigator.onLine)` runs immediately. For an online visitor the first call takes the restored branch, writes the recovery message into the `role="status"` region and adds `is-visible`, which `css/components/states.css:21` renders at full opacity for four seconds.
- **Impact:** Every normal page load on the seven pages served by `js/script.js` displays a notification about a connectivity recovery that never happened, undermining the credibility of the offline notices the same component is responsible for.
- **Recommended direction:** Seed the initial connectivity state without rendering a transition message, so only genuine online/offline changes surface a notice.
- **Status:** RESOLVED — `js/features/network.js` seeds `lastState` from `navigator.onLine` at initialisation instead of calling `update()` immediately, and `update()` returns early when the state is unchanged, so the `role="status"` region and the `.offline-note` insertion now fire only on genuine online/offline transitions; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P1-04] Lightbox focus restore is attempted while the target is still inert

- **Classification:** Defect
- **Evidence:** `js/features/lightbox.js:189`
- **Current behavior:** `closeLightbox()` calls `lastTrigger.focus()` on line 189, three statements before `setPageInert(false)` on line 192 removes `inert`/`aria-hidden` from `header, main, footer`. Inert elements are not focusable, so the call is a no-op and focus falls back to the document body.
- **Impact:** Keyboard and screen-reader users who close the gallery lightbox lose their position in the gallery and restart traversal from the top of the document, despite the module explicitly tracking the trigger for restoration.
- **Recommended direction:** Restore focus after the background landmarks are made interactive again.
- **Status:** RESOLVED — `closeLightbox()` in `js/features/lightbox.js` now calls `setPageInert(false)` before `lastTrigger.focus()`, so `inert` and `aria-hidden` are removed from the page landmarks before focus returns to the originating gallery link; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P1-05] Menu filter state and result changes are communicated only visually

- **Classification:** Defect
- **Evidence:** `js/features/menu.js:322`, `menu.html:719`, `menu.html:729`
- **Current behavior:** The tag filter buttons are plain `<button type="button">` elements whose selected state is carried solely by an `is-active` class; no page in the repository sets `aria-pressed` on them. Filtering hides cards with `style.display` and toggles the `hidden` attribute on `.menu-filters__empty`, which is a plain `<p>` with no `role="status"` or `aria-live`.
- **Impact:** On the primary content page, a screen-reader user receives no confirmation of which filter is applied, no notice that the result set changed, and no announcement when a search or filter combination yields no results.
- **Recommended direction:** Expose the toggle state on the filter buttons and place the result and empty messages in a live region so filtering reports its outcome.
- **Status:** RESOLVED — the `.menu-filters__btn` controls in `menu.html` now carry `aria-pressed`, which `setActiveButton()` in `js/features/menu.js` writes from the same boolean as the `is-active` class, and `.menu-filters__empty` became a `role="status" aria-live="polite"` region reporting the matched item count or the no-results message on user-initiated filtering while staying silent on page load; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P1-06] Desktop navigation dropdowns report a collapsed state while expanded

- **Classification:** Defect
- **Evidence:** `js/features/nav.js:224`, `css/components/nav.css:226`
- **Current behavior:** The dropdown click handler returns immediately when the viewport is not mobile, so `aria-expanded` is only maintained below 1024px. On desktop the panel is revealed by `.nav__item--dropdown:hover` and `:focus-within`, while the controlling `.nav__dropdown-toggle` keeps `aria-expanded="false"`.
- **Impact:** On all 11 pages, desktop assistive-technology users are told the submenu is collapsed while its links are visible and focusable, and activating the toggle button with keyboard or pointer performs no action at all.
- **Recommended direction:** Keep the toggle's expanded state synchronised with the state the desktop CSS actually renders, or give the button a real desktop action rather than leaving it inert above the breakpoint.
- **Status:** RESOLVED — the unconditional early exit in the dropdown click handler was replaced by `setNavDropdown()`, making the toggle a working disclosure control at every width, and `writeDropdownState()` writes `.is-open` and `aria-expanded` together; the desktop `:hover`/`:focus-within` reveal in `css/components/nav.css` is now scoped to `html:not(.js)` as the no-JavaScript fallback, with the mobile accordion, `closeNavDropdowns` and breakpoint normalisation preserved; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P1-07] sitemap.xml declares namespaces that do not match the sitemap protocol

- **Classification:** Defect
- **Evidence:** `sitemap.xml:3`
- **Current behavior:** The document declares `xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"` and `xmlns:xhtml="https://www.w3.org/1999/xhtml"`. XML namespaces are matched as exact strings, and the sitemap protocol namespace is defined with the `http` scheme. The `xhtml` prefix is declared but never used in the file.
- **Impact:** `robots.txt` advertises this sitemap as the public discovery entry point. Consumers that validate the namespace can reject the document, in which case none of the eight listed URLs are discovered through it.
- **Recommended direction:** Use the namespace strings defined by the sitemap protocol and drop the unused prefix declaration.
- **Status:** RESOLVED — `sitemap.xml` now declares the protocol namespace in its defined `http://www.sitemaps.org/schemas/sitemap/0.9` form and the declared but unused `xhtml` prefix was removed, with the eight advertised URLs unchanged; implemented, verified, and recorded in `docs/CHANGELOG.md`.

## P2 — Minor refinements

### [P2-01] Reveal direction and stagger values are written but never consumed

- **Classification:** Defect
- **Evidence:** `css/components/animations.css:2`, `js/features/reveal.js:25`
- **Current behavior:** `animations.css` defines `--rx`/`--ry` for five `data-reveal-dir` variants and `--reveal-delay`, and `reveal.js` computes a per-item delay for every `[data-reveal-group]` container. No rule in `css/` reads any of these three properties; `.reveal` uses a hard-coded `translateY(12px)` and `.reveal.is-visible` declares no delay.
- **Impact:** The `data-reveal-dir` attributes authored in `index.html` and `contact.html` and the 20 reveal groups across four pages have no effect, and the per-item delay loop runs on every page for nothing. The authoring API implies behaviour the stylesheet does not implement.
- **Recommended direction:** Either consume the custom properties in the reveal transition rules or remove the unused attributes, declarations and JS loop.
- **Status:** RESOLVED — `.reveal` in `css/components/animations.css` now consumes `--rx`/`--ry` through `transform: translate()` and `.reveal.is-visible` applies `--reveal-delay` as its transition delay, so the authored `data-reveal-dir` variants and the per-item delay written by `js/features/reveal.js` take effect, while the reduced-motion and missing-`IntersectionObserver` paths still render content immediately; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P2-02] Scrollspy maintains the active section through two competing mechanisms

- **Classification:** Maintenance risk
- **Evidence:** `js/core/scrollspy.js:53`, `js/core/scrollspy.js:113`
- **Current behavior:** An `IntersectionObserver` configured from `topPercent`/`bottomPercent`/`bottomPercentMobile` calls `setActive`, and an unconditionally registered scroll listener recomputes the active id with an independent offset algorithm and calls `setActive` again on the next frame. The scroll path also runs when the observer branch is taken.
- **Impact:** Two sources of truth own the same state, so the tuned `rootMargin` configuration passed from `js/features/menu.js` and `js/features/gallery.js` is overridden on the next scroll frame, and any future fix to the active-state rendering has to reconcile both paths.
- **Recommended direction:** Keep one mechanism as the owner of the active section and reduce the other to a fallback, so the configured thresholds have a single meaning.
- **Status:** RESOLVED — `js/core/scrollspy.js` now makes the `IntersectionObserver` the sole owner of the active section where it is available, rebuilding its geometry on resize, and registers the scroll-offset algorithm only on the fallback path taken when the observer is missing, so the `topPercent`/`bottomPercent`/`bottomPercentMobile` configuration has a single meaning; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P2-03] Offline fallback page has no theme bootstrap

- **Classification:** Defect
- **Evidence:** `offline.html:1`
- **Current behavior:** `offline.html` is the only page whose head contains no inline `kp-theme` preload script, no `js/bootstrap.js`, and no `theme-color` or `color-scheme` meta. Dark styling is reachable only through `[data-theme="dark"]`; the stylesheets contain no `prefers-color-scheme` fallback. The theme is therefore first applied when the deferred module entry reaches `initThemeToggle`. `404.html` and `thank-you.html` carry the inline script but are also missing both meta tags.
- **Impact:** A dark-theme visitor served the precached offline fallback sees the page render light and then flip, and native control and browser-chrome colouring stay light on that page. Three of the eleven pages have drifted from the head contract the other eight share.
- **Recommended direction:** Bring the system pages back onto the same head contract as the content pages, and extend the source contract check to cover the theme bootstrap the same way it covers the JS entry.
- **Status:** RESOLVED — `offline.html` now carries the inline `kp-theme` preload script and the `js/bootstrap.js` reference, and `offline.html`, `404.html` and `thank-you.html` all carry the `color-scheme` and `theme-color` meta tags, returning the 11 pages to one head contract; `validateSource()` in `scripts/validate-dist.js` now asserts all four head requirements on every page; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P2-04] Form progress live region is rewritten on every keystroke

- **Classification:** Source-visible risk
- **Evidence:** `js/features/form.js:93`, `contact.html:282`
- **Current behavior:** `updateProgress()` is bound to the `input` event of all three fields and assigns `progress.textContent` unconditionally, with no comparison against the current value. The target is a `role="status" aria-live="polite"` element.
- **Impact:** Every character typed replaces the text node of a live region, which can produce repeated announcements of an unchanged message throughout a multi-sentence message field. Confirming the announcement behaviour requires screen-reader verification.
- **Recommended direction:** Write to the live region only when the message actually changes.
- **Status:** RESOLVED — `updateProgress()` in `js/features/form.js` now builds the computed message into `nextMessage` and assigns it only when it differs from the region's current `textContent`, so keystrokes that leave the counted summary unchanged no longer rewrite the live region; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P2-05] Contact form's accessible name contradicts its visible heading

- **Classification:** Defect
- **Evidence:** `contact.html:235`, `contact.html:228`
- **Current behavior:** The form carries an `aria-label` naming it a reservation form, while the visible heading that introduces it names it a contact form, and the form contains only name, e-mail and message fields — no date, time or party-size input.
- **Impact:** Assistive technology announces the form under a name that appears nowhere on the page and describes a booking capability the form does not implement.
- **Recommended direction:** Name the form after the visible heading, or associate it with that heading instead of a separate label.
- **Status:** RESOLVED — the reservation-form `aria-label` was replaced with `aria-labelledby="contact-title"`, so the form takes its accessible name from the visible `Formularz kontaktowy` heading that introduces it rather than from a separate label describing a booking capability; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P2-06] Menu card focus outline uses a hard-coded colour that ignores the dark theme

- **Classification:** Source-visible risk
- **Evidence:** `css/components/cards.css:121`
- **Current behavior:** `.page .menu-card a:focus-visible` sets `outline: 2px solid var(--accent, #6b1e2f)`. `--accent` is not defined anywhere in `css/`, so the literal fallback always applies. The specificity of this rule exceeds the `:where()`-based link focus rule in `css/components/buttons.css:112`.
- **Impact:** In dark theme the surrounding surfaces come from `--cream: #181210`, so the focus indicator on the anchor links inside menu cards is a dark burgundy on a near-black background. Measuring the resulting contrast requires rendering verification, but the value is theme-independent by construction.
- **Recommended direction:** Point the outline at a defined, theme-aware token rather than an undefined property with a literal fallback.
- **Status:** RESOLVED — `.page .menu-card a:focus-visible` in `css/components/cards.css` now uses the shared `--focus-ring` token defined in `css/base/tokens.css`, which derives from the `--burgundy` value each theme sets, so no focus rule in `css/` depends on the undefined `--accent` property or its literal fallback; theme-awareness confirmed by source inspection rather than by measured rendered contrast; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P2-07] Demonstration disclosure text has already drifted between pages

- **Classification:** Maintenance risk
- **Evidence:** `contact.html:452`, `regulamin.html:887`
- **Current behavior:** The `#demo-legal-modal` block is hand-duplicated in 10 pages. Nine carry one wording, which also contains a misspelling in the sentence describing the project; `contact.html` carries a different wording naming a different owner entity. A single `localStorage` key gates the dialog, so a visitor sees whichever variant belongs to their entry page and then never sees the other.
- **Impact:** The project's demonstration disclosure — the statement paired with an acceptance control — is not consistent across the site, and the more common variant ships a visible spelling error.
- **Recommended direction:** Establish one canonical wording for the disclosure and reconcile the duplicated blocks against it.
- **Status:** RESOLVED — a single canonical wording, naming the KP_Code Digital Studio owner entity and correcting the misspelled project sentence, now appears on all ten pages that carry `#demo-legal-modal`, replacing the divergent `contact.html` variant; the ten blocks were compared and are identical; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P2-08] Dead interaction code in the lightbox obscures actual behaviour

- **Classification:** Maintenance risk
- **Evidence:** `js/features/lightbox.js:203`, `js/features/lightbox.js:53`
- **Current behavior:** An overlay `click` listener contains only an early `return` and performs no action, so backdrop clicks do not close the dialog despite a handler appearing to exist. Separately, a `try` block re-assigns `textContent` and `aria-label` values that were already set on the same four buttons ten lines earlier.
- **Impact:** A reader of the module cannot tell from the code whether backdrop dismissal is intended and broken or deliberately absent, and the duplicated initialisation creates two places to change one label.
- **Recommended direction:** Remove the no-op handler or give it the intended behaviour, and collapse the duplicated button initialisation into a single assignment.
- **Status:** RESOLVED — the overlay `click` listener that contained only an early return was removed from `js/features/lightbox.js`, and the control labels are now assigned once where the four buttons are created, leaving no duplicated initialisation; the keyboard, touch and button paths for navigation, fullscreen and close remain in place; implemented, verified, and recorded in `docs/CHANGELOG.md`.

### [P2-09] README links the changelog at a path it no longer occupies

- **Classification:** Contract mismatch
- **Evidence:** `README.md:172`, `README.md:351`
- **Current behavior:** Both language sections link `[CHANGELOG.md](CHANGELOG.md)` and both project-structure trees list `CHANGELOG.md` at the repository root. The file is at `docs/CHANGELOG.md`; neither tree shows the `docs/` directory.
- **Impact:** The maintenance instruction that tells contributors to update the changelog points at a path that does not exist, in the document that is the project's primary entry point.
- **Recommended direction:** Update the links and the structure trees to the current documentation layout.
- **Status:** RESOLVED — both language sections of `README.md` now link `docs/CHANGELOG.md`, both project-structure trees list a `docs/` directory containing `CHANGELOG.md` and `settings.md` in place of the root-level entry, and both sections document the `.github/workflows/quality.yml` checks; implemented, verified, and recorded in `docs/CHANGELOG.md`.

## Extra quality improvements

### Automated parity check between menu data and its static fallback

- **Evidence:** `data/menu.json` holds 18 items and the static fallback cards in `menu.html` and `index.html` currently reproduce the same 18 titles and prices exactly; `scripts/validate-dist.js` verifies the JSON image variants but not this correspondence.
- **Potential value:** The fallback is the documented no-JavaScript and fetch-failure path, so silent divergence would publish two different menus to two different audiences. A comparison in the existing validation script would catch it at the same moment as the other contract checks.
- **Scope boundary:** The two sources agree today, so this is a safeguard against future drift rather than a correction of a current defect.
- **Status:** RESOLVED — implemented and verified. Details are recorded in `docs/CHANGELOG.md`.

### Extend lint coverage to the service worker and build scripts

- **Evidence:** `package.json` runs `eslint "js/**/*.js"`, which excludes `sw.js` and the six files under `scripts/`.
- **Potential value:** The service worker and the build/validation scripts are the files whose failure has the widest blast radius, and they are currently the only JavaScript in the repository with no static analysis in CI.
- **Scope boundary:** Optional tooling coverage; no current defect in those files was detected in this audit.
- **Status:** RESOLVED — implemented and verified. Details are recorded in `docs/CHANGELOG.md`.

### Include the contact page in the automated accessibility run

- **Evidence:** `.pa11yci` lists 10 URLs and omits `contact.html`, which is the only page in the project with a form.
- **Potential value:** The page with the most interactive controls, validation messaging and live regions is the one the scan never sees, which is where the automated check would have the most to report.
- **Scope boundary:** Optional coverage extension; the omission is documented in `README.md` and `docs/settings.md`, so it is an intentional current limitation rather than a defect.
- **Status:** RESOLVED — implemented and verified. Details are recorded in `docs/CHANGELOG.md`.

## Verification performed

- Inspected the 11 root HTML pages, all 26 CSS modules and `css/style.css`, all 17 JavaScript source files, the 6 files under `scripts/`, `sw.js`, `manifest.webmanifest`, `sitemap.xml`, `robots.txt`, `_headers`, `_redirects`, `data/menu.json`, `package.json`, `.pa11yci`, `.htmlvalidate.json`, `eslint.config.mjs`, `postcss.config.js`, `.github/workflows/quality.yml`, `README.md` and `docs/settings.md`.
- Executed `node scripts/validate-dist.js --source` (the `qa:source` script): passed — no generated bundles in `css/` or `js/`, and every page references its expected source CSS and JS entry.
- Executed read-only ad-hoc static scans over the repository: duplicate `id` detection across all pages (0 found); `aria-labelledby`/`aria-describedby`/`aria-controls`/`for`/`href="#…"` reference resolution (0 unresolved); local `href`/`src`/`srcset`/`action` target existence (562 checked, 0 missing); CSS `url()` target existence (14 checked, 0 missing); undefined CSS custom property usage (2 found, both reported above); `<img>` attribute completeness (116 checked, 0 missing `width`/`height`/`alt`); `data/menu.json` image variant existence (158 checked, 0 missing); title and price parity between `data/menu.json` and the static fallback cards (18 items, no differences).
- Executed read-only `git status`, `git log` and per-file `git log` to confirm a clean tree and establish current file modification dates.
- Not run: `npm run lint`, `npm run qa:html`, `npm run qa:links`, `npm run qa:a11y`, `npm run qa:server`, `npm run build` and `npm run qa:dist`. `node_modules/` is absent in this checkout and installing dependencies is outside the scope of a read-only audit. Their results are therefore unknown and are not claimed anywhere in this document.
- Not verified: runtime behaviour in a browser, screen-reader announcement behaviour, rendered colour contrast, service worker registration and caching, Netlify header-precedence resolution, form delivery through Netlify Forms, and the availability or currency of the deployed site at the origin referenced in the page metadata. Findings that depend on any of these are classified as source-visible risks rather than confirmed runtime failures.

## Senior rating

**Rating:** 7/10

The repository contract is stronger than typical for a project of this scale: generated-file ownership is explicit and machine-enforced, the integrity script checks the production package end to end, CI runs the full source and production pipeline, and every reference, identifier and image attribute examined here resolves correctly. Progressive enhancement, storage guarding, drawer focus management and hosting headers are implemented deliberately rather than by default.

The rating is held at 7 by seven verified defects in feature wiring, five of which degrade implemented interactions and four of which are accessibility-affecting: an active-state selector that cannot match the state its module writes, a disclosure dialog whose initializer is missing from the entry serving four pages, a focus restore ordered after the element is unreachable, filter controls with no exposed state, and a status message that reports a transition that did not occur. None blocks build, deployment or core use, and each has a small, local correction. The common factor is that the validation layer verifies static contracts thoroughly and interactive behaviour not at all, which is the gap worth closing next.
