# Axiom — Development Plan

**Last reviewed:** 2026-09-01
**Project type:** Static multi-page front-end website (vanilla HTML/CSS/JS) with a Node build pipeline and static-hosting configuration
**Plan status:** All planned phases are complete; only the optional items remain open.

## Planning principles

- The plan reflects the current verified repository state; every item is backed by source, configuration, or a current audit finding.
- Main items are checked only when all required subtasks and the stated completion condition are satisfied.
- Canonical sources are `css/`, `js/`, the HTML pages, `sw.template.js`, and `tools/templates/`; `dist/`, `assets/img/_optimized/`, and `sw.js` are generated and are never edited directly.
- Completed significant changes are recorded separately in `CHANGELOG.md`.

## Current priorities

- No item is currently prioritized; Phases 1 through 6 are complete. Only the optional items `O-01` and `O-02` remain open.

## Phase 1 — Delivery and repository contracts

**Goal:** Make the repository and the delivered artifacts describe what the build actually produces.

- [x] **PH1-01 — Add ignore rules for dependency and build directories**
  - [x] ensure the root `.gitignore` covers the dependency directory, `dist/`, and `reports/`
  - [x] confirm no already-tracked file is unintentionally excluded by the new rules
  - **Priority:** High
  - **Completion condition:** `npm install`, `npm run build`, and `npm run qa` leave no untracked-but-committable artifacts in the working tree
  - **Source:** `daily-AUDIT.md` — P1-03

- [x] **PH1-02 — Align the cache policy with the built output paths**
  - [x] map every asset path present in `dist/` after `npm run build` to the rule that matches it in `_headers`
  - [x] give the production bundles (`style.min.css`, `script.min.js`) a caching rule instead of inheriting `no-cache` from `/*`
  - [x] remove or narrow the one-year `immutable` rules that currently cover unversioned copied sources, including `js/theme-init.js`
  - [x] verify the resulting rule set against the built output, not against the working tree
  - **Priority:** High
  - **Completion condition:** every asset the production pages request is matched by an intentional cache rule, and no unversioned file is served as `immutable`
  - **Source:** `daily-AUDIT.md` — P1-01

- [x] **PH1-03 — Give the root service worker a declared owner**
  - [x] decide whether the repository keeps a root `sw.js` or serves only the generated `dist/sw.js`
  - [x] if it is kept, generate it from `sw.template.js` as part of the build so its revision and precache list follow the sources
  - [x] if it is dropped, confirm local development still registers a service worker or accept the change explicitly
  - [x] keep `sw.template.js` as the only hand-edited service worker source
  - **Priority:** Medium
  - **Completion condition:** no service worker file in the repository can drift from `sw.template.js` without the build producing it
  - **Source:** `daily-AUDIT.md` — P2-01

## Phase 2 — Asset payload and reference integrity

**Goal:** Ship only the files the pages use, and detect broken references automatically.

- [x] **PH2-01 — Add an automated reference-integrity check**
  - [x] add a validation script (new file, e.g. `tools/qa/check-references.mjs`) that resolves local references from the HTML pages, `css/**/*.css`, `manifest.webmanifest`, and the service worker precache list
  - [x] report unresolved references with their source file
  - [x] expose it as an npm script alongside the existing `qa:*` entries
  - **Priority:** Medium
  - **Completion condition:** the check runs without a server, exits non-zero on a broken reference, and passes on the current repository
  - **Source:** `README.md` roadmap; `daily-AUDIT.md` — optional improvement

- [x] **PH2-02 — Reduce the shipped image set to referenced files**
  - [x] determine which widths and formats the `srcset` declarations actually consume
  - [x] narrow `tools/images/build-images.mjs` so it stops generating variants no page requests
  - [x] remove unreferenced originals, including the `-dup` files and the unused `instalacja-elektryczna-01-*` set
  - [x] confirm `tools/release/build-dist.mjs` copies only what the pages need
  - **Priority:** High
  - **Depends on:** `PH2-01`
  - **Completion condition:** the reference check passes and every file under `assets/img/` reaching `dist/` is requested by a page, the manifest, or the precache list
  - **Source:** `daily-AUDIT.md` — P1-02

## Phase 3 — Public content and metadata

**Goal:** Remove contradictions between what the pages declare publicly and what the project implements.

- [x] **PH3-01 — Correct the indexing policy on utility pages**
  - [x] set `noindex` on `offline.html` and `404.html`, matching the treatment already used on `success.html`
  - [x] update the corresponding entries in `tools/templates/pages.meta.json` so `npm run build:head` reproduces the change
  - **Priority:** Medium
  - **Completion condition:** regenerating the `<head>` sections keeps the utility pages out of the indexable set, and `sitemap.xml` remains limited to the 12 public URLs
  - **Source:** `daily-AUDIT.md` — P2-04

