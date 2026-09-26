# Atelier No.02 — Workflow Improvements

**Analysis date:** 2026-09-26
**Project type:** Static multi-page restaurant demonstration website: HTML templates and shared partials, modular CSS, vanilla JavaScript, Node.js/npm build and QA tooling, and a static package prepared for manual Netlify deployment.
**Analysis mode:** Evidence-based workflow improvement review
**Focus:** Project-wide workflow
**Completion note (2026-09-26):** All three workflow improvements (IMP-WORKFLOW-01 to IMP-WORKFLOW-03) have been implemented and recorded in `docs/CHANGELOG.md`. This report was archived on 2026-09-26. The original proposals, selection rationale, and analysis limitations are preserved as historical records.

## Improvement overview

The repository already separates source development, production builds and production validation. `scripts/build-config.js` owns page composition and packaging inputs; `dist/` is generated and ignored, while optimized images are generated separately and tracked. The existing QA runner manages its own server, and production integrity validation checks the Service Worker precache fingerprint. GitHub Actions is configured to run source QA, build and production QA; the documented deployment remains manual.

Inspection covered setup and package scripts, their implementations, image generation, validation configuration, CI, hosting files, Git ownership rules, current documentation and archived plans, audits and improvement reports. No existing active workflow report or active plan was found. The archived plans and UI, UX and QUALITY reports record completed work; those objectives are excluded here, including precache fingerprint validation, menu parity and additional form accessibility coverage.

Three opportunities qualify: reuse managed server startup for a selected existing check, shorten the path from an HTML diagnostic to its editable source, and reduce repeated maintenance of command documentation. These are optional process improvements, not claims that the current commands fail. Proposals remain subject to separate approval. Impact and effort are relative assessments, not measured savings or delivery estimates.

## Proposed improvements

### IMP-WORKFLOW-01 — Run a selected check through the existing QA server runner

- **Affected workflow:** Focused local link or accessibility verification against source or an existing production package.
- **Evidence:** `scripts/qa-server.js:7-9`, `scripts/qa-server.js:27-42`; `scripts/qa-links.js:5-15`; `package.json` scripts `qa:links`, `qa:a11y`, `qa:server` and `qa:dist:server`; `docs/settings.md:71-89`, `docs/settings.md:101-104`; `AGENTS.md:32-35`.
- **Current workflow:** Standalone link and accessibility commands already exist but require a separately running server. The managed runner selects source or `dist/`, then always runs local links followed by pa11y. A maintainer who needs just one of these checks either manages the server manually or invokes both checks. The runner already owns port binding, child exit handling and server cleanup.
- **Proposed improvement:** Add a small, explicit check selector to that runner so it can manage the server for links alone or accessibility alone. Keep both checks as the default and retain the current source/production selection. Document focused use beside the existing runner entries.
- **Expected practical value:** A link-only check can use the existing server lifecycle without also launching the accessibility audit; an accessibility-only rerun can avoid repeating the link crawl. This reduces orchestration steps for narrow tasks without changing what either check validates.
- **Implementation scope:** `scripts/qa-server.js` and its usage notes in `docs/settings.md`. Pass the selector through existing npm runner commands rather than adding an alias for every combination. Preserve standalone commands, port 5173, occupied-port rejection, failure propagation, cleanup and the default full CI path. Do not alter test coverage, external-link policy, dependencies, production generation or deployment.
- **Acceptance criteria:** Each selected mode launches only its requested existing check against the selected source or production server; omitting the selector still runs links then pa11y. Invalid selections fail clearly before server startup. Selected-check failure returns a nonzero exit status and releases the runner's port. Focused usage examples identify whether a prior build is needed and do not imply that a single check replaces full source or production QA.
- **Impact:** Medium
- **Effort:** Small
- **Status:** COMPLETED — Added focused links-only and accessibility-only modes to the existing QA server runner while preserving the default checks, source/dist selection, failure handling, and server cleanup.

### IMP-WORKFLOW-02 — Show editable source locations in composed HTML diagnostics

