# Atelier No.02 — Quality Improvements

**Analysis date:** 2026-09-24
**Project type:** Static multi-page website (frontend-only, vanilla HTML/CSS/JS; no backend service)
**Analysis mode:** Evidence-based quality improvement review
**Focus:** Project-wide quality

> **Completion note:** All five quality improvements (IMP-QUALITY-01 to IMP-QUALITY-05) have been implemented, and their changes have been recorded in `docs/CHANGELOG.md`. This report was archived on 2026-09-25.

> **Historical scope:** The proposal text, expected benefits and selection summary preserve the analysis of 2026-09-24. Completion statuses record the later implementations. For IMP-QUALITY-01, the implemented guarantee is narrower than originally proposed, as clarified below.

## Improvement overview

Atelier No.02 has far more verification than a site of its size usually needs. `scripts/validate-dist.js` enforces page composition, the head, body and dialog contracts, parity between the menu data and its static fallback, image provenance, per-page metadata uniqueness and a byte-for-byte production package. html-validate, a link and fragment crawl and pa11y-ci run against both the composed sources and `dist/`, and CI runs the whole chain. The runtime modules degrade deliberately: storage access is guarded, a missing `IntersectionObserver` falls back, a failed menu fetch keeps the static cards, and failed menu and gallery thumbnails receive a placeholder. The archived audits record every finding as resolved or implemented, and the source contract passed when run during this review.

The opportunities below are in the places those mechanisms do not reach. The Service Worker cache version is the last runtime contract kept only by a manual rule, and five commits have changed precached CSS since it was last raised. The menu parity check covers title, price and category, but not the descriptions and tags that search and filtering actually read. The accessibility run audits pages as they load and never sees the contact form's error state. The project already supports offline use, yet two failure paths in it have no project-controlled outcome: a lightbox image that fails to load, and a contact form submitted while offline. None of these is a confirmed defect. Each one strengthens behavior that works today within its verified scope.

## Proposed improvements

### IMP-QUALITY-01 — Make the Service Worker cache-version rule verifiable

- **Affected area:** Service Worker update contract for returning visitors (`sw.js`); production integrity check (`scripts/validate-dist.js`).
- **Evidence:** `sw.js:1-2`, `sw.js:4-29`, `sw.js:31-34`, `sw.js:67-79`; `scripts/build-config.js:164-168`; `scripts/validate-dist.js:607-615`; `js/features/menu.js:30`, `js/features/menu.js:221`; `docs/CONTEXT-PROJECT.md:46`, `docs/CONTEXT-PROJECT.md:156`; `README.md:418`; Git history: `CACHE_VERSION` last changed in `5a7e42c` (1.6), after which `975ac7d`, `c570465`, `9f39636`, `90e8a71` and `56bcdca` each changed stylesheets imported by `css/style.css`.
- **Current implementation:** The cache name comes only from the hand-maintained `CACHE_VERSION` (`sw.js:1-2`). The worker precaches 19 entries at install, including the stylesheet, both script bundles and `data/menu.json` (`sw.js:4-29`). It removes other caches on activation (`sw.js:31-34`) and answers every non-navigation GET from Cache Storage before trying the network (`sw.js:67-79`). A browser installs an updated worker only when the served `sw.js` changes, and the build rewrites only path references in its `dist/` copy (`scripts/build-config.js:164-168`). Returning visitors therefore get new precached CSS, JS or menu data only after `CACHE_VERSION` changes, which is a documented manual rule (`docs/CONTEXT-PROJECT.md:156`, `README.md:418`). `validateDist()` asserts that the production worker is the transformed source and that every precache entry resolves (`scripts/validate-dist.js:607-615`), but nothing ties the precached content to the version. The same cache-first path answers `menu.js`'s `cache: "no-store"` request for `data/menu.json` (`js/features/menu.js:30`), and the rendered result replaces the static cards that arrived with the network-first page (`js/features/menu.js:221`). Whether the five CSS commits made after 1.6 already require a version bump depends on whether a 1.6 package has been deployed, and the repository cannot show that.
- **Proposed improvement:** Record a fingerprint of the precached content next to `CACHE_VERSION` in `sw.js`. The production integrity check then recomputes it from the `dist/` files that the precache entries resolve to. If the two differ, the check fails and tells the developer to raise `CACHE_VERSION` and record the new fingerprint.
- **Expected quality value:** A deployable package can no longer ship changed stylesheet, script, page or menu-data bytes under a cache name that returning visitors already hold. The network-first HTML and its cache-first CSS, JS and menu data therefore always come from the same release. The only runtime contract still maintained by hand becomes enforced by the validator that already guards the page, asset and precache contracts.
- **Implementation scope:**
  - Change `validateDist()` in `scripts/validate-dist.js`, reusing its sandboxed evaluation of `FILES_TO_CACHE` and its `assertReference()` path resolution.
  - Add one recorded value in `sw.js`, and the matching maintenance note in `README.md` and `docs/CONTEXT-PROJECT.md`.
  - Leave unchanged: the caching strategy, cache naming, precache list, install and activate handlers, registration in `js/bootstrap.js`, and the build's path rewriting. `sw.js` stays hand-maintained, and the check only reads files.
  - Raising the version for the changes already pending is a release step, not part of this proposal.
