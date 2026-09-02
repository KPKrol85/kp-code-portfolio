import { qs } from "./dom.js";
import { fetchJson } from "./data.js";
import { setUiState, clearUiState } from "./ui-state.js";
import { createFallbackNotice } from "./fallback.js";
import { formatCurrency } from "../utils.js";
import {
  buildProductUrl,
  buildTravelKitUrl,
  isPrerenderedRoot,
  resolveTravelKitSlug,
} from "./routes.js";
import { loadNormalizedProducts } from "./product-data.js";

const SITE_NAME = "Outland Gear";
const SITE_URL = "https://e-commerce-pr02-outlandgear.netlify.app/";
const KIT_ROOT_SELECTOR = "[data-kit-root]";
const FALLBACK_SOCIAL_IMAGE = "assets/og-img/og-img.png";
const FALLBACK_SOCIAL_IMAGE_ALT =
  "Grafika Outland Gear przedstawiająca leśny krajobraz, góry, jezioro i centralne logo marki w zielono-beżowej kolorystyce.";
const FALLBACK_SOCIAL_IMAGE_TYPE = "image/png";
const FALLBACK_SOCIAL_IMAGE_WIDTH = "1536";
const FALLBACK_SOCIAL_IMAGE_HEIGHT = "1024";
const WEBPAGE_SCHEMA_SELECTOR = 'script[data-schema="webpage"]';
const TRAVEL_KITS_DATA_PATH = "/data/travel-kits.json";
const KIT_SLUG_ALIASES = new Map([["wekend-w-gorach", "weekend-w-gorach"]]);
let travelKitsInitialized = false;

const ensureMetaTag = (selector, attributes) => {
  let tag = document.querySelector(selector);
  if (!tag) {
    tag = document.createElement("meta");
    Object.entries(attributes || {}).forEach(([key, value]) => {
      tag.setAttribute(key, value);
    });
    document.head.appendChild(tag);
  }
  return tag;
};

const setMetaContent = (selector, attributes, value) => {
  const tag = ensureMetaTag(selector, attributes);
  if (tag) {
    tag.setAttribute("content", value);
  }
};

const ensureJsonLdScript = (selector, schemaType) => {
  let script = document.querySelector(selector);
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", schemaType);
    document.head.appendChild(script);
  }
  return script;
};

const setJsonLd = (selector, schemaType, payload) => {
  const script = ensureJsonLdScript(selector, schemaType);
  if (script) {
    script.textContent = JSON.stringify(payload);
  }
};

const findKitBySlug = (kits, slug) => {
  const rawSlug = typeof slug === "string" ? slug.trim() : "";
  const normalizedSlug = KIT_SLUG_ALIASES.get(rawSlug) || rawSlug;
  if (!normalizedSlug) return null;
  return kits.find((kit) => kit?.slug === normalizedSlug) || null;
};

const resolveKitProducts = (kit, products) => {
  const ids = Array.isArray(kit?.productIds)
    ? kit.productIds.map(Number).filter(Number.isInteger)
    : [];
  const byId = new Map(
    (Array.isArray(products) ? products : []).map((product) => [
      Number(product?.id),
      product,
    ]),
  );
  const matched = [];
  const missing = [];

  ids.forEach((id) => {
    const product = byId.get(id);
    if (product) {
      matched.push(product);
    } else {
      missing.push(id);
    }
  });

  return { matched, missing };
};

const setKitMetadata = (kit) => {
  if (!kit?.slug) return;

  const pageTitle = [kit.title, kit.label, SITE_NAME].filter(Boolean).join(" | ");
  const description = [kit.description, kit.duration].filter(Boolean).join(" ");
  const canonicalUrl = new URL(buildTravelKitUrl(kit.slug), window.location.origin);
  const canonicalHref = canonicalUrl.href;
  const imageUrl = new URL(FALLBACK_SOCIAL_IMAGE, window.location.origin).href;

  document.title = pageTitle;
  setMetaContent('meta[name="description"]', { name: "description" }, description);

  const canonicalLink = document.querySelector('link[rel="canonical"]');
  if (canonicalLink) {
    canonicalLink.setAttribute("href", canonicalHref);
  }

  setMetaContent('meta[property="og:title"]', { property: "og:title" }, pageTitle);
  setMetaContent(
    'meta[property="og:description"]',
    { property: "og:description" },
    description,
  );
  setMetaContent('meta[property="og:url"]', { property: "og:url" }, canonicalHref);
  setMetaContent('meta[property="og:image"]', { property: "og:image" }, imageUrl);
  setMetaContent(
    'meta[property="og:image:alt"]',
    { property: "og:image:alt" },
    FALLBACK_SOCIAL_IMAGE_ALT,
  );
  setMetaContent(
    'meta[property="og:image:type"]',
    { property: "og:image:type" },
    FALLBACK_SOCIAL_IMAGE_TYPE,
  );
  setMetaContent(
    'meta[property="og:image:width"]',
    { property: "og:image:width" },
    FALLBACK_SOCIAL_IMAGE_WIDTH,
  );
  setMetaContent(
    'meta[property="og:image:height"]',
    { property: "og:image:height" },
    FALLBACK_SOCIAL_IMAGE_HEIGHT,
  );

  setMetaContent('meta[name="twitter:title"]', { name: "twitter:title" }, pageTitle);
  setMetaContent(
    'meta[name="twitter:description"]',
    { name: "twitter:description" },
    description,
  );
  setMetaContent('meta[name="twitter:image"]', { name: "twitter:image" }, imageUrl);

  setJsonLd(WEBPAGE_SCHEMA_SELECTOR, "webpage", {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: pageTitle,
    description,
    url: canonicalHref,
    inLanguage: "pl-PL",
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  });
};

