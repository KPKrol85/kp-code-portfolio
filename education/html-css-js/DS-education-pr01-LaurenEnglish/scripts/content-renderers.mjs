import {
  getMaterialPresentation,
  resolveMaterialAction,
} from "../js/data/materialAccess.js";
import { filterMaterials } from "../js/data/materialFilters.js";
import { materials } from "../js/data/materials.js";
import {
  PACKAGE_KEYS,
  packageList,
  packages,
  packagesPageHref,
  packagesSectionHref,
} from "../js/data/packages.js";

const createMarkers = (name) =>
  Object.freeze({
    start: `            <!-- ${name}:start -->`,
    end: `            <!-- ${name}:end -->`,
  });

export const CONTENT_MARKERS = Object.freeze({
  homePackages: createMarkers("package-cards:home"),
  homePackagesLink: createMarkers("package-link:home"),
  packagePage: createMarkers("package-cards:page"),
  homeMaterials: createMarkers("materials-home"),
  materialsCatalog: createMarkers("materials-catalog"),
});

const HOME_MATERIAL_CATEGORIES = Object.freeze([
  "grammar",
  "vocabulary",
  "exam",
  "business",
]);

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const wrapRegion = (markers, content) =>
  `${markers.start}\n${content}\n${markers.end}`;

const renderBenefits = (benefits) =>
  benefits
    .map((benefit) => `                <li>${escapeHtml(benefit)}</li>`)
    .join("\n");

const renderPackagePrice = (packageRecord) =>
  packageRecord.priceLabel
    ? `\n              <p class="card__price">${escapeHtml(packageRecord.priceLabel)}</p>`
    : "";

const renderPackageLabel = (packageRecord) =>
  `\n              <p class="card__eyebrow pricing__package-label">${escapeHtml(packageRecord.comparisonLabel)}</p>`;

const getPackageCardClass = (packageRecord) =>
  `card card--pricing pricing__card${packageRecord.isHighlighted ? " card--highlight pricing__card--highlighted" : ""}`;

const getPackageButtonClass = (packageRecord) =>
  packageRecord.isHighlighted ? "button--primary" : "button--secondary";

const renderHomePackageCard = (packageRecord) =>
  `            <article class="card card--pricing card--highlight pricing__package" data-package-key="${escapeHtml(packageRecord.key)}" data-reveal>
              <h3 class="card__title">Pakiet ${escapeHtml(packageRecord.label)}</h3>
              <p class="card__text">${escapeHtml(packageRecord.homeTeaser.description)}</p>
              <ul class="list pricing__package-list" role="list">
${renderBenefits(packageRecord.homeTeaser.benefits)}
              </ul>
            </article>`;

const renderFullPackageCard = (packageRecord) =>
  `            <article class="${getPackageCardClass(packageRecord)} u-anchor-offset" id="pakiet-${escapeHtml(packageRecord.key)}" data-package-key="${escapeHtml(packageRecord.key)}" tabindex="-1" data-reveal>${renderPackageLabel(packageRecord)}
              <h3 class="card__title pricing__package-name">${escapeHtml(packageRecord.label)}</h3>${renderPackagePrice(packageRecord)}
              <p class="card__text pricing__package-rhythm">${escapeHtml(packageRecord.summary)}</p>
              <p class="card__text pricing__package-audience">${escapeHtml(packageRecord.audience)}</p>
              <ul class="pricing__benefits" role="list">
${renderBenefits(packageRecord.benefits)}
              </ul>
              <a class="button ${getPackageButtonClass(packageRecord)}" href="${escapeHtml(packageRecord.cta.href)}">${escapeHtml(packageRecord.cta.label)}</a>
            </article>`;

export const renderHomePackageCards = () =>
  wrapRegion(
    CONTENT_MARKERS.homePackages,
    renderHomePackageCard(packages.regular),
  );

export const renderHomePackagesLink = () =>
  wrapRegion(
    CONTENT_MARKERS.homePackagesLink,
    `            <a class="button button--secondary" href="${escapeHtml(packagesPageHref)}">Porównaj wszystkie pakiety</a>`,
  );

export const renderPackagePageCards = () =>
  wrapRegion(
    CONTENT_MARKERS.packagePage,
    packageList.map(renderFullPackageCard).join("\n"),
  );

const renderAccessBadge = (item, presentation) =>
  `<span class="badge badge--access badge--${escapeHtml(item.access)}" aria-label="Dostęp: ${escapeHtml(presentation.accessLabel)}">${escapeHtml(presentation.accessLabel)}</span>`;

