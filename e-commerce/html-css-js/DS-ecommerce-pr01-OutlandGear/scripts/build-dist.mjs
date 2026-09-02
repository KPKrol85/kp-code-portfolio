import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// postcss, cssnano and esbuild are loaded on demand inside buildCss/buildJs.
// They are the heaviest dependencies here, and keeping them off the module's
// top level lets `build:html` and the build-transform tests import this file
// without paying for a toolchain they never use.
import {
  SEO_ORIGIN,
  buildProductPath,
  buildRobotsTxt,
  buildSitemapXml,
  buildTravelKitPath,
} from "./seo-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const DIST_CSS = path.join(DIST, "css");
const DIST_JS = path.join(DIST, "js");
const HTML_ENTRY_GLOB = /\.html$/i;
const STATIC_DIRS = ["assets", "data"];
const PARTIALS = {
  header: {
    path: "partials/header.html",
    tag: "header",
  },
  footer: {
    path: "partials/footer.html",
    tag: "footer",
  },
};
const PRODUCT_TEMPLATE = "produkt.html";
const TRAVEL_KIT_TEMPLATE = "komplety.html";
const SITE_NAME = "Outland Gear";
const FALLBACK_SOCIAL_IMAGE = "/assets/og-img/og-img.png";
const FALLBACK_SOCIAL_IMAGE_ALT =
  "Grafika Outland Gear przedstawiajaca lesny krajobraz, gory, jezioro i centralne logo marki w zielono-bezowej kolorystyce.";
const FALLBACK_SOCIAL_IMAGE_TYPE = "image/png";
const FALLBACK_SOCIAL_IMAGE_WIDTH = "1536";
const FALLBACK_SOCIAL_IMAGE_HEIGHT = "1024";

const command = process.argv[2] || "build";

const ensureDir = async (targetPath) => {
  await fs.mkdir(targetPath, { recursive: true });
};

const emptyDir = async (targetPath) => {
  await fs.rm(targetPath, { recursive: true, force: true });
  await ensureDir(targetPath);
};

const readText = async (relativePath) =>
  fs.readFile(path.join(ROOT, relativePath), "utf8");

const readJson = async (relativePath) =>
  JSON.parse(await fs.readFile(path.join(ROOT, relativePath), "utf8"));

const writeText = async (relativePath, content) => {
  const fullPath = path.join(ROOT, relativePath);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, content, "utf8");
};

const writeTextToDir = async (baseDir, relativePath, content) => {
  const fullPath = path.join(baseDir, relativePath);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, content, "utf8");
};

const shouldCopyAssetPath = (sourcePath) => {
  const relativePath = path.relative(ROOT, sourcePath);
  const normalizedPath = relativePath.split(path.sep).join("/");

  if (!normalizedPath || normalizedPath.startsWith("..")) return false;
  if (normalizedPath === "assets/img-src" || normalizedPath.startsWith("assets/img-src/"))
    return false;
  if (path.basename(sourcePath).startsWith(".")) return false;

  return true;
};

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeJsonForScript = (value) =>
  JSON.stringify(value, null, 2).replace(/</g, "\\u003c");

const stripQuery = (value = "") => value.replace(/\?.*$/, "");

const normalizePublicPath = (value = "") => {
  const cleanValue = stripQuery(String(value || "")).trim();
  if (!cleanValue) return "";
  return cleanValue.startsWith("/") ? cleanValue : `/${cleanValue}`;
};

const buildAbsoluteAssetUrl = (assetPath) =>
  new URL(normalizePublicPath(assetPath), `${SEO_ORIGIN}/`).toString();

const isPlaceholderAsset = (value = "") => /product-placeholder/i.test(value);

const selectSocialImagePath = (...candidates) => {
  const validCandidate = candidates
    .flat()
    .find((candidate) => candidate && !isPlaceholderAsset(candidate));
  return validCandidate ? normalizePublicPath(validCandidate) : FALLBACK_SOCIAL_IMAGE;
};