- **Acceptance criteria:** `npm run build` (through `qa:dist:integrity`) fails with a message naming `CACHE_VERSION` when the content behind any precache entry differs from the recorded fingerprint. It passes after the version is raised and the new fingerprint recorded. Changing only a page that is not precached, such as `contact.html`, does not trigger it, and `npm run qa:source` behaves as before.
- **Impact:** High
- **Effort:** Medium
- **Status:** COMPLETED — Recorded a SHA-256 precache fingerprint beside `CACHE_VERSION` in `sw.js`, which the production integrity check recalculates from `dist/` and rejects on mismatch.
- **Implemented guarantee:** The validator detects a mismatch between the calculated and recorded precache fingerprints. It does not compare `CACHE_VERSION` with a previous release or enforce an increment; raising that version remains a maintenance requirement. It also does not guarantee atomic release consistency in the browser: network-first HTML and cache-first assets can come from different releases. The stronger claims in the original expected value and selection summary are historical expectations, not guarantees of the completed implementation.

### IMP-QUALITY-02 — Extend menu parity to descriptions, tags and filter values

- **Affected area:** Menu search and tag filtering (`menu.html`); static fallback cards on `menu.html` and `index.html`; `validateMenuParity()` in `scripts/validate-dist.js`.
- **Evidence:** `scripts/validate-dist.js:208-218`, `scripts/validate-dist.js:232-302`; `js/features/menu.js:28-42`, `js/features/menu.js:140-145`, `js/features/menu.js:201-226`, `js/features/menu.js:259-267`, `js/features/menu.js:305-326`; `menu.html:657-663`; `docs/CONTEXT-PROJECT.md:100`.
- **Current implementation:** The filter tags each card from the text of its `.menu-card__tag` items (`js/features/menu.js:259-267`). It matches the selected `data-filter` value against those tags exactly, and matches the search term against the card title and its `.card__text` description (`js/features/menu.js:305-326`). The cards are either rendered from `data/menu.json` (`js/features/menu.js:140-145`, `201-226`) or, when the fetch fails, are the static cards shipped in the page (`js/features/menu.js:28-42`). `validateMenuParity()` keeps both sources aligned on title, price, category and the featured selection (`scripts/validate-dist.js:232-302`), but `staticCards()` reads only title and price (`scripts/validate-dist.js:208-218`). Descriptions and tags stay in sync only through the manual rule in `docs/CONTEXT-PROJECT.md:100`, and nothing checks that the `data-filter` values in `menu.html:657-663` exist in the data. A read-only scan during this review found both fields identical today (18 `menu.html` cards and 3 `index.html` featured cards, no differences), with all six filter values present among the 12 data tags.
- **Proposed improvement:** Extend the existing parity check so that each static card's description and ordered tag list must equal its `data/menu.json` item. Each `menu.html` `data-filter` value other than `*` must also appear in the data's tag vocabulary.
- **Expected quality value:** Search and filtering return the same results whether the cards were rendered from the data or kept from the static fallback. A tag renamed in one source can no longer leave a filter button that silently matches nothing. The check runs where the other menu invariants already run: `npm run qa:source`, `npm run qa:dist:integrity` and CI.
- **Implementation scope:**
  - Change only `scripts/validate-dist.js`: `staticCards()`, `validateCompleteMenu()`, `validateFeaturedMenu()`, and one new assertion over `menu.html`'s `[data-filter]` values.
  - Reuse the existing tag helpers and the `elementText()` normalization.
  - Leave `js/features/menu.js`, `menu.html`, `index.html` and `data/menu.json` unchanged. The existing title, price, category and featured-selection assertions keep their behavior and messages.
