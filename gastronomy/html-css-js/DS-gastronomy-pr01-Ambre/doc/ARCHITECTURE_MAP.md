# Architecture map (HTML hooks -> JS modules)

This map links key UI features to the JS module init points wired in `js/script.js`.
Scope: non-minified runtime modules in `js/modules/` and the selectors/attributes they read at runtime.
Use this as a quick lookup when changing markup so module hooks are not broken.

| Feature / Section | Page(s) | DOM Hook(s) | JS Module | Init Function / Entry | Notes |
|---|---|---|---|---|---|
| JS baseline helpers | all pages | `html.no-js`, `body.no-js` | `js/modules/utils.js` | `initHelpers()` via `boot()` in `js/script.js` | Removes `no-js` classes for progressive enhancement baseline. |
| Theme switcher | all pages with header | `[data-testid="site-header__theme-toggle"]` or `.site-header__theme-toggle`; optional `.theme-icon`; root `html[data-theme]` | `js/modules/theme.js` | `initThemeSwitcher()` | Persists theme in `localStorage` key `theme`; updates `aria-pressed`. |
| Mobile nav / drawer | pages with site header nav | `[data-testid="site-header__nav-toggle"]` / `.site-header__nav-toggle`; `[data-testid="site-header-nav"]` / `#site-header-nav`; `.site-header__overlay`; `.site-header__drawer`; `.site-header__drawer-inner`; `.site-header__item--has-submenu` | `js/modules/nav.js` | `initMobileNav()` | Injects drawer submenu triggers and toggles `body.site-header-nav-open`. |
| Header link current-state | pages with `.site-header__nav` | `.site-header__nav a`; hash/path matching against `href` | `js/modules/nav.js` | `initAriaCurrent()` | Sets `aria-current="page"` for current route/hash link. |
| Scrollspy for in-page sections | pages where nav links target in-page IDs | `#site-header-nav a[href]`; section IDs referenced by nav hashes | `js/modules/nav.js` | `initScrollspy()` | Uses `IntersectionObserver`; sets `aria-current="location"`. |
| Non-home nav href rewriting | non-home pages | `.site-header__nav a[href]` with `#menu` / `#galeria` | `js/modules/nav.js` | `initSmartNav()` | Rewrites hash targets to `menu.html` / `galeria.html` outside homepage. |
| Sticky header state | pages with `.site-header` | `.site-header`; `body.site-header-is-scrolled`; `body.site-header-is-shrunk` | `js/modules/nav.js` | `initStickyShadow()` | Adds body state classes after scroll threshold. |
| Scroll controls | pages with scroll buttons/targets | `[data-testid="scroll-down"]` or `.scroll-down`; `[data-testid="scroll-up"]` or `.scroll-up`; `[data-target]`; `a.site-header__brand[href^="#"]` | `js/modules/scroll.js` | `initScrollButtons()`, `initScrollToTop()`, `initScrollTargets()` | Honors `prefers-reduced-motion`. |
| Footer copyright year | pages with footer year placeholder | `#year` | `js/modules/footer.js` | `initFooterYear()` | Writes current year text. |
| CTA pulse | pages containing CTA hook (currently none in checked HTML) | `.btn-cta` | `js/modules/cta.js` | `initCtaPulse()` | No-op when `.btn-cta` is absent. |
| Demo legal modal | pages with demo legal modal | `#demo-legal-modal`; `[data-demo-legal-accept]`; `[data-demo-legal-close]` | `js/modules/demo-legal.js` | `initDemoLegalModal()` | Opens until accepted; acceptance persisted in `localStorage`. |
| Menu tabs filter | `index.html` (menu section), `menu.html` | `.menu__grid, .menu-grid`; `data-testid="menu-tabs"` (fallback: closest section); `.tabs__tab[data-filter]`; `.dish[data-cat]` / `.dish[data-filter]` | `js/modules/tabs.js` | `initTabs()` | Uses `aria-pressed`; respects `data-load-hidden` set by load-more module. |
| Menu load-more | `index.html`, `menu.html` | `.menu__grid, .menu-grid`; `.dish`; optional `[data-load-more]`; optional `[data-load-status]`; active `.tabs__tab` | `js/modules/load-more.js` | `initLoadMoreMenu()` | Without `[data-load-more]`, all items are marked as loaded; status updates only if status node exists. |
| Menu details accordion behavior | `menu.html` | `body.page-menu`; `.dish-more` (`<details>`) | `js/modules/page-menu.js` | `initPageMenuPanel()` | Keeps one open panel at a time; closes on outside click / `Escape`. |
| Reservation form validation & submit | page containing booking form (currently `index.html`) | `[data-testid="booking-form"]` / `.booking-form` / `#booking-form`; `#form-msg`; `#phone`, `#phone-error`; `#consent`, `#consent-error`; `.site-button--form`; honeypot `name="company"` | `js/modules/form.js` | `initReservationForm()` | Client validation + Netlify-style POST via `fetch`, with fallback to native submit. |
| Gallery tabs filter | `galeria.html` | `main.page-gallery`; `.gallery__tabs`; `.tabs__tab[data-filter]`; `.gallery__section .gallery__item[data-cat|data-filter]` | `js/modules/tabs.js` | `initGalleryFilter()` | Keyboard filter controls; preserves load-more hidden state via `data-load-hidden`. |
| Gallery load-more | `index.html`, `galeria.html` | `.gallery__grid`; `.gallery__item`; optional `[data-load-more]`; optional `[data-load-status]`; active `.tabs__tab` | `js/modules/load-more.js` | `initLoadMoreGallery()` | Step-wise reveal when button exists; otherwise items are treated as loaded and only filter logic applies. |
| Lightbox (gallery + dish thumbs) | pages with lightbox root and clickable media | `.site-lightbox` / `#lb`; `#lb-avif`; `#lb-webp`; `.site-lightbox__image` / `#lb-img`; `.site-lightbox__close`; `.site-lightbox__overlay`; `.gallery__item`; `.dish__thumb`; optional `.site-lightbox__counter` | `js/modules/lightbox.js` | `initLightbox()` | Opens from `.gallery__item` / `.dish__thumb`; adds keyboard, swipe, nav, zoom/fullscreen behaviors. |
| FAQ ARIA sync | page with FAQ section (currently `index.html`) | `#faq` (fallback `.faq`); `details`; `summary`; `.faq__content` | `js/modules/faq.js` | `initFaqAria()` | Adds `aria-controls` and syncs `aria-expanded` on toggle. |


## JSON-LD policy (core vs special pages)

### Scope and rationale
- JSON-LD (`<script type="application/ld+json">`) is required only on core/indexable pages that already include it by design.
- Operational/special pages are intentionally excluded from JSON-LD.
- `offline.html` and `404.html` are **not SEO landing targets**; keeping JSON-LD absent on these pages reduces unnecessary CSP hash maintenance for inline scripts.

### Deterministic page classification
- **Core pages (JSON-LD required):**
  - `index.html`
  - `menu.html`
  - `galeria.html`
  - `cookies.html`
  - `polityka-prywatnosci.html`
  - `regulamin.html`
- **Special operational pages (JSON-LD forbidden):**
  - `offline.html`
  - `404.html`

### QA enforcement
- Policy is enforced by `scripts/schema-policy-check.mjs`.
- The check recursively scans `*.html` files and fails when:
  - `offline.html` or `404.html` contains `type="application/ld+json"`, or
  - any required core page listed above no longer contains `type="application/ld+json"`.
- Violations are reported as `file:line:column: message` with non-zero exit code.
