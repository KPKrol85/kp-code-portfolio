import { CONFIG } from "../config.js";
import { fetchJson } from "./data.js";

export const PRODUCTS_DATA_PATH = "/data/products.json";

const DEFAULT_IMAGE = "assets/svg/product-placeholder-01.svg";
const DEFAULT_STOCK_STATUS = "Brak informacji";

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const toSafeString = (value, fallback = "") =>
  isNonEmptyString(value) ? value.trim() : fallback;

const toFiniteNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toStringList = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toSafeString(item)).filter(Boolean);
};

const normalizeSpecs = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((acc, [key, val]) => {
    const safeKey = toSafeString(key);
    const safeVal = toSafeString(val);
    if (safeKey && safeVal) acc[safeKey] = safeVal;
    return acc;
  }, {});
};

const createCategoryMap = (categories) => {
  if (!Array.isArray(categories)) return new Map();
  return categories.reduce((map, category) => {
    const name = toSafeString(category?.name);
    const subcategories = toStringList(category?.subcategories);
    if (name) {
      map.set(name, new Set(subcategories));
    }
    return map;
  }, new Map());
};

const validateProductCore = (product) => {
  const id = toFiniteNumber(product?.id, NaN);
  const name = toSafeString(product?.name);
  const slug = toSafeString(product?.slug);
  const price = toFiniteNumber(product?.price, NaN);

  const errors = [];
  if (!Number.isInteger(id) || id <= 0) errors.push("missing/invalid id");
  if (!name) errors.push("missing name");
  if (!slug) errors.push("missing slug");
  if (!Number.isFinite(price) || price < 0) errors.push("missing/invalid price");

  return { id, name, slug, price, errors };
};

const normalizeProduct = (product, categoryMap, seenIds, seenSlugs) => {
  const { id, name, slug, price, errors } = validateProductCore(product);
  if (seenIds.has(id)) errors.push("duplicate id");
  if (seenSlugs.has(slug)) errors.push("duplicate slug");

  if (errors.length) {
    return { product: null, issues: errors };
  }

  const images = toStringList(product.images);
  const safeImages = images.length ? images : [DEFAULT_IMAGE];

  const category = toSafeString(product.category, "Bez kategorii");
  const subcategory = toSafeString(product.subcategory, "Pozostałe");
  const imageAlt = toSafeString(product.imageAlt);

  if (categoryMap.size) {
    const categorySubcategories = categoryMap.get(category);
    if (!categorySubcategories) {
      errors.push(`category "${category}" not found in categories.json`);
    } else if (subcategory && !categorySubcategories.has(subcategory)) {
      errors.push(`subcategory "${subcategory}" not found for category "${category}"`);
    }
  }

  const normalized = {
    id,
    name,
    slug,
    category,
    subcategory,
    price,
    currency: toSafeString(product.currency, CONFIG.currency),
    oldPrice: Number.isFinite(Number(product.oldPrice)) ? Number(product.oldPrice) : null,
    rating: Math.max(0, toFiniteNumber(product.rating, 0)),
    reviewsCount: Math.max(0, Math.trunc(toFiniteNumber(product.reviewsCount, 0))),
    badges: toStringList(product.badges),
    shortDescription: toSafeString(product.shortDescription, "Brak opisu produktu."),
    highlights: toStringList(product.highlights),
    specs: normalizeSpecs(product.specs),
    stockStatus: toSafeString(product.stockStatus, DEFAULT_STOCK_STATUS),
    images: safeImages,
    ...(imageAlt ? { imageAlt } : {}),
  };

  seenIds.add(id);
  seenSlugs.add(slug);
  return { product: normalized, issues: errors };
};

const reportValidation = (issues) => {
  if (!issues.length) return;
  issues.forEach(({ index, summary, details }) => {
    console.warn(`[data-validation] Product at index ${index} ${summary}.`, details);
  });
  console.warn(
    `[data-validation] Loaded ${issues.length} malformed product record(s). Invalid records were skipped when unsafe.`,
  );
};

let normalizedProductsPromise;

export const loadNormalizedProducts = async () => {
  if (normalizedProductsPromise) return normalizedProductsPromise;

  normalizedProductsPromise = (async () => {
    const loadCategories = async () => {
      try {
        const categories = await fetchJson("/data/categories.json");
        return Array.isArray(categories) ? categories : [];
      } catch {
        return [];
      }
    };

    const [rawProducts, rawCategories] = await Promise.all([
      fetchJson(PRODUCTS_DATA_PATH),
      loadCategories(),
    ]);

    if (!Array.isArray(rawProducts)) {
      throw new Error("Products payload must be an array.");
    }

    const categoryMap = createCategoryMap(rawCategories);
    const seenIds = new Set();
    const seenSlugs = new Set();
    const issues = [];

    const normalized = (Array.isArray(rawProducts) ? rawProducts : [])
      .map((entry, index) => {
        const { product, issues: itemIssues } = normalizeProduct(
          entry,
          categoryMap,
          seenIds,
          seenSlugs,
        );
        if (itemIssues.length) {
          issues.push({
            index,
            summary: product ? "has recoverable issues" : "is invalid",
            details: itemIssues,
          });
        }
        return product;
      })
      .filter(Boolean);

    reportValidation(issues);
    return normalized;
  })();

  return normalizedProductsPromise;
};

export const findProductById = (products, id) => {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return null;
  return products.find((item) => item.id === numericId) || null;
};

export const findProductBySlug = (products, slug) => {
  const safeSlug = toSafeString(slug);
  if (!safeSlug) return null;
  return products.find((item) => item.slug === safeSlug) || null;
};