- **Acceptance criteria:** `npm run qa:source` passes on the current tree. It fails, with a message naming the page and the affected dish or filter value, for each of three temporary edits: a changed tag on one static card, a changed description on one static card, and a `data-filter` value that matches no tag in `data/menu.json`. Each edit is reverted afterwards.
- **Impact:** Medium
- **Effort:** Small
- **Status:** COMPLETED — Extended `validateMenuParity()` so every static card's description and ordered tags must equal its `data/menu.json` item, and every `menu.html` `data-filter` other than `*` must name a data tag.

### IMP-QUALITY-03 — Audit the contact form's validation-error state with pa11y-ci

- **Affected area:** Automated accessibility verification of the contact form (`.pa11yci`), run against both the source and production servers.
- **Evidence:** `.pa11yci:18-30`; `scripts/qa-server.js:34-37`; `js/features/form.js:48-59`, `js/features/form.js:96-106`; `contact.html:158-167`, `contact.html:175-188`; `css/components/forms.css:41-50`; `js/features/demo-modal.js:85-100`, `js/features/demo-modal.js:132`; `css/components/modal.css:1-16`; `README.md:363`; `docs/CONTEXT-PROJECT.md:105`; `package-lock.json` (`pa11y-ci` 3.1.0 with `pa11y` 6.2.3).
- **Current implementation:** `.pa11yci` lists the 11 pages as plain URLs, so HTML CodeSniffer audits each page only as it loads (`.pa11yci:18-30`). The same file serves both `npm run qa` and `npm run qa:dist` (`scripts/qa-server.js:34-37`). The form's error state appears only after interaction: when an invalid field loses focus, it receives `aria-invalid="true"`, the `.is-invalid` styling and a message in its empty `#error-*` element (`js/features/form.js:48-59`, `96-106`; `contact.html:175-188`; `css/components/forms.css:41-50`). Neither the error text nor its styling exists when the audit runs, a gap that both the README and the project context record (`README.md:363`, `docs/CONTEXT-PROJECT.md:105`). Two details constrain any test scenario:
  - The form has no `novalidate` (`contact.html:158-167`), so the browser's built-in validation stops an empty submit before the script's submit handler runs.
  - On pa11y's fresh browser profile, the demonstration dialog opens as a full-viewport layer that captures clicks (`js/features/demo-modal.js:85-100`, `132`; `css/components/modal.css:1-16`).
- **Proposed improvement:** Add one `contact.html` entry to `.pa11yci`, under a distinct URL. Its pa11y actions accept the demonstration dialog, move focus through the three fields so each is validated when it loses focus, and wait for the invalid state before the audit runs.
- **Expected quality value:** Every source and production QA run audits the error messages, `aria-invalid` states and invalid-field styling of the site's only form. This covers a state the configured check could never reach, using pa11y action support that is already installed.
- **Implementation scope:**
  - Change `.pa11yci`, plus the limitation sentence in `README.md` and `docs/CONTEXT-PROJECT.md`.
  - Leave unchanged: the 11 existing URLs, the WCAG2AA/htmlcs defaults, `js/features/form.js` and `contact.html`. No dependency, runner or test framework is added.
  - Any issue the new scenario reports is handled as a separate finding.