const renderMaterialAction = (item, presentation, { summary = false } = {}) => {
  const { action } = presentation;
  if (action.kind !== "link") {
    return `<span class="materials__availability">${escapeHtml(action.label)}</span>`;
  }

  const buttonClass = summary ? "button--ghost" : action.buttonClass;
  const ariaLabel = summary
    ? ` aria-label="${escapeHtml(`${action.label}: ${item.title}`)}"`
    : "";
  return `<a class="button ${escapeHtml(buttonClass)}" href="${escapeHtml(action.href)}"${ariaLabel}>${escapeHtml(action.label)}</a>`;
};

const renderHomeMaterialCard = (item) => {
  const presentation = getMaterialPresentation(item, { surface: "home" });
  const { action } = presentation;
  const actionMarkup =
    action.kind === "link"
      ? `<a class="button button--ghost" href="${escapeHtml(action.href)}" aria-label="${escapeHtml(`${action.label}: ${item.homeTeaser.title}`)}">${escapeHtml(action.label)}</a>`
      : `<span class="materials__availability">${escapeHtml(action.label)}</span>`;

  return `            <article class="card card--resource resources__teaser-card" data-material-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category)}" data-reveal>
              <h3 class="card__title">${escapeHtml(item.homeTeaser.title)}</h3>
              <p class="card__text">${escapeHtml(item.homeTeaser.description)}</p>
              <div class="card__tags">
                <span class="badge">${escapeHtml(presentation.formatLabel)}</span>
                <span class="badge">${escapeHtml(presentation.categoryLabel)}</span>
                <span class="badge badge--access badge--${escapeHtml(item.access)}" aria-label="Dostęp: ${escapeHtml(presentation.accessLabel)}">${escapeHtml(presentation.accessLabel)}</span>
              </div>
              ${actionMarkup}
            </article>`;
};

export const renderHomeMaterialCards = () => {
  const featuredMaterials = materials.filter((item) => item.featured === true);
  return wrapRegion(
    CONTENT_MARKERS.homeMaterials,
    featuredMaterials.map(renderHomeMaterialCard).join("\n"),
  );
};

const renderCatalogMaterialMeta = (item, presentation) => {
  const metadata = [
    presentation.categoryLabel,
    presentation.levelLabel,
    presentation.formatLabel,
    item.duration,
  ].filter(Boolean);

  return `              <ul class="card__tags materials__meta" aria-label="Informacje o materiale">
${metadata.map((label) => `                <li class="badge">${escapeHtml(label)}</li>`).join("\n")}
              </ul>`;
};

const renderCatalogMaterialCard = (item) => {
  const presentation = getMaterialPresentation(item);

  return `            <article class="card card--resource materials__card" data-material-id="${escapeHtml(item.id)}">
              <h3 class="card__title">${escapeHtml(item.title)}</h3>
${renderCatalogMaterialMeta(item, presentation)}
              <p class="card__text">${escapeHtml(item.description)}</p>
              <div class="materials__footer">
                <div class="materials__footer-access">
                  ${renderAccessBadge(item, presentation)}
                </div>
                <div class="materials__footer-action">
                  ${renderMaterialAction(item, presentation)}
                </div>
              </div>
            </article>`;
};

export const renderMaterialsCatalog = () =>
  wrapRegion(
    CONTENT_MARKERS.materialsCatalog,
    materials.map(renderCatalogMaterialCard).join("\n"),
  );

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isUsableHref = (href) =>
  typeof href === "string" && href.trim() !== "" && href.trim() !== "#";

const assertExactCount = (label, actual, expected) => {
  assert(
    actual === expected,
    `${label}: expected ${expected}, received ${actual}`,
  );
};

