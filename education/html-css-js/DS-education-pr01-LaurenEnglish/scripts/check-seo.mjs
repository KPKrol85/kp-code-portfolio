import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  INDEXABLE_PAGES,
  SITE,
  UTILITY_PAGES,
  absoluteUrl,
  renderRedirects,
  renderRobots,
  renderSitemap,
} from "./site-config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED_SCHEMA_TYPES = new Set(["WebSite", "WebPage"]);
const DISALLOWED_SCHEMA_TYPES = new Set([
  "LocalBusiness",
  "Organization",
  "Person",
  "Offer",
  "Product",
  "AggregateRating",
  "Review",
]);
const DISALLOWED_SCHEMA_FIELDS = new Set([
  "address",
  "telephone",
  "email",
  "openingHours",
  "priceRange",
  "sameAs",
  "aggregateRating",
  "review",
  "offers",
  "founder",
  "employee",
]);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const getTags = (html, name) =>
  html.match(new RegExp(`<${name}\\b[^>]*>`, "giu")) ?? [];

const getAttribute = (tag, name) =>
  tag.match(new RegExp(`\\s${name}="([^"]*)"`, "iu"))?.[1] ?? null;

const getMetaContents = (html, attribute, value) =>
  getTags(html, "meta")
    .filter((tag) => getAttribute(tag, attribute) === value)
    .map((tag) => getAttribute(tag, "content"));

const getCanonicalHrefs = (html) =>
  getTags(html, "link")
    .filter((tag) => getAttribute(tag, "rel") === "canonical")
    .map((tag) => getAttribute(tag, "href"));

const getTitles = (html) =>
  [...html.matchAll(/<title>([^<]+)<\/title>/giu)].map((match) => match[1]);

const getJsonLd = (html) =>
  [
    ...html.matchAll(
      /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/giu,
    ),
  ].map((match) => match[1].trim());

const assertSingleValue = (values, expected, label) => {
  assert(values.length === 1, `${label}: expected exactly one value`);
  assert(values[0] === expected, `${label}: expected ${expected}`);
};