- **Acceptance criteria:**
  - `npm run qa` and `npm run qa:dist` each report 12 pa11y-ci results.
  - In the new scenario, a `wait for element` action holds the audit back until all three fields carry `aria-invalid="true"` and non-empty error text.
  - A temporarily broken selector in the scenario fails the run instead of silently auditing the page as it loads.
- **Impact:** Medium
- **Effort:** Small
- **Status:** COMPLETED — Added a 12th `.pa11yci` entry, `contact.html?a11y=form-errors`, whose actions accept the demo dialog, blur all three empty fields and hold the audit until each has `aria-invalid="true"` and error text; source and production QA both pass 12/12.

### IMP-QUALITY-04 — Recover from a failed full-size image in the gallery lightbox

- **Affected area:** Gallery lightbox on `gallery.html` and in the homepage gallery section (`js/features/lightbox.js`).
- **Evidence:** `js/features/lightbox.js:132-160`; `css/components/lightbox.css:30-46`; `js/features/menu.js:9-24`; `gallery.html:160`; `sw.js:4-24`, `sw.js:67-79`; `js/features/network.js:19-28`; `js/app/init.js:16`, `js/app/init.js:19`.
- **Current implementation:** `render()` sets the lightbox image to the trigger link's `href`, a 1600-pixel JPEG such as the one at `gallery.html:160`. It reveals the image only from an `onload` handler that adds `is-ready` (`js/features/lightbox.js:147-160`); until then the image stays at `opacity: 0` (`css/components/lightbox.css:30-46`). There is no error handling. A failed request leaves the dialog open, with its caption, counter and controls around an invisible image, while the live region still announces "Obraz n z m" (`js/features/lightbox.js:132-135`). The grid thumbnails already have a fallback: `initImageFallbacks()` covers `.gallery__img` (`js/features/menu.js:9-24`). The full-size files, however, are not precached (`sw.js:4-24`). They are requested only when the lightbox opens them or prefetches a neighbor (`js/features/lightbox.js:136-146`), and non-navigation requests fail without any offline response (`sw.js:67-79`). The project's own offline note already warns gallery visitors that some photos may not load (`js/features/network.js:19-28`).
- **Proposed improvement:** Handle a failed lightbox image by falling back once to the image the trigger's thumbnail is already showing. If no usable source is left, show a visible, announced "image unavailable" state instead of an invisible image.
- **Expected quality value:** When a full-size request fails, including in the offline case the project already anticipates, the lightbox still shows the photo at thumbnail resolution, from a source the browser has already loaded. If even that is unavailable, it tells both sighted and screen-reader users, instead of showing an empty dialog.
- **Implementation scope:**
  - Change `render()` in `js/features/lightbox.js`. Add a small state rule in `css/components/lightbox.css` only if the failure message needs styling.
  - Leave unchanged: grouping, the counter, keyboard shortcuts, swipe, fullscreen, the Tab trap, focus restoration, the 44×44px controls and `initImageFallbacks()`.
  - Try the fallback at most once per image so a failing fallback cannot loop. The next image that loads successfully shows no leftover error state.
- **Acceptance criteria:**
  - With the full-size JPEG blocked (for example through DevTools request blocking), opening it in the lightbox shows the thumbnail-resolution image.
  - With both sources blocked, it shows a visible unavailability message that the live region announces.
  - Previous and next navigation keeps loading and rendering images normally.
  - Behavior is unchanged when the network is unrestricted.
- **Impact:** Medium
- **Effort:** Small
- **Status:** COMPLETED — A failed full-size lightbox image now falls back once to the trigger's loaded thumbnail, otherwise shows and announces "Nie udało się wczytać zdjęcia."; the Service Worker cache was raised to v1.7 with a recalculated precache fingerprint.

### IMP-QUALITY-05 — Keep an offline contact-form submission on the page