- [x] **PH3-02 — Establish a single source for structured data**
  - [x] decide whether the inline JSON-LD blocks or the files in `js/structured-data/` are canonical
  - [x] if the files become canonical, generate the inline blocks from them during the build; if the inline blocks stay canonical, remove the unused directory
  - [x] confirm business data (address, contact, opening hours, services) exists in one place only
  - **Priority:** Medium
  - **Completion condition:** structured data can be changed in one location and no unused parallel copy remains
  - **Source:** `daily-AUDIT.md` — P2-03; `README.md` roadmap

- [x] **PH3-03 — Align consent behavior with the cookie policy**
  - [x] decide between adding a decline and withdrawal path or narrowing the wording in `legal/polityka-cookies.html` to the mechanism the project provides
  - [x] if a withdrawal path is added, expose a control that clears `cookie-consent-v1` and the `cookie_consent` cookie and re-opens the dialog
  - [x] keep the existing focus trap, focus return, and scroll-lock behavior intact for whichever path is chosen
  - **Priority:** Medium
  - **Completion condition:** the consent controls the site offers and the consent mechanism the policy describes state the same thing
  - **Source:** `daily-AUDIT.md` — P2-02

## Phase 4 — QA workflow and focused tests

**Goal:** Make the existing audits runnable in one step and protect the two most complex interactive modules.

- [x] **PH4-01 — Make the QA audits runnable without a manual server step**
  - [x] start and stop the local server from within `tools/qa/run-lighthouse.mjs` and `tools/qa/run-pa11y.mjs`, or from a shared helper
  - [x] fail with a clear message when the port is already in use
  - [x] keep the current audited URLs and report paths unchanged
  - **Priority:** Medium
  - **Completion condition:** `npm run qa` completes from a clean shell without a separately started `npm run serve`
  - **Source:** `README.md` roadmap

- [x] **PH4-02 — Add focused tests for the contact form and the lightbox**
  - [x] select and configure a test runner (a new dev dependency and configuration are required)
  - [x] cover contact-form behavior: required-field validation, the 500-character limit, error-summary population, and draft persistence in `contactFormMessage` including its removal after submission
  - [x] cover lightbox behavior: focus trap, focus return to the triggering element, and keyboard navigation between items
  - **Priority:** Low
  - **Completion condition:** the listed behaviors are covered by tests that run from one npm script
  - **Source:** `README.md` roadmap

## Phase 5 — Repository cleanup

**Goal:** Remove files that advertise behavior the project does not have.

- [x] **PH5-01 — Resolve inert configuration and dead code**
  - [x] implement the redirect rules described in the `_redirects` comments or remove the file and the comments
  - [x] remove `postcss.config.json` or install and wire the plugins it declares into `tools/css/build-css.mjs`
  - [x] remove the unused `js/sections/faq.js` stub, which nothing imports
  - **Priority:** Low
  - **Completion condition:** no configuration file or module in the repository describes behavior that is not implemented
  - **Source:** `daily-AUDIT.md` — P2-05

## Phase 6 — Documentation contract sync

**Goal:** Keep the canonical documentation accurate once the phases above land.

- [x] **PH6-01 — Update documentation for the delivered changes**
  - [x] update the `README.md` sections describing deployment headers, `_redirects`, the image pipeline, structured-data ownership, and the service worker once those contracts change
  - [x] add `CHANGELOG.md` entries for the changes that meet the changelog significance standard
  - [x] remove the roadmap entries in `README.md` that the completed work resolves
  - **Priority:** Medium
  - **Depends on:** `PH1-02`, `PH2-02`, `PH3-02`
  - **Completion condition:** no section of `README.md` or `CHANGELOG.md` contradicts the implementation after the phases above are complete

## Optional future improvements

- [ ] **O-01 — Content-hashed filenames for production bundles**
  - **Value:** removes the trade-off behind `PH1-02` by making long-lived immutable caching safe for `style.min.css` and `script.min.js`
  - **Scope boundary:** optional and broader than `PH1-02`, which is solvable with header rules alone

- [ ] **O-02 — Record third-party font licensing in the repository**
  - **Value:** completes the attribution contract already started in `LICENSE` section 8 and the `README.md` attributions section for the self-hosted Lato, Montserrat, and Poppins files
  - **Scope boundary:** optional; no project file currently claims a license for those fonts
