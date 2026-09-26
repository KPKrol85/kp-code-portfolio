# Changelog

All significant changes to this project are documented in this file.

`CHANGELOG.md` is the canonical record of significant completed changes. Evaluate each completed implementation task for a required update; record significant changes when task scope permits, and report any required update when it does not.

## [Unreleased]

### Added

- Added a static multi-page restaurant demonstration site with shared and page-specific JavaScript module initialization.
- Added featured and category menu rendering from `data/menu.json`, text search and tag filters, preserving static cards when data is unavailable.
- Added grouped gallery lightboxes with captions, image counters, keyboard and touch navigation, fullscreen controls and Tab trapping.
- Added mobile navigation with drawer focus management, Tab trapping, Escape and outside-click dismissal, and hidden-state `inert` handling.
- Added light and dark themes with system preference support, `localStorage` persistence and synchronized theme-color metadata.
- Added scroll reveals that expose content immediately when reduced motion is requested or `IntersectionObserver` is unavailable.
- Added a contact form configured for native Netlify Forms POST submission, honeypot filtering, field validation and submission progress feedback.
- Added a dismissible demonstration notice with keyboard focus handling and a locally persisted acknowledgement.
- Added a standalone PWA manifest and Service Worker caching with network-first navigation, cache-first assets, an offline fallback and connection-status notices.
- Added source validation for optimized image assets to detect outputs without corresponding original images.
- Added a one-step reset for empty menu filter results, restoring all dishes and default filter states.

### Changed

- Added a direct home-page link to the contact confirmation page while retaining the return-to-form option.
- Added direct recovery links to the home, menu and gallery pages within the 404 message.
- Added gallery category names to the lightbox counter and navigation announcements.

- Standardized the site terms and unified legal-page styling, operator information and contact details.
- Standardized the privacy policy and clarified Netlify Forms processing and embedded Google Maps disclosures, correcting the cookies policy's third-party integration description.
- Standardized the cookies policy and documented existing `localStorage`, Service Worker and Cache Storage use.
- Adopted the bilingual KP_CODE proprietary license and aligned root npm license metadata and README licensing notices, preserving third-party licenses.
- Synchronized navigation dropdown visibility and `aria-expanded` state across mobile and desktop, with explicit desktop disclosure controls and a preserved no-JavaScript hover/focus fallback.
- Aligned the reduced JavaScript entry with shipped page markup by initializing the shared demo disclosure and reveal features on legal and system pages.
- Corrected connectivity-state initialization so network status notifications are shown only for genuine online and offline transitions.
- Improved menu filtering accessibility with synchronized pressed states and live announcements for result counts and empty searches.
- Aligned sticky category navigation styling with the active scrollspy state on menu and gallery pages, using valid theme-aware shadow tokens.
- Corrected lightbox focus restoration so closing returns keyboard focus to the originating gallery link after the background becomes interactive.
- Corrected the sitemap protocol namespace and removed the unused XHTML namespace declaration while preserving the existing public URL inventory.
- Restored the shared theme bootstrap and colour metadata contract on system pages, including early dark-theme initialization for the offline fallback.
- Standardized the demonstration disclosure across all pages, correcting the project wording and removing the divergent contact-page variant.
- Aligned the contact form's accessible name with its visible `Formularz kontaktowy` heading.
- Replaced the undefined menu-card focus colour fallback with the shared theme-aware focus token, restoring a visible indicator in both light and dark themes.
- Activated the reveal direction and stagger authoring contract, with immediate no-motion rendering for reduced-motion users and fallback environments.
- Simplified scrollspy ownership so IntersectionObserver exclusively tracks active sections when available, with the scroll-offset algorithm retained as a fallback and responsive observer geometry rebuilt on resize.
- Reduced redundant contact-form live-region updates so progress status is rewritten only when the validation summary actually changes.
- Removed the ineffective lightbox backdrop listener and consolidated control initialization while preserving navigation, accessibility metadata and focus restoration.
- Corrected the `cytrusowe-ciasto` source filename and added its missing 720×480 menu image variant, restoring reproducible optimized-image builds.
- Corrected gallery metadata and breadcrumb structured data, removing FAQ markup unrelated to the gallery page.
- Replaced the placeholder menu download with a complete demonstration PDF containing all 18 menu items, and aligned the download control with the delivered format.
- Improved keyboard focus visibility on contact form fields using the theme-aware focus-ring token, with verified contrast in both themes.
- Restored the contact dialog's inert closed state, preventing its controls from entering the keyboard tab order before acceptance and on returning visits.
- Aligned contact and reservation messaging across the home, contact and menu pages, SEO metadata and web manifest with the site's non-binding contact form.
- Replaced the About FAQ and matching structured data with project-focused content, and removed misleading reservation messaging from the location and contact sections.
- Standardized the author address and map destinations across all pages, with subtle KP_Code Digital Studio address captions.
- Aligned accessible names with visible labels across site-wide address links and key navigation CTAs.
- Updated sitemap modification dates to reflect verified substantive revisions across all eight indexed pages.
- Rendered the existing offline banner and page-specific hero notices on initial offline loads while preserving connectivity transition behaviour.
- Separated menu copy-link controls from all 24 headings, preserving clean accessible names, keyboard operation and responsive reveal behaviour.
- Aligned the 404 page with the shared body class contract without changing its rendering or runtime behaviour.
- Enforced shared body and closed demo-modal wrapper contracts in source QA with actionable validation errors.
- Corrected the small box-shadow token name and its legal-page consumer without changing the rendered shadow.
- Raised the Service Worker cache version to v1.4 and synchronized bilingual README references, verifying all 19 precache entries in source and production.
- Corrected the LinkedIn profile URL across all 11 page footers and verified the updated link in source and production HTML.
- Aligned production URLs, SEO metadata, sitemap, robots and form host detection with the confirmed Atelier Netlify domain.
- Integrated the seven retained Font Awesome Free 7.1.0 icons through a shared `js/features/icons.js` registry initialized by both JavaScript entries, replacing duplicated inline contact and social SVG markup on all 11 pages and adding the home icon to breadcrumb home links, with visible social link labels when JavaScript is unavailable and the Service Worker cache raised to v1.5.
- Increased the homepage hero heading to the existing `--fs-3xl` typography token, distinguishing it from section headings.
- Aligned menu filter chips and dish tag badges with consistent typography and burgundy styling across light and dark themes, preserving distinct interactive and informational states.
- Increased all four gallery lightbox controls to a minimum of 44×44px across viewport sizes, improving touch accessibility while preserving existing icons and interactions.
- Refined letter spacing across seven About page text roles to improve readability and maintain consistent body typography.
- Increased homepage and inner-page hero vertical spacing with the existing `--section-y-lg` token, preserving standard section and footer spacing.
- Added thumbnail recovery and an accessible unavailable state for failed gallery lightbox images, with the Service Worker cache raised to v1.7.
- Prevented offline contact-form submissions from navigating away, preserving entered values and announcing that a connection is required, with the Service Worker cache raised to v1.8.
- Made contact-form name and message length requirements visible before entry and associated each hint with its field alongside validation errors.
- Added focused link and accessibility check selection to the managed QA server runner, preserving the default full-check workflow.
- Added canonical source locations to composed HTML validation diagnostics, making template and shared partial errors easier to locate without changing generated HTML.

