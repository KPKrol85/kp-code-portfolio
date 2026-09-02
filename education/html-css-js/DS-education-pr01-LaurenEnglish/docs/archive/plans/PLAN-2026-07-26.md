# Lauren English — Development Plan

**Last reviewed:** 2026-07-26
**Project type:** Static multi-page educational frontend and PWA with Node.js assembly tooling
**Plan status:** Active

## Planning principles

- The plan reflects the current verified project state.
- Main items are checked only when all required subtasks and focused verification are complete.
- Canonical source and configuration files are changed before generated output is refreshed through project scripts.
- Significant completed changes remain recorded separately in `CHANGELOG.md`.

## Current priorities

1. `PH1-01` — Remove retired interaction branches from the canonical runtime and PWA graph.
2. `PH2-01` — Align the runtime checklist with the final executable registries.
3. `PH2-02` — Correct the bilingual image-maintenance contract.

## Planning basis

- No earlier `PLAN.md` existed, so completed release work is not reconstructed as invented checked phases.
- The current static audit reports no P0 or P1 findings; this plan includes only its three verified P2 follow-ups.
- External deployment behavior, browser installability, formal accessibility conformance, and performance benchmarks were not verified by the static audit and are not treated as defects or planned work.

## Phase 1 — Runtime contract cleanup

**Goal:** Remove obsolete interaction ownership from canonical JavaScript and synchronize the generated PWA contract without changing active form or progress behavior.

- [x] **PH1-01 — Remove retired interaction branches**
  - [x] remove the `contactForm.js` import and initializer from `js/main.js` while preserving the native required-field and Netlify Forms contract in `kontakt.html`
  - [x] delete the unused `js/modules/contactForm.js` and unreferenced `js/modules/progressTracker.js` modules without changing the active `js/pages/progress-page.js` flow
  - [x] remove `/js/modules/contactForm.js` from `RUNTIME_JAVASCRIPT_PATHS` in `scripts/pwa-config.mjs`
  - [x] regenerate `service-worker.js` through `npm run build:sw` and confirm that its precache graph contains neither retired module
  - [x] run `npm run lint:js`, `npm run check:content`, and `npm run check:pwa`
  - [x] run the focused `npm run test:e2e:interactions` browser suite
  - **Source:** `daily-AUDIT.md` — P2-03
  - **Completion condition:** canonical imports, initializers, modules, and PWA paths contain no retired interaction branch, while the contact form, active progress journal, and generated Service Worker contracts pass focused verification

## Phase 2 — Maintenance documentation alignment

**Goal:** Make operational documentation match the executable route, runtime-asset, and image-generation sources of truth.

- [x] **PH2-01 — Align the runtime checklist with executable registries**
  - [x] derive the final CSS and JavaScript graph statements from `RUNTIME_CSS_PATHS` and `RUNTIME_JAVASCRIPT_PATHS` after `PH1-01`
  - [x] replace conflicting 27/29 CSS and 20 JavaScript claims with one consistent current contract, avoiding repeated fixed counts where the configuration can be referenced directly
  - [x] update page coverage to distinguish the six indexable routes from all twelve HTML documents, including the contact, legal, and utility pages
  - [x] align the responsive, SEO, PWA, and post-deployment checklist sections with the same route registry
  - [x] verify every retained count and route list against `scripts/pwa-config.mjs` and `scripts/site-config.mjs`
  - **Depends on:** `PH1-01`
  - **Source:** `daily-AUDIT.md` — P2-01
  - **Completion condition:** `docs/runtime-checklist.md` contains one internally consistent runtime and route contract derived from the current executable registries

- [x] **PH2-02 — Correct the bilingual image-maintenance contract**
  - [x] update the Polish README image section to identify `assets/image-sources/` as the canonical editable input
  - [x] update the equivalent English section with the same technical facts
  - [x] document `assets/img/` as generated public JPEG, AVIF, and WebP output for assets configured in `scripts/image-config.mjs`
  - [x] clarify that `npm run images` regenerates the configured formats from canonical originals and remains separate from the normal production build
  - [x] verify factual parity between both language sections and the behavior of `scripts/optimize-images.mjs`
  - **Source:** `daily-AUDIT.md` — P2-02
  - **Completion condition:** both README language sections identify the same canonical inputs, generated outputs, and image-regeneration boundary