const renderTextList = (container, items, itemClassName = "") => {
  if (!container) return;
  container.innerHTML = "";

  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  values.forEach((value) => {
    const li = document.createElement("li");
    if (itemClassName) li.className = itemClassName;
    li.textContent = value;
    container.appendChild(li);
  });
};

const renderMetaList = (container, items) => {
  if (!container) return;
  container.innerHTML = "";

  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  values.forEach((value) => {
    const span = document.createElement("span");
    span.textContent = value;
    container.appendChild(span);
  });
};

const setTextContent = (element, value, options = {}) => {
  if (!element) return;
  const safeValue = typeof value === "string" ? value.trim() : "";
  const shouldHideWhenEmpty = options.hideWhenEmpty ?? false;

  element.textContent = safeValue;
  if (shouldHideWhenEmpty) {
    element.hidden = !safeValue;
  }
};

const createKitProductCard = (product) => {
  const article = document.createElement("article");
  article.className = "card kit-product-card";

  const mediaLink = document.createElement("a");
  mediaLink.className = "kit-product-card__media";
  mediaLink.href = buildProductUrl(product.slug);
  mediaLink.setAttribute("aria-label", `Przejdź do produktu ${product.name}`);

  const image = document.createElement("img");
  image.src = product.images?.[0] || "assets/svg/product-placeholder-01.svg";
  image.alt = product.imageAlt || product.name || "";
  image.loading = "lazy";
  image.decoding = "async";
  image.width = 320;
  image.height = 220;
  mediaLink.appendChild(image);

  const content = document.createElement("div");
  content.className = "kit-product-card__content";

  const meta = document.createElement("p");
  meta.className = "subtle kit-product-card__meta";
  meta.textContent = [product.category, product.subcategory].filter(Boolean).join(" • ");

  const title = document.createElement("h3");
  title.className = "kit-product-card__title";

  const titleLink = document.createElement("a");
  titleLink.href = buildProductUrl(product.slug);
  titleLink.textContent = product.name || "";
  title.appendChild(titleLink);

  const price = document.createElement("div");
  price.className = "kit-product-card__price";
  price.textContent = formatCurrency(product.price, product.currency);

  const action = document.createElement("a");
  action.className = "kit-product-card__link";
  action.href = buildProductUrl(product.slug);
  action.textContent = "Zobacz produkt";

  if (meta.textContent) {
    content.append(meta);
  }

  content.append(title, price, action);
  article.append(mediaLink, content);

  return article;
};

const renderKitProducts = (root, products, missingIds = []) => {
  const grid = qs("[data-kit-products]", root);
  const state = qs("[data-kit-products-state]", root);
  const intro = qs("[data-kit-products-intro]", root);
  if (!grid) return;

  grid.innerHTML = "";
  products.forEach((product) => {
    grid.appendChild(createKitProductCard(product));
  });

  if (intro) {
    intro.textContent = products.length
      ? "Kuratorski wybór realnych produktów z katalogu, które składają się na ten setup."
      : "Nie udało się obecnie powiązać produktów z tym kompletem.";
  }

  if (!state) return;

  if (!products.length) {
    setUiState(state, {
      type: "info",
      title: "Produkty w tym komplecie są chwilowo niedostępne",
      message:
        "Narracja zestawu jest dostępna, ale nie udało się powiązać produktów z katalogu.",
    });
    return;
  }

  if (missingIds.length) {
    setUiState(state, {
      type: "info",
      title: "Część produktów nie została załadowana",
      message: "Wyświetlamy dostępne pozycje przypisane do tego kompletu.",
    });
    return;
  }

  clearUiState(state);
};

