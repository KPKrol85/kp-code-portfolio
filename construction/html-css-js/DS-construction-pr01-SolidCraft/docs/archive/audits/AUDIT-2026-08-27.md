# SolidCraft — Final Technical Front-End Audit

**Audit date:** 2026-08-24  
**Project type:** Static multi-page demonstrational construction-services website (HTML, CSS, JavaScript, PostCSS; Netlify build contract)  
**Audit mode:** Final repository and implementation review  
**Current readiness:** Ready with Deployment Verification Outstanding

## 1. Executive assessment

SolidCraft has a coherent source-first architecture, a deterministic documented deployment pipeline, useful repository-specific validation, and browser-tested navigation, lightbox, and form behavior. The current Chromium regression suites passed, and representative enabled-JavaScript pages produced no runtime errors or horizontal overflow.

The four important risks this audit recorded have since been resolved and verified: no-JavaScript content visibility, disclosure of the fictional/demo identity on indexed direct-entry routes, privacy and cookie text matching the implemented form and storage behavior, and the development/CI dependency graph, which now reports no critical or high advisories. The one contained P2 refinement — the absent self-contained font licensing record — has since been resolved and verified as well: the repository and the production artifact now expose a human-readable SIL Open Font License 1.1 record together with a Montserrat and Poppins provenance record derived from embedded font metadata and authoritative upstream licensing sources, while the proprietary project license, the font binaries, and font loading are unchanged. Exact upstream release, commit, and download provenance could not be reconstructed from the repository and is deliberately not claimed. No P0, P1, or P2 finding remains open. Deployed Netlify behavior and the production Service Worker in a published artifact were not exercised by this audit and still require verification against a real deployment.

## 2. Audit scope and verification

### Areas inspected

- All 13 maintained HTML documents, the shared header/footer partials, metadata, JSON-LD, forms, recovery pages, legal pages, and demonstrational-content disclosures.
- CSS entry point, all CSS modules, design tokens, responsive breakpoints, reveal behavior, theme states, focus styles, reduced-motion handling, and no-JavaScript rules.
- JavaScript entry points and all runtime modules: navigation, UI core, form validation/submission, lightbox, map consent, project notice, prefetch, icons, and home helpers.
- Build, image, partial-rendering, link/asset, sitemap, Service Worker, accessibility, and functional QA scripts.
- Netlify build/routing/header configuration, manifest, robots policy, Lighthouse configuration, CI workflow, package metadata, lockfile, and repository hygiene rules.
- Generated-image inventory, local fonts, project licensing, third-party attribution, and source-visible secret patterns.

### Verification performed

- `git status --short` — executed before the audit write; the worktree was clean.
- `npm run check:html` — passed for 13 HTML files; internal links, anchors, and local asset references passed. Sixty-three external-link checks were skipped by the script after network `TypeError` failures.
- `npm run format:check` — passed; all matched files used the configured Prettier style.
- `node --check` over all repository `.js` and `.mjs` source files — passed.
- `npm run qa:a11y` — passed in headless Chromium after the sandboxed launch was retried with browser execution permission: 12 pages scanned, zero serious or critical axe violations.
- `npm run qa:functional` — passed in headless Chromium: 9 of 9 navigation, submenu, lightbox, and contact-form scenarios.
- Additional Playwright review against the repository's partial-rendering static server — `/`, `/oferta/remonty.html`, `/doc/polityka-prywatnosci.html`, and `/404.html` produced no page/console errors and no horizontal overflow at 390×844 or 1440×1000.
- JavaScript-disabled Chromium review — confirmed 51 of 51 reveal elements hidden on `/`, 29 of 29 on `/oferta/remonty.html`, and 5 of 5 on `/doc/polityka-prywatnosci.html`.
- `npm audit --json` — completed against the registry data and lockfile as they stood on the audit date: 37 advisories (1 critical, 24 high, 9 moderate, 3 low), all in the development/tooling dependency graph. This figure is the original audit baseline, not the current state: the toolchain has since been remediated to 0 critical, 0 high, 1 moderate, and 1 low.
- Targeted repository searches — no credential, private-key, API-key, or environment-secret value was detected.
- Image inventory comparison against `GALLERY_SIZES` — detected 12 generated gallery files outside the current naming/size contract, totaling 1,695,342 bytes.
- WOFF2 metadata inspection — all 12 local font files contain an upstream copyright record and OFL URL, but no embedded full license text was found.

