import { ALL_PAGES, INDEXABLE_PAGES, SITE } from "./site-config.mjs";
import {
  CONTENT_IMAGE_ASSETS,
  CONTENT_IMAGE_PATHS,
  getFallbackImagePath,
  getImagePaths,
} from "./image-config.mjs";

export const CACHE_PREFIX = "lauren-english-v";
export const OFFLINE_PATH = "/offline.html";
export const MANIFEST_PATH = SITE.manifest.path;

export const PRIMARY_DOCUMENT_PATHS = Object.freeze(
  INDEXABLE_PAGES.map(({ file }) => `/${file}`),
);

export const PUBLISHED_DOCUMENT_PATHS = Object.freeze(
  ALL_PAGES.map(({ file }) => `/${file}`),
);

export const CSS_ENTRY_PATH = SITE.runtime.stylesheet;
export const JAVASCRIPT_ENTRY_PATH = SITE.runtime.javascript;

const INTER_LATIN_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const INTER_LATIN_EXT_RANGE =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

export const RUNTIME_CSS_PATHS = Object.freeze([
  CSS_ENTRY_PATH,
  "/css/tokens/tokens.css",
  "/css/base/base.css",
  "/css/base/typography.css",
  "/css/utilities/utilities.css",
  "/css/components/eyebrow.css",
  "/css/components/cta-panel.css",
  "/css/components/project-disclosure.css",
  "/css/components/buttons.css",
  "/css/components/navigation.css",
  "/css/components/cards.css",
  "/css/components/badges.css",
  "/css/components/lists.css",
  "/css/components/accordion.css",
  "/css/components/forms.css",
  "/css/components/tabs.css",
  "/css/sections/hero.css",
  "/css/sections/how.css",
  "/css/sections/services.css",
  "/css/sections/pricing.css",
  "/css/sections/resources.css",
  "/css/sections/testimonials.css",
  "/css/sections/about.css",
  "/css/sections/contact.css",
  "/css/sections/footer.css",
  "/css/sections/offline.css",
  "/css/sections/reveal.css",
  "/css/pages/pages.css",
  "/css/pages/legal.css",
]);

export const RUNTIME_JAVASCRIPT_PATHS = Object.freeze([
  JAVASCRIPT_ENTRY_PATH,
  "/js/modules/reveal.js",
  "/js/modules/headerShrink.js",
  "/js/modules/mobileNav.js",
  "/js/modules/scrollSpy.js",
  "/js/modules/accordion.js",
  "/js/modules/materialsCatalog.js",
  "/js/modules/anchorFocus.js",
  "/js/modules/projectDisclosure.js",
  "/js/pages/progress-page.js",
  "/js/state/browserStorage.js",
  "/js/data/materials.js",
  "/js/data/materialAccess.js",
  "/js/data/materialFilters.js",
  "/js/data/packages.js",
  "/js/data/progress.js",
  "/js/state/storage.js",
]);

export const FONT_ASSETS = Object.freeze(
  [
    {
      family: "Inter",
      path: "/assets/fonts/inter-400.woff2",
      style: "normal",
      weight: 400,
      unicodeRange: INTER_LATIN_RANGE,
    },
    {
      family: "Inter",
      path: "/assets/fonts/inter-latin-ext.woff2",
      style: "normal",
      weight: 400,
      unicodeRange: INTER_LATIN_EXT_RANGE,
    },
    {
      family: "Inter",
      path: "/assets/fonts/inter-600.woff2",
      style: "normal",
      weight: 600,
      unicodeRange: INTER_LATIN_RANGE,
    },
    {
      family: "Inter",
      path: "/assets/fonts/inter-latin-ext.woff2",
      style: "normal",
      weight: 600,
      unicodeRange: INTER_LATIN_EXT_RANGE,
    },
    {
      family: "Inter",
      path: "/assets/fonts/inter-700.woff2",
      style: "normal",
      weight: 700,
      unicodeRange: INTER_LATIN_RANGE,
    },
    {
      family: "Inter",
      path: "/assets/fonts/inter-latin-ext.woff2",
      style: "normal",
      weight: 700,
      unicodeRange: INTER_LATIN_EXT_RANGE,
    },
    {
      family: "Literata",
      path: SITE.headingFont.path,
      style: "normal",
      weight: 700,
    },
  ].map(Object.freeze),
);

export const FONT_PATHS = Object.freeze([
  ...new Set(FONT_ASSETS.map(({ path }) => path)),
]);

export const MANIFEST_ICON_PATHS = Object.freeze([
  "/assets/favicon/web-app-manifest-192x192.png",
  "/assets/favicon/web-app-manifest-512x512.png",
]);

export const SHORTCUT_ICON_PATHS = Object.freeze([
  "/assets/pwa/shortcuts/packages-192.png",
  "/assets/pwa/shortcuts/materials-192.png",
  "/assets/pwa/shortcuts/progress-192.png",
]);

export const MANIFEST_SCREENSHOT_PATHS = Object.freeze([
  "/assets/pwa/screenshots/home-desktop-1280x720.png",
  "/assets/pwa/screenshots/home-mobile-720x1280.png",
]);

export const HOMEPAGE_HERO_ASSET = CONTENT_IMAGE_ASSETS.find(
  ({ key }) => key === "homepage-hero",
);
export const HERO_IMAGE_PATH = getFallbackImagePath(HOMEPAGE_HERO_ASSET);
export const HERO_IMAGE_PATHS = Object.freeze(
  getImagePaths(HOMEPAGE_HERO_ASSET),
);
export const BRAND_LOGO_PATH = SITE.brandLogo.path;
export const THEME_ICON_PATHS = Object.freeze([
  "/assets/icons/sun.svg",
  "/assets/icons/moon.svg",
]);
// Published documents ship every configured candidate in their `<picture>`
// srcsets, and the browser picks one from viewport, density and format support
// the service worker cannot predict. Caching only the JPEG fallback leaves the
// selected AVIF or WebP candidate uncacheable offline, so the offline contract
// covers the complete configured candidate set.
export const OFFLINE_PAGE_IMAGE_PATHS = CONTENT_IMAGE_PATHS;

export const STATIC_PRECACHE_PATHS = Object.freeze([
  ...FONT_PATHS,
  ...MANIFEST_ICON_PATHS,
  ...SHORTCUT_ICON_PATHS,
  BRAND_LOGO_PATH,
  ...THEME_ICON_PATHS,
  ...OFFLINE_PAGE_IMAGE_PATHS,
  MANIFEST_PATH,
]);

export const PRECACHE_PATHS = Object.freeze([
  ...PRIMARY_DOCUMENT_PATHS,
  OFFLINE_PATH,
  ...RUNTIME_CSS_PATHS,
  ...RUNTIME_JAVASCRIPT_PATHS,
  ...STATIC_PRECACHE_PATHS,
]);

export const CRITICAL_ASSET_BUDGET = Object.freeze({
  runtimeCssRequests: RUNTIME_CSS_PATHS.length,
  runtimeJavaScriptRequests: RUNTIME_JAVASCRIPT_PATHS.length,
  initialFontRequests: FONT_PATHS.length,
  preloadedFontRequests: 1,
  brandLogoRequests: 1,
  heroImageRequests: 1,
  maximumHeroImageBytes: 270_000,
  maximumHeroAvifTransferBytes: 190_000,
  maximumInitialFontBytes: 270_000,
});

export const normalizePublicPath = (path) => {
  const url = new URL(path, "https://pwa.local");
  return url.pathname === "/" ? "/index.html" : url.pathname;
};