const assertAbsoluteHttps = (value, label) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label}: URL is not absolute`);
  }
  assert(url.protocol === "https:", `${label}: URL must use HTTPS`);
};

const visitSchema = (value, path = "jsonLd") => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitSchema(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    assert(
      !DISALLOWED_SCHEMA_FIELDS.has(key),
      `${path}.${key}: unsupported structured-data field`,
    );
    visitSchema(child, `${path}.${key}`);
  }
};

const titles = new Set();
const descriptions = new Set();
const EXPECTED_SOCIAL_IMAGE_PATH = "/assets/og/og.png";

assert(
  SITE.socialImage.path === EXPECTED_SOCIAL_IMAGE_PATH,
  `Social-preview image must use ${EXPECTED_SOCIAL_IMAGE_PATH}`,
);
assertAbsoluteHttps(absoluteUrl(SITE.socialImage.path), "Social-preview image");

for (const page of INDEXABLE_PAGES) {
  const html = await readFile(resolve(ROOT, page.file), "utf8");
  const canonical = absoluteUrl(page.path);
  const imageUrl = absoluteUrl(SITE.socialImage.path);

  assertSingleValue(getTitles(html), page.title, `${page.file} title`);
  assertSingleValue(
    getMetaContents(html, "name", "description"),
    page.description,
    `${page.file} description`,
  );
  assertSingleValue(
    getCanonicalHrefs(html),
    canonical,
    `${page.file} canonical`,
  );
  assertAbsoluteHttps(canonical, `${page.file} canonical`);

  const requiredOpenGraph = new Map([
    ["og:title", page.title],
    ["og:description", page.description],
    ["og:type", "website"],
    ["og:site_name", SITE.name],
    ["og:locale", SITE.locale],
    ["og:url", canonical],
    ["og:image", imageUrl],
    ["og:image:secure_url", imageUrl],
    ["og:image:type", SITE.socialImage.type],
    ["og:image:width", String(SITE.socialImage.width)],
    ["og:image:height", String(SITE.socialImage.height)],
    ["og:image:alt", SITE.socialImage.alt],
  ]);
  for (const [property, expected] of requiredOpenGraph) {
    assertSingleValue(
      getMetaContents(html, "property", property),
      expected,
      `${page.file} ${property}`,
    );
  }

  const requiredTwitter = new Map([
    ["twitter:card", "summary_large_image"],
    ["twitter:title", page.title],
    ["twitter:description", page.description],
    ["twitter:image", imageUrl],
    ["twitter:image:alt", SITE.socialImage.alt],
  ]);
  for (const [name, expected] of requiredTwitter) {
    assertSingleValue(
      getMetaContents(html, "name", name),
      expected,
      `${page.file} ${name}`,
    );
  }

  const scripts = getJsonLd(html);
  assert(scripts.length === 1, `${page.file}: expected one JSON-LD block`);
  let structuredData;
  try {
    structuredData = JSON.parse(scripts[0]);
  } catch (error) {
    throw new Error(`${page.file}: invalid JSON-LD (${error.message})`);
  }

  assert(
    ALLOWED_SCHEMA_TYPES.has(structuredData["@type"]),
    `${page.file}: unsupported JSON-LD type ${structuredData["@type"]}`,
  );
  assert(
    !DISALLOWED_SCHEMA_TYPES.has(structuredData["@type"]),
    `${page.file}: disallowed JSON-LD type ${structuredData["@type"]}`,
  );
  assert(
    structuredData["@type"] === page.schemaType,
    `${page.file}: unexpected JSON-LD type`,
  );
  assert(
    structuredData.url === canonical,
    `${page.file}: JSON-LD URL mismatch`,
  );
  const expectedSchemaName =
    page.schemaType === "WebSite" ? SITE.name : page.title;
  assert(
    structuredData.name === expectedSchemaName &&
      structuredData.description === page.description,
    `${page.file}: JSON-LD content mismatch`,
  );
  assert(
    structuredData.inLanguage === SITE.language,
    `${page.file}: JSON-LD language mismatch`,
  );
  assertAbsoluteHttps(structuredData["@id"], `${page.file} JSON-LD @id`);
  visitSchema(structuredData);

  assert(!titles.has(page.title), `${page.file}: duplicate primary-page title`);
  assert(
    !descriptions.has(page.description),
    `${page.file}: duplicate primary-page description`,
  );
  titles.add(page.title);
  descriptions.add(page.description);
}

for (const page of UTILITY_PAGES) {
  const html = await readFile(resolve(ROOT, page.file), "utf8");
  assertSingleValue(getTitles(html), page.title, `${page.file} title`);
  assertSingleValue(
    getMetaContents(html, "name", "robots"),
    "noindex, nofollow",
    `${page.file} robots`,
  );
  assert(
    getCanonicalHrefs(html).length === 0,
    `${page.file}: utility page must not expose a canonical`,
  );
  assert(
    getTags(html, "meta").every(
      (tag) =>
        !getAttribute(tag, "property")?.startsWith("og:") &&
        !getAttribute(tag, "name")?.startsWith("twitter:"),
    ),
    `${page.file}: utility page exposes social-preview metadata`,
  );
  assert(
    getJsonLd(html).length === 0,
    `${page.file}: utility page exposes structured data`,
  );
}

const socialImage = await readFile(
  resolve(ROOT, SITE.socialImage.path.replace(/^\//u, "")),
);
assert(
  socialImage.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
  "Social-preview image is not a PNG",
);
assert(
  socialImage.readUInt32BE(16) === SITE.socialImage.width &&
    socialImage.readUInt32BE(20) === SITE.socialImage.height,
  "Social-preview image dimensions do not match metadata",
);

const sitemap = await readFile(resolve(ROOT, "sitemap.xml"), "utf8");
assert(sitemap === renderSitemap(), "sitemap.xml is stale");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
  (match) => match[1],
);
const expectedSitemapUrls = INDEXABLE_PAGES.map((page) =>
  absoluteUrl(page.path),
);
assert(
  JSON.stringify(sitemapUrls) === JSON.stringify(expectedSitemapUrls),
  "sitemap.xml does not match the indexable route registry",
);
assert(
  new Set(sitemapUrls).size === sitemapUrls.length,
  "sitemap.xml contains duplicate URLs",
);
assert(
  !/<lastmod>/u.test(sitemap),
  "sitemap.xml contains unverified lastmod dates",
);
for (const page of UTILITY_PAGES) {
  assert(
    !sitemapUrls.includes(absoluteUrl(page.path)),
    `${page.file}: utility route must not appear in sitemap.xml`,
  );
}

const robots = await readFile(resolve(ROOT, "robots.txt"), "utf8");
assert(robots === renderRobots(), "robots.txt is stale");
assert(
  robots.match(/^Sitemap:\s+(.+)$/gmu)?.length === 1,
  "robots.txt must contain one Sitemap directive",
);
assert(
  robots.includes(`Sitemap: ${absoluteUrl("/sitemap.xml")}`),
  "robots.txt uses the wrong sitemap origin",
);

const redirects = await readFile(resolve(ROOT, "_redirects"), "utf8");
assert(redirects === renderRedirects(), "_redirects is stale");
assert(
  !/^\/\*\s+\/index\.html\s+200!?\s*$/gmu.test(redirects),
  "_redirects contains a homepage catch-all rewrite",
);
await readFile(resolve(ROOT, "404.html"));

console.log(
  `Verified SEO policy for ${INDEXABLE_PAGES.length} indexable pages and ${UTILITY_PAGES.length} noindex utility pages: metadata, raster social image, JSON-LD, sitemap, robots, and 404 routing are consistent.`,
);