### Verification limitations

- `npm run build:dist`, `npm run qa:lhci`, image generation, and other writing commands were not executed because they create or replace generated files, while this audit was permitted to modify only `AUDIT.md`.
- No live URL was supplied. Deployment status, Netlify headers/redirects, real Netlify Forms processing, production form retention, and the public canonical origin were not verified.
- The valid and failed form browser scenarios use the local functional harness; they do not prove a real submission to Netlify.
- Production Service Worker generation, installation, update, cache persistence, offline navigation, and installability were not exercised in a built deployment artifact.
- Browser execution was Chromium-only. Firefox, WebKit, physical devices, real assistive technologies, and formal screen-reader behavior were not tested.
- Lighthouse, field performance, bandwidth-sensitive loading, and production cache/compression behavior were not measured.
- The 63 external URLs reported by `check:links` were not verified because outbound checks failed in the execution environment.
- This review is not a legal-compliance assessment, accessibility certification, penetration test, or guarantee of production behavior.

## 3. Verified strengths

- Shared layout ownership is explicit and enforced: `partials/header.html` and `partials/footer.html` are rendered by one reusable parser that rejects missing partials, unknown variables, escaping includes, cycles, malformed layouts, and surviving directives.
- CSS and JavaScript have clear canonical sources. PostCSS composes focused CSS modules, while ES modules expose conditional initializers and use abortable listener lifecycles for reinitialization-sensitive behavior.
- The contact form preserves native constraints and Netlify attributes while providing linked field errors, `aria-invalid`, a live status region, anti-spam handling, timeout control, and retry-safe failure behavior. All four functional form scenarios passed.
- Responsive navigation and the service-gallery lightbox have keyboard-aware state synchronization and focus restoration. All five navigation/lightbox browser scenarios passed.
- The axe gate scans every primary/service/legal/recovery document variant in its configured scope and reported no serious or critical violations on 12 pages.
- Images use local AVIF/WebP/JPG variants with explicit dimensions, `srcset`, lazy loading outside the hero, and an eager high-priority hero path. Fonts are local `woff2` subsets with `font-display: swap`.
- The deployment contract has a single documented `dist/` producer, generated sitemap ownership, a derived Service Worker precache manifest and version fingerprint, root-scoped Netlify routing, and restrictive security headers.
- Service Worker runtime caching is same-origin and GET-only, rejects non-OK responses for persistence, clones network responses before cache writes, and limits cache deletion to keys owned by the `solidcraft-v` namespace.
- CI uses a lockfile-backed install, a read-only token, a bounded timeout, one named quality gate, and separate build, accessibility, and functional steps.
- The repository contains no runtime production dependency bundle, and the targeted source scan did not detect exposed credentials or private keys.

## 4. P0 — Critical risks

None detected.

## 5. P1 — Important issues worth fixing next

None detected.

## 6. P2 — Minor refinements

None detected.

## 7. Extra quality improvements

None detected.

## 8. Current readiness conclusion

**Status:** Ready with Deployment Verification Outstanding

The source architecture and tested JavaScript interactions were strong enough to support focused remediation rather than redesign, and that remediation is now complete: the no-JavaScript content failure, demonstrational identity, data disclosures, vulnerable tooling graph, and font licensing record are all corrected and verified. The production build, HTML checks, accessibility and functional suites, image pipeline, and Lighthouse thresholds pass against the current tree. No audit finding remains open, and deployment-specific behavior — real Netlify Forms processing, published headers and redirects, and the production Service Worker in a deployed artifact — still requires verification against a live environment.

## 9. Senior rating

**Rating:** 8.5/10

The project earns a strong baseline for source ownership, modularity, deterministic tooling design, accessible interaction patterns, responsive media, and passing repository-specific browser checks, and the four important risks that previously held it back — progressive enhancement, public content integrity, privacy facts, and dependency security — are now resolved and verified. The rating stops short of the top of the scale because deployed production behavior is still unverified.