### Documentation

- Established the canonical changelog and its maintenance rule for significant completed changes, including tasks with restricted documentation scope.
- Corrected bilingual README paths and project trees, and documented the GitHub Actions quality workflow and its separation from deployment.
- Documented the active development plan and current audit in both README language sections, aligning both project trees with the repository layout.
- Reconciled project documentation with current dependencies, QA, metadata and Service Worker behavior, removed duplicate entries, and clarified completed work in archived reports (2026-09-26).
- Consolidated build and QA command documentation into a single operational reference, aligning bilingual README guidance and project context without changing executable workflows.

### Build and Tooling

- Replaced QA server process-tree cleanup with the existing http-server API in a small Node runner, avoiding missing WMIC on Windows and rejecting occupied QA ports.
- Separated source development from production output: source HTML uses ordinary assets; a clean build writes minified CSS/JS only into `dist/` and transforms copied HTML/Service Worker references.
- Added explicit dev/build/preview/qa/qa:dist workflows, production integrity checks and dist-based link/accessibility QA; restored the required bootstrap script in the deployment package and removed tracked source-tree bundles and obsolete command aliases.
- Added PostCSS and esbuild asset builds, a local static development server and explicit `dist/` packaging of pages, selected public assets and static-hosting configuration.
- Added a Sharp image-generation workflow from `assets/img-src/` to `assets/img-optimized/`, producing AVIF, WebP and JPEG or PNG variants.
- Extended ESLint coverage to browser modules, the Service Worker and all Node.js build and QA scripts with environment-specific globals, and removed an unused image-build declaration.
- Limited production font packaging to four referenced variable WOFF2 files while retaining all source fonts.
- Centralized shared header and footer markup into canonical HTML partials, integrating composition into development, production builds and QA, with the Service Worker cache raised to v1.6.
- Added SHA-256 precache fingerprint verification to production integrity checks, detecting changed cached assets during builds.

### Testing

- Added npm workflows for ESLint, HTML validation, local and external link checks, and configured pa11y-ci accessibility audits.
- Extended source contract validation to reject demonstration-modal markup without its JavaScript initializer and incomplete theme bootstrap or colour metadata across all 11 pages.
- Added source validation to keep the complete static menu and featured cards consistent with canonical menu data, including item selection, prices, categories and completeness.
- Extended automated accessibility checks to all 11 pages, including the contact form page, with successful source and production validation.
- Verified the complete source and production QA pipelines, with zero local link or automated accessibility errors across all 11 pages; tracked external-link findings for follow-up.
- Extended source QA to enforce unique per-page metadata and consistency between canonical URLs, Open Graph URLs and breadcrumb structured data.
- Added source validation to keep static and featured menu cards consistent with canonical menu data across item selection, prices, categories, descriptions and ordered tags, and to reject menu filters without matching data tags.
- Extended pa11y-ci coverage with a contact form validation-error scenario, verifying all three fields in both source and production QA.