export const validateContentData = () => {
  assert(
    JSON.stringify(PACKAGE_KEYS) ===
      JSON.stringify(["start", "regular", "intensive"]),
    "Package keys must be start, regular, intensive",
  );
  assert(
    JSON.stringify(Object.keys(packages)) === JSON.stringify(PACKAGE_KEYS),
    "Package records do not match the canonical key order",
  );
  assert(isUsableHref(packagesSectionHref), "Invalid packages section route");
  assert(packagesPageHref === "/pakiety.html", "Invalid packages page route");

  packageList.forEach((packageRecord) => {
    assert(
      packageRecord.key && packages[packageRecord.key] === packageRecord,
      "Invalid package record",
    );
    assert(packageRecord.label, `${packageRecord.key}: missing public label`);
    assert(
      packageRecord.comparisonLabel,
      `${packageRecord.key}: missing comparison label`,
    );
    assert(
      typeof packageRecord.isHighlighted === "boolean",
      `${packageRecord.key}: invalid highlight state`,
    );
    assert(
      packageRecord.href === `/pakiety.html#pakiet-${packageRecord.key}`,
      `${packageRecord.key}: invalid package route`,
    );
    assert(packageRecord.summary, `${packageRecord.key}: missing summary`);
    assert(
      packageRecord.benefits.length > 0,
      `${packageRecord.key}: missing benefits`,
    );
    assert(packageRecord.audience, `${packageRecord.key}: missing audience`);
    assert(
      packageRecord.priceLabel === null ||
        (typeof packageRecord.priceLabel === "string" &&
          packageRecord.priceLabel.trim() !== ""),
      `${packageRecord.key}: invalid price state`,
    );
    assert(packageRecord.cta.label, `${packageRecord.key}: missing CTA label`);
    assert(
      isUsableHref(packageRecord.cta.href),
      `${packageRecord.key}: invalid CTA route`,
    );
  });

  assert(
    JSON.stringify(
      packageList
        .filter((packageRecord) => packageRecord.isHighlighted)
        .map((packageRecord) => packageRecord.key),
    ) === JSON.stringify(["regular"]),
    "Regular must be the only highlighted package",
  );

  assert(
    packages.regular.homeTeaser?.description,
    "regular: missing homepage teaser description",
  );
  assert(
    packages.regular.homeTeaser?.benefits.length > 0,
    "regular: missing homepage teaser benefits",
  );

  const materialIds = materials.map((item) => item.id);
  assert(
    new Set(materialIds).size === materialIds.length,
    "Material IDs must be unique",
  );

  materials.forEach((item) => {
    assert(
      item.id && item.title && item.description,
      "Material content is incomplete",
    );
    assert(
      item.category && item.level && item.format,
      `${item.id}: metadata is incomplete`,
    );
    assert(
      item.access === "free" || item.access === "premium",
      `${item.id}: invalid access type`,
    );
    assert(
      !Object.hasOwn(item, "url"),
      `${item.id}: legacy url field is not allowed`,
    );
    assert(
      !Object.hasOwn(item, "ctaLabel"),
      `${item.id}: legacy ctaLabel field is not allowed`,
    );

    if (item.access === "premium") {
      assert(
        PACKAGE_KEYS.includes(item.packageKey),
        `${item.id}: invalid premium package key`,
      );
      assert(
        item.action.type === "package",
        `${item.id}: premium action must use a package route`,
      );
    }

    const action = resolveMaterialAction(item);
    assert(
      action.isValid,
      `${item.id}: invalid resolved action (${action.reason})`,
    );
    if (action.kind === "link") {
      assert(
        isUsableHref(action.href),
        `${item.id}: invalid operational destination`,
      );
    } else {
      assert(
        action.href === null,
        `${item.id}: informational action must not expose a link`,
      );
    }
  });

  const featuredMaterials = materials.filter((item) => item.featured === true);
  assertExactCount("Featured materials", featuredMaterials.length, 4);
  assert(
    JSON.stringify(featuredMaterials.map((item) => item.category)) ===
      JSON.stringify(HOME_MATERIAL_CATEGORIES),
    "Homepage material categories must match the teaser order",
  );
  featuredMaterials.forEach((item) => {
    assert(
      item.homeTeaser?.title && item.homeTeaser?.description,
      `${item.id}: incomplete homepage teaser`,
    );
  });

  const filterResults = Object.freeze({
    grammar: filterMaterials(materials, { category: "grammar" }).length,
    b2IncludingAll: filterMaterials(materials, { level: "B2" }).length,
    pdf: filterMaterials(materials, { format: "PDF" }).length,
    free: filterMaterials(materials, { access: "free" }).length,
    combined: filterMaterials(materials, {
      category: "speaking",
      level: "B2",
      format: "Video",
      access: "premium",
    }).length,
  });

  assertExactCount("Grammar filter", filterResults.grammar, 3);
  assertExactCount("B2 filter", filterResults.b2IncludingAll, 6);
  assertExactCount("PDF filter", filterResults.pdf, 9);
  assertExactCount("Free access filter", filterResults.free, 6);
  assertExactCount("Combined filter", filterResults.combined, 1);

  const contactAction = resolveMaterialAction({
    access: "free",
    action: { type: "contact", label: "Zapytaj o materiał" },
  });
  assert(
    contactAction.isValid && contactAction.href === "/index.html#contact",
    "Contact route failed",
  );

  const invalidHashAction = resolveMaterialAction({
    access: "free",
    action: { type: "link", label: "Otwórz", href: "#" },
  });
  assert(
    !invalidHashAction.isValid,
    "Hash-only material actions must be rejected",
  );

  return Object.freeze({
    packageKeys: [...PACKAGE_KEYS],
    packageCount: packageList.length,
    materialCount: materials.length,
    freeCount: filterResults.free,
    premiumCount: filterMaterials(materials, { access: "premium" }).length,
    featuredCount: featuredMaterials.length,
    filterResults,
  });
};