const renderKit = (root, kit, products, missingIds) => {
  const content = qs("[data-kit-content]", root);
  const eyebrow = qs("[data-kit-eyebrow]", root);
  const label = qs("[data-kit-label]", root);
  const duration = qs("[data-kit-duration]", root);
  const title = qs("[data-kit-title]", root);
  const description = qs("[data-kit-description]", root);
  const image = qs("[data-kit-image]", root);
  const meta = qs("[data-kit-meta]", root);
  const supportTitle = qs("[data-kit-support-title]", root);
  const supportText = qs("[data-kit-support-text]", root);
  const highlights = qs("[data-kit-highlights]", root);
  const primaryCta = qs("[data-kit-primary-cta]", root);
  const secondaryCta = qs("[data-kit-secondary-cta]", root);

  setTextContent(eyebrow, kit.eyebrow || "Outland Gear Travel Kits");
  setTextContent(label, kit.label, { hideWhenEmpty: true });
  setTextContent(duration, kit.duration, { hideWhenEmpty: true });
  setTextContent(title, kit.title);
  setTextContent(description, kit.description);

  if (image) {
    image.src = kit.heroImage || "assets/svg/product-placeholder-01.svg";
    image.alt = kit.heroAlt || kit.title || "";
  }

  setTextContent(supportTitle, kit.supportTitle || "Dlaczego ten komplet działa");
  setTextContent(supportText, kit.supportText);

  renderMetaList(meta, kit.meta);
  renderTextList(highlights, kit.highlights);
  renderKitProducts(root, products, missingIds);

  if (primaryCta) {
    primaryCta.textContent = kit.ctaLabel || "Przejdź do katalogu";
    primaryCta.href = `kategoria.html?q=${encodeURIComponent(kit.ctaQuery || "")}`;
  }

  if (secondaryCta) {
    const secondaryHref = kit.secondaryCtaHref || "kategoria.html";
    const hasDistinctSecondary = Boolean(
      kit.secondaryCtaLabel &&
      secondaryHref &&
      secondaryHref !== primaryCta?.href &&
      !(
        secondaryHref.startsWith("kategoria.html?q=") &&
        primaryCta?.href?.includes("kategoria.html?q=")
      ),
    );

    secondaryCta.hidden = !hasDistinctSecondary;
    if (hasDistinctSecondary) {
      secondaryCta.textContent = kit.secondaryCtaLabel;
      secondaryCta.href = secondaryHref;
    }
  }

  if (content) {
    content.hidden = false;
  }
};

const hideKitContent = (root) => {
  const content = qs("[data-kit-content]", root);
  if (content) {
    content.hidden = true;
  }
};

const renderKitLoadError = (root) => {
  if (!root) return;

  root.innerHTML = "";
  const section = document.createElement("section");
  section.className = "section";
  const container = document.createElement("div");
  container.className = "container";

  const fallback = createFallbackNotice({
    message: "Nie udało się załadować danych zestawu. Odśwież stronę i spróbuj ponownie.",
    actionLabel: "Odśwież stronę",
    onAction: () => window.location.reload(),
  });

  container.appendChild(fallback);
  section.appendChild(container);
  root.appendChild(section);
};

const KIT_REFRESH_ERROR_STATE = {
  type: "error",
  title: "Nie udało się odświeżyć danych",
  message:
    "Pokazujemy zapisaną wersję tego kompletu. Odśwież stronę, aby spróbować ponownie.",
};

// On a prerendered page the served HTML is already complete, so a failed
// refresh is reported next to the content instead of replacing it.
const reportKitLoadFailure = (root, stateRegion) => {
  if (isPrerenderedRoot(root)) {
    setUiState(stateRegion, KIT_REFRESH_ERROR_STATE);
    return;
  }

  renderKitLoadError(root);
};

export const initTravelKits = async () => {
  const root = qs(KIT_ROOT_SELECTOR);
  if (!root) return;
  if (travelKitsInitialized) return;
  travelKitsInitialized = true;

  const stateRegion = qs("[data-kit-state]", root);
  const prerendered = isPrerenderedRoot(root);

  // A prerendered page already shows the full kit, so it refreshes in place
  // rather than collapsing to a loading state first.
  if (!prerendered) {
    hideKitContent(root);
    setUiState(stateRegion, {
      type: "loading",
      title: "Ładujemy komplet",
      message: "Pobieramy opis zestawu i przypisane produkty.",
    });
  }

  let kits;
  let products;
  try {
    [kits, products] = await Promise.all([
      fetchJson(TRAVEL_KITS_DATA_PATH),
      loadNormalizedProducts(),
    ]);
  } catch (error) {
    console.error("Travel kits data error", error);
    travelKitsInitialized = false;
    reportKitLoadFailure(root, stateRegion);
    return;
  }

  if (!Array.isArray(kits)) {
    console.error("Travel kits data error", { kits });
    travelKitsInitialized = false;
    reportKitLoadFailure(root, stateRegion);
    return;
  }

  const slug = resolveTravelKitSlug();
  const matchedKit = findKitBySlug(kits, slug);

  if (!matchedKit) {
    setUiState(
      stateRegion,
      prerendered
        ? KIT_REFRESH_ERROR_STATE
        : {
            type: "info",
            title: "Nie znaleźliśmy tego kompletu",
            message:
              "Wróć do strony głównej lub przejdź do katalogu, aby zobaczyć inne propozycje.",
          },
    );
    travelKitsInitialized = false;
    return;
  }

  try {
    const { matched, missing } = resolveKitProducts(matchedKit, products);
    renderKit(root, matchedKit, matched, missing);
    setKitMetadata(matchedKit);
    clearUiState(stateRegion);
  } catch (error) {
    console.error("Travel kits render error", error);
    travelKitsInitialized = false;
    reportKitLoadFailure(root, stateRegion);
  }
};