- **Affected area:** Contact form submission (`js/features/form.js`) on `contact.html`.
- **Evidence:** `js/features/form.js:110-120`; `contact.html:158-167`, `contact.html:214`; `sw.js:39`, `sw.js:45-58`; `js/features/network.js:31-83`; `js/app/init.js:13`, `js/app/init.js:17`; `README.md:400`.
- **Current implementation:** Once client-side validation passes, the submit handler writes "Wysyłanie…" into the `#form-status` live region and lets the browser's native POST to Netlify Forms go ahead (`js/features/form.js:110-120`; `contact.html:158-167`, `214`). The handler never checks connectivity, although the same page runs `initNetworkStatusBanner()`, which tracks `navigator.onLine` and shows an offline banner (`js/app/init.js:13`, `17`; `js/features/network.js:31-83`). The Service Worker ignores non-GET requests (`sw.js:39`; `README.md:400`), but it can serve a previously visited `contact.html` from cache while offline (`sw.js:45-58`). An offline submission therefore ends on the browser's own network-error page. Whether the typed message survives going back to the form depends on the browser's history and form-restoration behavior, which was not verified.
- **Proposed improvement:** When the browser reports it is offline at submission time, cancel the native submission and keep the entered values in place. Use the existing `#form-status` region to say that sending needs a connection, so the visitor can submit again once back online.
- **Expected quality value:** A submission that cannot succeed no longer takes the visitor away from their message. The form then behaves consistently with the offline messaging and offline support the rest of the site already provides.
- **Implementation scope:**
  - Change only the `submit` listener in `js/features/form.js`.
  - Leave online submission unchanged: the native POST, the Netlify attributes, the honeypot, the redirect to `thank-you.html` and the existing validation messages.
  - Add no queuing, background sync or Service Worker change.
  - The guard covers only the offline state the browser reports. A connection that fails while `navigator.onLine` still reads true is out of its reach.
- **Acceptance criteria:**
  - With the browser in offline mode, a valid submission does not navigate, all three fields keep their values, and `#form-status` announces that a connection is needed.
  - Back online, the same submission goes through as a native POST.
  - An invalid submission still shows the existing field errors and focuses the first invalid field.
- **Impact:** Medium
- **Effort:** Small
- **Status:** COMPLETED — A valid submission made while `navigator.onLine` reports offline now stays on the page with all values kept and announces "Jesteś offline. Połącz się z internetem, aby wysłać wiadomość." in `#form-status`; the Service Worker cache was raised to v1.8 with a recalculated precache fingerprint.

## Selection summary

The five proposals cover four distinct quality areas:

- the Service Worker update contract (01);
- parity between the menu data and the static fallback that search and filtering depend on (02);
- accessibility verification of an interactive state (03);
- runtime recovery within the offline support the project already provides (04, 05).

Each builds on a mechanism the project already has: the production integrity validator, `validateMenuParity()`, the pa11y-ci configuration, the existing image-fallback approach and the existing status live region. None adds a dependency or a test framework, or changes the caching strategy.

There are no hard dependencies between them. 01 and 02 both edit `scripts/validate-dist.js`, so they are simplest to implement one after the other. 04 and 05 change precached JavaScript, so releasing them needs the `CACHE_VERSION` bump that 01 would then enforce. 02, 03, 04 and 05 can each be implemented and verified on its own. With four Small proposals and one Medium, the set is a reasonable candidate backlog for about one focused working day, though that duration is not guaranteed.

## Analysis limitations

- `node_modules/` is absent from this checkout and nothing was installed, so ESLint, html-validate, linkinator and pa11y-ci were not run. Support for pa11y actions (03) is inferred from the versions locked in `package-lock.json`, not from an executed scenario.
- Checks actually performed:
  - `node scripts/validate-dist.js --source` (`npm run qa:source`), which passed.
  - A read-only scan, run from a script outside the repository, comparing the static menu cards' descriptions and tags with `data/menu.json` and the filter values with the data's tag vocabulary. It found no differences.
  - Git history inspection of `sw.js` and of later changes to precached sources.
- No browser behavior was verified at runtime. The Service Worker update behavior (01), the lightbox failure state (04) and the outcome of an offline submission (05) are derived from the source and from standard browser behavior. `js/bootstrap.js` skips worker registration on local hosts, so the configured checks cannot exercise them either.
- The deployed site was not inspected. Whether a 1.6 package is already live, which determines how soon the risk in 01 applies, is unknown.