const formatDisplayCurrency = (value, currency = "PLN") => {
  if (!Number.isFinite(value)) return "";
  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${normalized} ${currency}`;
};

const formatOfferPrice = (value) =>
  Number.isFinite(value) ? Number(value).toFixed(2) : "";

const renderListItems = (items = []) =>
  items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

const renderSpecRows = (specs = {}) =>
  Object.entries(specs)
    .map(
      ([label, value]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");

export const inlinePartial = (html, { tag, partialPath, partialContent }) => {
  const partialPattern = new RegExp(
    `<${tag}([^>]*?)\\sdata-partial-src=["']${escapeForRegExp(partialPath)}["']([^>]*)>[\\s\\S]*?<\\/${tag}>`,
    "i",
  );

  const match = html.match(partialPattern);
  if (!match) {
    throw new Error(`Missing ${tag} partial host for ${partialPath}`);
  }

  const attrs = `${match[1]}${match[2]}`.replace(/\s+/g, " ").trim();
  const openingTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
  return html.replace(
    partialPattern,
    `${openingTag}\n${partialContent.trim()}\n</${tag}>`,
  );
};

export const replaceTitleTag = (html, value) =>
  html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(value)}</title>`);

export const replaceMetaContent = (html, attrName, attrValue, content) => {
  const pattern = new RegExp(
    `(<meta[^>]+${attrName}=["']${escapeForRegExp(attrValue)}["'][^>]+content=["'])[^"']*(["'][^>]*>)`,
    "i",
  );
  return html.replace(pattern, `$1${escapeHtml(content)}$2`);
};

export const replaceLinkHref = (html, rel, href) => {
  const pattern = new RegExp(
    `(<link[^>]+rel=["']${escapeForRegExp(rel)}["'][^>]+href=["'])[^"']*(["'][^>]*>)`,
    "i",
  );
  return html.replace(pattern, `$1${escapeHtml(href)}$2`);
};

export const replaceJsonLdScript = (html, selector, payload) => {
  const attribute =
    selector === "organization"
      ? ""
      : `[^>]*data-schema=["']${escapeForRegExp(selector)}["'][^>]*`;
  const pattern = new RegExp(
    `(<script type=["']application/ld\\+json["']${attribute}>)[\\s\\S]*?(<\\/script>)`,
    "i",
  );
  return html.replace(pattern, `$1\n${escapeJsonForScript(payload)}\n$2`);
};

export const injectBaseHref = (html) => {
  if (/<base\s/i.test(html)) return html;
  return html.replace(/<head>/i, '<head>\n    <base href="/" />');
};

export const removeHiddenAttributeFromElement = (html, pattern) =>
  html.replace(pattern, (match) => match.replace(/\s+hidden\b/, ""));

// Marks the page root of a prerendered detail page so client-side modules can
// treat the served HTML as the baseline instead of a placeholder.
export const markPrerenderedRoot = (html, rootAttribute) => {
  const pattern = new RegExp(
    `<main([^>]*\\s${escapeForRegExp(rootAttribute)})([^>]*)>`,
    "i",
  );

  if (!pattern.test(html)) {
    throw new Error(`Missing prerender root <main ${rootAttribute}>`);
  }

  return html.replace(pattern, `<main$1 data-prerendered="true"$2>`);
};

const buildOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: `${SEO_ORIGIN}/`,
  logo: `${SEO_ORIGIN}/assets/logo/logo.svg`,
});

const createDistHtml = async (sourceFile, transform = (html) => html) => {
  let html = await readText(sourceFile);
  const headerPartial = await readText(PARTIALS.header.path);
  const footerPartial = await readText(PARTIALS.footer.path);

  html = inlinePartial(html, {
    tag: PARTIALS.header.tag,
    partialPath: PARTIALS.header.path,
    partialContent: headerPartial,
  });

  html = inlinePartial(html, {
    tag: PARTIALS.footer.tag,
    partialPath: PARTIALS.footer.path,
    partialContent: footerPartial,
  });

  html = html
    .replace(/href="css\/main\.css(?:\?[^"]*)?"/g, 'href="css/main.min.css"')
    .replace(/src="js\/app\.js(?:\?[^"]*)?"/g, 'src="js/app.min.js"');

  return transform(html);
};

