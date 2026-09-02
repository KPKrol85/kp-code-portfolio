const SEO_ORIGIN = "https://e-commerce-pr02-outlandgear.netlify.app";

const INDEXABLE_PAGE_PATHS = [
  "/",
  "/kategoria.html",
  "/o-nas.html",
  "/kontakt.html",
  "/cookies.html",
  "/regulamin.html",
  "/polityka-prywatnosci.html",
  "/faq.html",
];

const NON_INDEXABLE_PAGE_PATHS = [
  "/produkt.html",
  "/komplety.html",
  "/checkout.html",
  "/checkout-potwierdzenie.html",
  "/kontakt-wyslano.html",
  "/koszyk.html",
];

const resolveSeoUrl = (pathname) => new URL(pathname, `${SEO_ORIGIN}/`).toString();

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const normalizeSlug = (value) => (isNonEmptyString(value) ? value.trim() : "");

const buildProductPath = (slug) => `/produkt/${encodeURIComponent(slug)}/`;

const buildTravelKitPath = (slug) => `/komplety/${encodeURIComponent(slug)}/`;

const collectSlugPaths = (items, buildPath) => {
  const safeItems = Array.isArray(items) ? items : [];
  return safeItems
    .map((item) => normalizeSlug(item?.slug))
    .filter(Boolean)
    .map((slug) => buildPath(slug));
};

const buildRobotsTxt = () =>
  ["User-agent: *", "Allow: /", `Sitemap: ${resolveSeoUrl("/sitemap.xml")}`].join("\n") +
  "\n";

const buildSitemapXml = ({ products = [], travelKits = [] } = {}) => {
  const uniquePaths = Array.from(
    new Set([
      ...INDEXABLE_PAGE_PATHS,
      ...collectSlugPaths(products, buildProductPath),
      ...collectSlugPaths(travelKits, buildTravelKitPath),
    ]),
  );

  const urls = uniquePaths
    .map((pathname) => `  <url>\n    <loc>${resolveSeoUrl(pathname)}</loc>\n  </url>`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
};

export {
  INDEXABLE_PAGE_PATHS,
  NON_INDEXABLE_PAGE_PATHS,
  SEO_ORIGIN,
  buildProductPath,
  buildRobotsTxt,
  buildSitemapXml,
  buildTravelKitPath,
  resolveSeoUrl,
};