- **Affected workflow:** Locating and correcting errors reported by source HTML validation.
- **Evidence:** `scripts/qa-html.js:9-19`; `scripts/build-config.js:24-27`, `scripts/build-config.js:103-147`; `docs/settings.md:66-69`.
- **Current workflow:** `qa:html` validates the complete composed page and formats diagnostics under the root page's path. It explicitly states that line numbers refer to the composed document. Header and footer insertion changes line positions, so a maintainer must translate a diagnostic back to a root template or a canonical partial before editing. Composition-marker errors already identify their source separately.
- **Proposed improvement:** Retain lightweight line-origin information during the existing composition operation and use it in source HTML diagnostics to name the canonical template or partial and its original line, alongside the affected composed page.
- **Expected practical value:** Maintainers can navigate directly to the editable file, including shared markup repeated across pages, while continuing to validate the complete document that the development server serves.
- **Implementation scope:** The composition helper in `scripts/build-config.js`, diagnostic presentation in `scripts/qa-html.js`, and the existing line-number note in `docs/settings.md`. Preserve the string-returning composition API used by development, builds and integrity checks; make origin information an additional diagnostic capability. Limit mapping to the existing two-partial mechanism. Do not introduce a template engine, change HTML output, relax validation rules, deduplicate away affected-page information or edit generated HTML.
- **Acceptance criteria:** Focused diagnostic cases before and after a partial marker and inside each partial identify the correct canonical file and original line, with the affected page retained. LF and CRLF inputs map consistently, including insertion indentation. Composition output remains byte-for-byte equivalent for the same inputs, existing marker errors remain actionable, and validation rules and exit status remain unchanged. Verification can use in-memory inputs without retaining altered page fixtures.
- **Impact:** Medium
- **Effort:** Medium
- **Status:** COMPLETED — Added canonical source-file and line mapping to composed HTML diagnostics while preserving affected-page context, existing validation behavior, and byte-for-byte identical HTML output.

### IMP-WORKFLOW-03 — Give detailed command documentation one maintenance home

- **Affected workflow:** Updating documentation after changes to build and QA commands.
- **Evidence:** `package.json` scripts; `docs/settings.md:9-104`; `README.md:141-153`, `README.md:362-374`; `docs/CONTEXT-PROJECT.md:120-137`; `docs/CHANGELOG.md`, Documentation section, records the 2026-09-26 reconciliation of QA and dependency descriptions.
- **Current workflow:** `docs/settings.md` repeats executable command bodies and explains every script. README maintains QA descriptions in Polish and English; the project context repeats orchestration and detailed scenario information. For example, the pa11y scenario count and form-error scenario are described in all three documents. The descriptions currently agree on that detail, but changing it requires synchronized edits in several places.
- **Proposed improvement:** Establish `docs/settings.md` as the detailed operational command reference, with executable definitions still owned by `package.json` and the referenced scripts/configuration. Keep README's bilingual entry-point guidance and the context's stable architectural contracts, linking to the detailed reference instead of independently repeating low-level command chains and scenario inventories. Record this narrow ownership rule in the existing reference.
- **Expected practical value:** Future command changes have an identifiable documentation destination and fewer independently maintained details. Readers retain quick-start guidance, prerequisites and evidence limits without requiring another document or a documentation generator.
- **Implementation scope:** Only the overlapping command-reference passages in `docs/settings.md`, `README.md` and `docs/CONTEXT-PROJECT.md`. Replace copied command bodies in the reference with public npm invocations and a link to their executable definitions where useful. Preserve README Polish/English parity, source/generated ownership, build prerequisites, port/server instructions, manual deployment and the distinction between configured checks and verified outcomes. Leave historical reports and unrelated documentation unchanged.
- **Acceptance criteria:** The operational reference states its ownership and points to executable definitions. README and context link to it from the relevant workflow sections; repeated low-level details selected for consolidation have one maintained prose location. Public commands and their prerequisites remain discoverable, all new relative links resolve, and the two README language sections retain equivalent instructions and limitations. No package command or validation behavior changes.
- **Impact:** Medium
- **Effort:** Small
- **Status:** COMPLETED — Consolidated detailed build and QA command documentation in `docs/settings.md`, preserving bilingual README guidance and architectural context while reducing duplicated operational descriptions.

## Selection summary

The proposals improve three separate maintenance actions: choosing an existing check, locating the source behind its diagnostics, and updating the documentation that explains the tools. They reuse current tooling and have bounded Small or Medium scopes suitable for focused development sessions. They can be considered as a compact development-day candidate backlog, without a completion-time commitment.

All three can be implemented independently. They touch some of the same usage notes, so if multiple proposals are selected, reconcile those notes once after the script changes; no technical dependency requires a particular order. The diagnostic work has the largest implementation uncertainty and should remain limited to the existing composer.

Only three proposals were retained. Source/output separation, generated-image ownership, CI responsibilities, manual deployment and precache maintenance already have explicit mechanisms or documentation. Recommending replacements, additional infrastructure or another cache safeguard would add complexity or recycle completed work without sufficient distinct value. No application UI, UX, architecture change or new application test coverage is proposed.

## Analysis limitations

This review used current file contents and read-only Git inspection. No build, image generation, npm validation, browser suite, dependency installation, deployment or live CI inspection was performed. Runtime success, cleanup behavior under every failure condition and productivity gains were not measured; claims about orchestration describe the inspected implementation. Source-location mapping feasibility was assessed from the small composer and has not been prototyped against validator diagnostics.

Historical completion and verification statements were used to exclude prior work, not as evidence that today's checkout passes those checks. Netlify publication, form delivery and live PWA behavior remain outside this analysis. Only this report was created; none of the proposed improvements was implemented.