const writeDistHtml = async (relativePath, html) => {
  await writeText(path.join("dist", relativePath), html);
};

const buildProductMetadata = (product) => {
  const canonicalPath = buildProductPath(product.slug);
  const canonicalUrl = new URL(canonicalPath, `${SEO_ORIGIN}/`).toString();
  const pageTitle = [product.name, product.category, SITE_NAME]
    .filter(Boolean)
    .join(" | ");
  const description = [product.shortDescription, product.subcategory]
    .filter(Boolean)
    .join(" ");
  const socialImagePath = selectSocialImagePath(product.images?.[0]);
  const socialImageUrl = buildAbsoluteAssetUrl(socialImagePath);

  return {
    pageTitle,
    description,
    canonicalUrl,
    socialImageUrl,
    webpageSchema: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: pageTitle,
      description,
      url: canonicalUrl,
      inLanguage: "pl-PL",
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: `${SEO_ORIGIN}/`,
      },
    },
    productSchema: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.shortDescription || description,
      category: product.category || undefined,
      sku: String(product.id || product.slug),
      image: (Array.isArray(product.images) ? product.images : [])
        .map((image) => selectSocialImagePath(image))
        .filter(Boolean)
        .map(buildAbsoluteAssetUrl),
      url: canonicalUrl,
      brand: {
        "@type": "Brand",
        name: SITE_NAME,
      },
      offers: {
        "@type": "Offer",
        priceCurrency: product.currency || "PLN",
        price: formatOfferPrice(product.price),
        availability:
          product.stockStatus === "Dostepny" || product.stockStatus === "Dostępny"
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        url: canonicalUrl,
      },
      aggregateRating: Number.isFinite(product.rating)
        ? {
            "@type": "AggregateRating",
            ratingValue: String(product.rating),
            reviewCount: String(product.reviewsCount || 0),
          }
        : undefined,
    },
  };
};

export const applyProductPrerender = (html, product) => {
  const metadata = buildProductMetadata(product);
  const images =
    Array.isArray(product.images) && product.images.length
      ? product.images
      : ["assets/svg/product-placeholder-01.svg"];
  const oldPrice = product.oldPrice
    ? formatDisplayCurrency(product.oldPrice, product.currency)
    : "";

  let nextHtml = injectBaseHref(html);
  nextHtml = markPrerenderedRoot(nextHtml, "data-product-root");
  nextHtml = replaceTitleTag(nextHtml, metadata.pageTitle);
  nextHtml = replaceMetaContent(
    nextHtml,
    "name",
    "robots",
    "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  );
  nextHtml = replaceMetaContent(nextHtml, "name", "description", metadata.description);
  nextHtml = replaceMetaContent(nextHtml, "property", "og:title", metadata.pageTitle);
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:description",
    metadata.description,
  );
  nextHtml = replaceMetaContent(nextHtml, "property", "og:url", metadata.canonicalUrl);
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:image",
    metadata.socialImageUrl,
  );
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:image:alt",
    FALLBACK_SOCIAL_IMAGE_ALT,
  );
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:image:type",
    FALLBACK_SOCIAL_IMAGE_TYPE,
  );
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:image:width",
    FALLBACK_SOCIAL_IMAGE_WIDTH,
  );
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:image:height",
    FALLBACK_SOCIAL_IMAGE_HEIGHT,
  );
  nextHtml = replaceMetaContent(nextHtml, "name", "twitter:title", metadata.pageTitle);
  nextHtml = replaceMetaContent(
    nextHtml,
    "name",
    "twitter:description",
    metadata.description,
  );
  nextHtml = replaceMetaContent(
    nextHtml,
    "name",
    "twitter:image",
    metadata.socialImageUrl,
  );
  nextHtml = replaceLinkHref(nextHtml, "canonical", metadata.canonicalUrl);
  nextHtml = replaceLinkHref(nextHtml, "alternate", metadata.canonicalUrl);
  nextHtml = replaceJsonLdScript(nextHtml, "organization", buildOrganizationSchema());
  nextHtml = replaceJsonLdScript(nextHtml, "webpage", metadata.webpageSchema);
  nextHtml = replaceJsonLdScript(nextHtml, "product", metadata.productSchema);
  nextHtml = nextHtml.replace(
    /(<span class="breadcrumbs__current" aria-current="page">)[\s\S]*?(<\/span>)/i,
    `$1${escapeHtml(product.name)}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<img\s+data-product-main[^>]*src=")[^"]*("\s+alt=")[^"]*("[^>]*>)/i,
    `$1${escapeHtml(images[0])}$2${escapeHtml(product.imageAlt || product.name)}$3`,
  );
  nextHtml = nextHtml.replace(
    /(<h1 data-product-title>)[\s\S]*?(<\/h1>)/i,
    `$1${escapeHtml(product.name)}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<p class="subtle" data-product-rating>)[\s\S]*?(<\/p>)/i,
    `$1${escapeHtml(`Ocena ${product.rating} • ${product.reviewsCount} opinii`)}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<p data-product-description>)[\s\S]*?(<\/p>)/i,
    `$1${escapeHtml(product.shortDescription || "")}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<div class="product-price" data-product-price>)[\s\S]*?(<\/div>)/i,
    `$1${escapeHtml(formatDisplayCurrency(product.price, product.currency))}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<div class="subtle" data-product-old-price>)[\s\S]*?(<\/div>)/i,
    `$1${escapeHtml(oldPrice)}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<p class="badge" data-product-stock>)[\s\S]*?(<\/p>)/i,
    `$1${escapeHtml(product.stockStatus || "")}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<ul class="stack" data-product-highlights>)[\s\S]*?(<\/ul>)/i,
    `$1${renderListItems(product.highlights || [])}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<tbody data-product-specs>)[\s\S]*?(<\/tbody>)/i,
    `$1${renderSpecRows(product.specs || {})}$2`,
  );

  const thumbPattern = /<button\s+type="button"\s+data-product-thumb[\s\S]*?<\/button>/gi;
  const thumbMatches = nextHtml.match(thumbPattern) || [];
  thumbMatches.forEach((thumbHtml, index) => {
    const imageSrc = images[index];
    let nextThumb = thumbHtml;

    if (imageSrc) {
      nextThumb = nextThumb
        .replace(/\s+hidden\b/gi, "")
        .replace(/\s+disabled\b/gi, "")
        .replace(
          /(<button[^>]*aria-label=")[^"]*("[^>]*aria-pressed=")[^"]*("[^>]*>)/i,
          `$1${escapeHtml(`Pokaz zdjecie ${index + 1} produktu ${product.name}`)}$2${index === 0 ? "true" : "false"}$3`,
        )
        .replace(/(<img[^>]*src=")[^"]*("[^>]*>)/i, `$1${escapeHtml(imageSrc)}$2`);
    } else {
      nextThumb = nextThumb
        .replace(/<button(\s)/i, "<button hidden disabled$1")
        .replace(/aria-pressed="[^"]*"/i, 'aria-pressed="false"');
    }

    nextHtml = nextHtml.replace(thumbHtml, nextThumb);
  });

  return nextHtml;
};

const buildTravelKitMetadata = (kit) => {
  const canonicalPath = buildTravelKitPath(kit.slug);
  const canonicalUrl = new URL(canonicalPath, `${SEO_ORIGIN}/`).toString();
  const pageTitle = [kit.title, kit.label, SITE_NAME].filter(Boolean).join(" | ");
  const description = [kit.description, kit.duration].filter(Boolean).join(" ");
  const socialImagePath = selectSocialImagePath(kit.heroImage);
  const socialImageUrl = buildAbsoluteAssetUrl(socialImagePath);

  return {
    pageTitle,
    description,
    canonicalUrl,
    socialImageUrl,
    webpageSchema: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: pageTitle,
      description,
      url: canonicalUrl,
      inLanguage: "pl-PL",
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: `${SEO_ORIGIN}/`,
      },
    },
  };
};

const renderTravelKitCards = (products = []) =>
  products
    .map(
      (product) => `
        <article class="card kit-product-card">
          <a class="kit-product-card__media" href="${escapeHtml(buildProductPath(product.slug))}" aria-label="${escapeHtml(`Przejdz do produktu ${product.name}`)}">
            <img src="${escapeHtml(product.images?.[0] || "assets/svg/product-placeholder-01.svg")}" alt="${escapeHtml(product.imageAlt || product.name || "")}" width="320" height="220" loading="lazy" decoding="async" />
          </a>
          <div class="kit-product-card__content">
            <p class="subtle kit-product-card__meta">${escapeHtml([product.category, product.subcategory].filter(Boolean).join(" • "))}</p>
            <h3 class="kit-product-card__title"><a href="${escapeHtml(buildProductPath(product.slug))}">${escapeHtml(product.name || "")}</a></h3>
            <div class="kit-product-card__price">${escapeHtml(formatDisplayCurrency(product.price, product.currency))}</div>
            <a class="kit-product-card__link" href="${escapeHtml(buildProductPath(product.slug))}">Zobacz produkt</a>
          </div>
        </article>`,
    )
    .join("");

export const applyTravelKitPrerender = (html, kit, products) => {
  const metadata = buildTravelKitMetadata(kit);
  const matchedProducts = (Array.isArray(products) ? products : []).filter((product) =>
    Array.isArray(kit.productIds) ? kit.productIds.includes(product.id) : false,
  );
  const primaryHref = `kategoria.html${kit.ctaQuery ? `?q=${encodeURIComponent(kit.ctaQuery)}` : ""}`;

  let nextHtml = injectBaseHref(html);
  nextHtml = markPrerenderedRoot(nextHtml, "data-kit-root");
  nextHtml = replaceTitleTag(nextHtml, metadata.pageTitle);
  nextHtml = replaceMetaContent(
    nextHtml,
    "name",
    "robots",
    "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  );
  nextHtml = replaceMetaContent(nextHtml, "name", "description", metadata.description);
  nextHtml = replaceMetaContent(nextHtml, "property", "og:title", metadata.pageTitle);
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:description",
    metadata.description,
  );
  nextHtml = replaceMetaContent(nextHtml, "property", "og:url", metadata.canonicalUrl);
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:image",
    metadata.socialImageUrl,
  );
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:image:alt",
    FALLBACK_SOCIAL_IMAGE_ALT,
  );
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:image:type",
    FALLBACK_SOCIAL_IMAGE_TYPE,
  );
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:image:width",
    FALLBACK_SOCIAL_IMAGE_WIDTH,
  );
  nextHtml = replaceMetaContent(
    nextHtml,
    "property",
    "og:image:height",
    FALLBACK_SOCIAL_IMAGE_HEIGHT,
  );
  nextHtml = replaceMetaContent(nextHtml, "name", "twitter:title", metadata.pageTitle);
  nextHtml = replaceMetaContent(
    nextHtml,
    "name",
    "twitter:description",
    metadata.description,
  );
  nextHtml = replaceMetaContent(
    nextHtml,
    "name",
    "twitter:image",
    metadata.socialImageUrl,
  );
  nextHtml = replaceLinkHref(nextHtml, "canonical", metadata.canonicalUrl);
  nextHtml = replaceLinkHref(nextHtml, "alternate", metadata.canonicalUrl);
  nextHtml = replaceJsonLdScript(nextHtml, "organization", buildOrganizationSchema());
  nextHtml = replaceJsonLdScript(nextHtml, "webpage", metadata.webpageSchema);
  nextHtml = nextHtml.replace(
    /(<span class="breadcrumbs__current" aria-current="page">)[\s\S]*?(<\/span>)/i,
    `$1${escapeHtml(kit.label || kit.title)}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<p class="kicker" data-kit-eyebrow>)[\s\S]*?(<\/p>)/i,
    `$1${escapeHtml(kit.eyebrow || "Outland Gear Travel Kits")}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<h1 class="hero-subpage__title" data-kit-title>)[\s\S]*?(<\/h1>)/i,
    `$1${escapeHtml(kit.title || "")}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<p class="hero-subpage__lead" data-kit-description>)[\s\S]*?(<\/p>)/i,
    `$1${escapeHtml(kit.description || "")}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<img data-kit-image[^>]*src=")[^"]*(" alt=")[^"]*("[^>]*>)/i,
    `$1${escapeHtml(kit.heroImage || "assets/svg/product-placeholder-01.svg")}$2${escapeHtml(kit.heroAlt || kit.title || "")}$3`,
  );
  nextHtml = nextHtml.replace(
    /(<span class="badge" data-kit-label[^>]*>)[\s\S]*?(<\/span>)/i,
    `$1${escapeHtml(kit.label || "")}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<span class="subtle" data-kit-duration>)[\s\S]*?(<\/span>)/i,
    `$1${escapeHtml(kit.duration || "")}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<div class="kit-detail__meta" data-kit-meta>)[\s\S]*?(<\/div>)/i,
    `$1${(kit.meta || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<h2 data-kit-support-title>)[\s\S]*?(<\/h2>)/i,
    `$1${escapeHtml(kit.supportTitle || "")}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<p class="subtle" data-kit-support-text>)[\s\S]*?(<\/p>)/i,
    `$1${escapeHtml(kit.supportText || "")}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<ul class="kit-detail__highlights" data-kit-highlights>)[\s\S]*?(<\/ul>)/i,
    `$1${renderListItems(kit.highlights || [])}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<p class="subtle" data-kit-products-intro>)[\s\S]*?(<\/p>)/i,
    "$1Kuratorski wybor realnych produktow z katalogu, ktore skladaja sie na ten setup.$2",
  );
  nextHtml = nextHtml.replace(
    /(<div class="grid grid--2 kit-products" data-kit-products>)[\s\S]*?(<\/div>)/i,
    `$1${renderTravelKitCards(matchedProducts)}$2`,
  );
  nextHtml = nextHtml.replace(
    /(<a\s+class="btn"\s+href=")[^"]*("\s+data-kit-primary-cta\s*>)[\s\S]*?(<\/a\s*>)/i,
    `$1${escapeHtml(primaryHref)}$2${escapeHtml(kit.ctaLabel || "Przejdz do katalogu")}$3`,
  );
  nextHtml = nextHtml.replace(
    /(<a\s+class="btn btn--ghost"\s+href=")[^"]*("\s+data-kit-secondary-cta\s*>)[\s\S]*?(<\/a\s*>)/i,
    `$1${escapeHtml(kit.secondaryCtaHref || "index.html#travel-kits")}$2${escapeHtml(kit.secondaryCtaLabel || "Wroc do zestawow")}$3`,
  );
  nextHtml = removeHiddenAttributeFromElement(
    nextHtml,
    /<div class="kit-detail product-layout" data-kit-content hidden>/i,
  );
  nextHtml = removeHiddenAttributeFromElement(
    nextHtml,
    /<span class="badge" data-kit-label hidden>/i,
  );

  return nextHtml;
};

const buildCss = async () => {
  const [{ default: postcss }, { default: postcssImport }, { default: cssnano }] =
    await Promise.all([import("postcss"), import("postcss-import"), import("cssnano")]);
  const cssSourcePath = path.join(ROOT, "css/main.css");
  const cssSource = await fs.readFile(cssSourcePath, "utf8");
  const result = await postcss([postcssImport(), cssnano()]).process(cssSource, {
    from: cssSourcePath,
    to: path.join(DIST_CSS, "main.min.css"),
  });

  await ensureDir(DIST_CSS);
  await fs.writeFile(path.join(DIST_CSS, "main.min.css"), result.css, "utf8");
};

const buildJs = async () => {
  const esbuild = await import("esbuild");
  await ensureDir(DIST_JS);
  await esbuild.build({
    entryPoints: [path.join(ROOT, "js/app.js")],
    outfile: path.join(DIST_JS, "app.min.js"),
    bundle: true,
    minify: true,
    format: "esm",
    target: ["es2020"],
  });
};

const copyStaticAssets = async () => {
  await Promise.all(
    STATIC_DIRS.map(async (dirName) => {
      await fs.cp(path.join(ROOT, dirName), path.join(DIST, dirName), {
        recursive: true,
        filter: shouldCopyAssetPath,
      });
    }),
  );
};

const generateSeoFiles = async (targetDir, sitemapContext = {}) => {
  await Promise.all([
    writeTextToDir(targetDir, "robots.txt", buildRobotsTxt()),
    writeTextToDir(targetDir, "sitemap.xml", buildSitemapXml(sitemapContext)),
  ]);
};

const buildRootHtml = async () => {
  const rootEntries = await fs.readdir(ROOT, { withFileTypes: true });
  const htmlFiles = rootEntries
    .filter((entry) => entry.isFile() && HTML_ENTRY_GLOB.test(entry.name))
    .map((entry) => entry.name);

  await Promise.all(
    htmlFiles.map(async (fileName) => {
      const html = await createDistHtml(fileName);
      await writeDistHtml(fileName, html);
    }),
  );
};

const buildPrerenderedDetailPages = async (products = [], travelKits = []) => {
  await Promise.all([
    ...products.map(async (product) => {
      const html = await createDistHtml(PRODUCT_TEMPLATE, (sourceHtml) =>
        applyProductPrerender(sourceHtml, product),
      );
      await writeDistHtml(path.join("produkt", product.slug, "index.html"), html);
    }),
    ...travelKits.map(async (kit) => {
      const html = await createDistHtml(TRAVEL_KIT_TEMPLATE, (sourceHtml) =>
        applyTravelKitPrerender(sourceHtml, kit, products),
      );
      await writeDistHtml(path.join("komplety", kit.slug, "index.html"), html);
    }),
  ]);
};

const prepareDist = async () => {
  await ensureDir(DIST);
  await ensureDir(DIST_CSS);
  await ensureDir(DIST_JS);
};

const buildDist = async () => {
  const [products, travelKits] = await Promise.all([
    readJson("data/products.json"),
    readJson("data/travel-kits.json"),
  ]);
  const sitemapContext = { products, travelKits };

  await emptyDir(DIST);
  await prepareDist();
  await generateSeoFiles(ROOT, sitemapContext);
  await Promise.all([
    buildCss(),
    buildJs(),
    copyStaticAssets(),
    buildRootHtml(),
    buildPrerenderedDetailPages(products, travelKits),
    generateSeoFiles(DIST, sitemapContext),
  ]);
};

// Only dispatch a command when this file is executed directly. Importing it
// (as the build-transform tests do) must not run a build or throw on the test
// runner's own argv.
const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  switch (command) {
    case "clean":
      await fs.rm(DIST, { recursive: true, force: true });
      break;
    case "prepare":
      await prepareDist();
      break;
    case "css":
      await prepareDist();
      await buildCss();
      break;
    case "js":
      await prepareDist();
      await buildJs();
      break;
    case "html":
      await prepareDist();
      {
        const [products, travelKits] = await Promise.all([
          readJson("data/products.json"),
          readJson("data/travel-kits.json"),
        ]);
        await buildRootHtml();
        await buildPrerenderedDetailPages(products, travelKits);
      }
      break;
    case "assets":
      await prepareDist();
      {
        const [products, travelKits] = await Promise.all([
          readJson("data/products.json"),
          readJson("data/travel-kits.json"),
        ]);
        const sitemapContext = { products, travelKits };
        await generateSeoFiles(ROOT, sitemapContext);
        await Promise.all([copyStaticAssets(), generateSeoFiles(DIST, sitemapContext)]);
      }
      break;
    case "seo":
      {
        const [products, travelKits] = await Promise.all([
          readJson("data/products.json"),
          readJson("data/travel-kits.json"),
        ]);
        const sitemapContext = { products, travelKits };
        await generateSeoFiles(ROOT, sitemapContext);
        await generateSeoFiles(DIST, sitemapContext);
      }
      break;
    case "images":
      throw new Error(
        "build-dist images command has been removed; use `npm run build:images`.",
      );
    case "build":
      await buildDist();
      break;
    default:
      throw new Error(`Unknown build-dist command: ${command}`);
  }
}
