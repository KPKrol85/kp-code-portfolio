import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const APPROVED_ORIGIN = "https://gastronomy-pr01-ambre.netlify.app/";
const OPERATOR_URL = "https://kp-code.pl/";
const WEBSITE_ID = `${APPROVED_ORIGIN}#website`;
const PROJECT_ID = `${APPROVED_ORIGIN}#project`;
const OPERATOR_ID = `${APPROVED_ORIGIN}#operator`;
const PROJECT_IMAGE = `${APPROVED_ORIGIN}assets/img/og-img/og-1200x630.jpg`;
const JSON_LD_TYPE_REGEX = /\btype\s*=\s*(["'])application\/ld\+json\1/i;
const DEMO_STATUS_REGEX = /demonstracyjn/i;
const FICTIONAL_STATUS_REGEX = /fikcyjn/i;

const REQUIRED_JSON_LD_PAGES = new Map([
  ["index.html", APPROVED_ORIGIN],
  ["menu.html", `${APPROVED_ORIGIN}menu.html`],
  ["galeria.html", `${APPROVED_ORIGIN}galeria.html`],
  ["cookies.html", `${APPROVED_ORIGIN}cookies.html`],
  ["polityka-prywatnosci.html", `${APPROVED_ORIGIN}polityka-prywatnosci.html`],
  ["regulamin.html", `${APPROVED_ORIGIN}regulamin.html`]
]);

const FORBIDDEN_JSON_LD_PAGES = ["404.html", "offline.html"];
const EXPECTED_ROOT_TYPES = new Set(["WebSite", "Organization", "CreativeWork", "WebPage"]);
const FORBIDDEN_BUSINESS_TYPES = new Set(["Restaurant", "FoodEstablishment", "LocalBusiness"]);
const FORBIDDEN_OPERATIONAL_PROPERTIES = new Set([
  "acceptsReservations",
  "address",
  "areaServed",
  "contactPoint",
  "currenciesAccepted",
  "email",
  "geo",
  "hasMenu",
  "makesOffer",
  "menu",
  "offers",
  "openingHours",
  "openingHoursSpecification",
  "paymentAccepted",
  "priceRange",
  "servesCuisine",
  "telephone"
]);

const violations = [];

const toPosix = (value) => value.split(path.sep).join("/");

const walkHtmlFiles = (startDir) => {
  const found = [];
  const stack = [startDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
        found.push(toPosix(path.relative(PROJECT_ROOT, fullPath)));
      }
    }
  }

  found.sort((a, b) => a.localeCompare(b));
  return found;
};

const getLineAndColumn = (text, index) => {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const lastBreak = before.lastIndexOf("\n");
  const column = index - lastBreak;
  return { line, column };
};

const findJsonLdOccurrences = (html) => {
  const found = [];
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const openingTagEnd = match[0].indexOf(">");
    const openingTag = match[0].slice(0, openingTagEnd + 1);
    if (!JSON_LD_TYPE_REGEX.test(openingTag)) continue;

    found.push({
      raw: match[1],
      ...getLineAndColumn(html, match.index)
    });
  }

  return found;
};

const addViolation = (file, occurrence, message) => {
  violations.push({
    file,
    line: occurrence?.line ?? 1,
    column: occurrence?.column ?? 1,
    message
  });
};

const getTypes = (node) => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node["@type"])) return node["@type"];
  return typeof node["@type"] === "string" ? [node["@type"]] : [];
};

const getReferenceId = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return typeof value["@id"] === "string" ? value["@id"] : null;
};

const inspectForForbiddenClaims = (value, file, occurrence, state) => {
  if (Array.isArray(value)) {
    for (const item of value) inspectForForbiddenClaims(item, file, occurrence, state);
    return;
  }

  if (!value || typeof value !== "object") {
    if (typeof value === "string" && value.includes("#restaurant") && !state.restaurantId) {
      addViolation(file, occurrence, "JSON-LD must not reference the obsolete fictional restaurant entity");
      state.restaurantId = true;
    }
    return;
  }

  for (const type of getTypes(value)) {
    if (FORBIDDEN_BUSINESS_TYPES.has(type) && !state.businessType) {
      addViolation(file, occurrence, `JSON-LD must not publish fictional business type ${type}`);
      state.businessType = true;
    }
  }

  for (const [property, child] of Object.entries(value)) {
    if (FORBIDDEN_OPERATIONAL_PROPERTIES.has(property) && !state.operationalProperties.has(property)) {
      addViolation(file, occurrence, `JSON-LD must not publish operational property ${property}`);
      state.operationalProperties.add(property);
    }
    inspectForForbiddenClaims(child, file, occurrence, state);
  }
};

const findSingleNode = (nodes, type, file, occurrence) => {
  const matches = nodes.filter((node) => getTypes(node).includes(type));
  if (matches.length !== 1) {
    addViolation(file, occurrence, `JSON-LD graph must contain exactly one ${type} node`);
    return null;
  }
  return matches[0];
};

const requireValue = (node, property, expected, file, occurrence, label) => {
  if (node?.[property] !== expected) {
    addViolation(file, occurrence, `${label}.${property} must equal ${expected}`);
  }
};

const requireReference = (node, property, expected, file, occurrence, label) => {
  if (getReferenceId(node?.[property]) !== expected) {
    addViolation(file, occurrence, `${label}.${property} must reference ${expected}`);
  }
};

const requireText = (node, property, file, occurrence, label) => {
  if (typeof node?.[property] !== "string" || node[property].trim() === "") {
    addViolation(file, occurrence, `${label}.${property} must be non-empty text`);
  }
};

const requireDemoDescription = (node, file, occurrence, label, requireFictionalStatus = false) => {
  const description = node?.description;
  requireText(node, "description", file, occurrence, label);

  if (typeof description === "string" && !DEMO_STATUS_REGEX.test(description)) {
    addViolation(file, occurrence, `${label}.description must disclose the demonstrational status`);
  }

  if (requireFictionalStatus && typeof description === "string" && !FICTIONAL_STATUS_REGEX.test(description)) {
    addViolation(file, occurrence, `${label}.description must disclose the fictional restaurant concept`);
  }
};

const validateCoreGraph = (jsonLd, expectedPageUrl, file, occurrence) => {
  if (!jsonLd || typeof jsonLd !== "object" || Array.isArray(jsonLd)) {
    addViolation(file, occurrence, "core JSON-LD must be an object");
    return;
  }

  if (jsonLd["@context"] !== "https://schema.org") {
    addViolation(file, occurrence, "core JSON-LD must use the https://schema.org context");
  }

  if (!Array.isArray(jsonLd["@graph"])) {
    addViolation(file, occurrence, "core JSON-LD must contain an @graph array");
    return;
  }

  const nodes = jsonLd["@graph"];
  if (nodes.length !== EXPECTED_ROOT_TYPES.size) {
    addViolation(file, occurrence, "core JSON-LD graph must contain the four approved entity nodes");
  }

  for (const node of nodes) {
    for (const type of getTypes(node)) {
      if (!EXPECTED_ROOT_TYPES.has(type)) {
        addViolation(file, occurrence, `core JSON-LD graph contains unsupported root type ${type}`);
      }
    }
  }

  const website = findSingleNode(nodes, "WebSite", file, occurrence);
  const operator = findSingleNode(nodes, "Organization", file, occurrence);
  const project = findSingleNode(nodes, "CreativeWork", file, occurrence);
  const webpage = findSingleNode(nodes, "WebPage", file, occurrence);

  requireValue(website, "@id", WEBSITE_ID, file, occurrence, "WebSite");
  requireValue(website, "url", APPROVED_ORIGIN, file, occurrence, "WebSite");
  requireValue(website, "inLanguage", "pl-PL", file, occurrence, "WebSite");
  requireText(website, "name", file, occurrence, "WebSite");
  requireDemoDescription(website, file, occurrence, "WebSite", true);
  requireReference(website, "publisher", OPERATOR_ID, file, occurrence, "WebSite");
  requireReference(website, "about", PROJECT_ID, file, occurrence, "WebSite");

  requireValue(operator, "@id", OPERATOR_ID, file, occurrence, "Organization");
  requireValue(operator, "name", "KP_Code Digital Studio", file, occurrence, "Organization");
  requireValue(operator, "url", OPERATOR_URL, file, occurrence, "Organization");

  requireValue(project, "@id", PROJECT_ID, file, occurrence, "CreativeWork");
  requireValue(project, "name", "Ambre", file, occurrence, "CreativeWork");
  requireValue(project, "url", APPROVED_ORIGIN, file, occurrence, "CreativeWork");
  requireDemoDescription(project, file, occurrence, "CreativeWork", true);
  requireReference(project, "creator", OPERATOR_ID, file, occurrence, "CreativeWork");

  const images = Array.isArray(project?.image) ? project.image : [project?.image];
  if (!images.includes(PROJECT_IMAGE)) {
    addViolation(file, occurrence, `CreativeWork.image must include ${PROJECT_IMAGE}`);
  }

  requireValue(webpage, "@id", `${expectedPageUrl}#webpage`, file, occurrence, "WebPage");
  requireValue(webpage, "url", expectedPageUrl, file, occurrence, "WebPage");
  requireValue(webpage, "inLanguage", "pl-PL", file, occurrence, "WebPage");
  requireText(webpage, "name", file, occurrence, "WebPage");
  requireDemoDescription(webpage, file, occurrence, "WebPage");
  requireReference(webpage, "isPartOf", WEBSITE_ID, file, occurrence, "WebPage");
  requireReference(webpage, "about", PROJECT_ID, file, occurrence, "WebPage");

  if (webpage?.primaryImageOfPage?.url !== PROJECT_IMAGE) {
    addViolation(file, occurrence, `WebPage.primaryImageOfPage.url must equal ${PROJECT_IMAGE}`);
  }
};

const htmlFiles = walkHtmlFiles(PROJECT_ROOT);
const htmlSet = new Set(htmlFiles);

for (const requiredPage of REQUIRED_JSON_LD_PAGES.keys()) {
  if (!htmlSet.has(requiredPage)) {
    addViolation(requiredPage, null, "required JSON-LD page is missing from repository");
  }
}

for (const forbiddenPage of FORBIDDEN_JSON_LD_PAGES) {
  if (!htmlSet.has(forbiddenPage)) {
    addViolation(forbiddenPage, null, "special page is missing from repository");
  }
}

for (const relativePath of htmlFiles) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  const html = fs.readFileSync(fullPath, "utf8");
  const occurrences = findJsonLdOccurrences(html);
  const expectedPageUrl = REQUIRED_JSON_LD_PAGES.get(relativePath);

  if (FORBIDDEN_JSON_LD_PAGES.includes(relativePath) && occurrences.length > 0) {
    addViolation(
      relativePath,
      occurrences[0],
      'special operational page must not contain type="application/ld+json"'
    );
  }

  if (expectedPageUrl && occurrences.length !== 1) {
    addViolation(relativePath, occurrences[0], "core page must contain exactly one JSON-LD block");
  }

  const parsedOccurrences = [];
  for (const occurrence of occurrences) {
    let parsed;
    try {
      parsed = JSON.parse(occurrence.raw);
    } catch (error) {
      addViolation(relativePath, occurrence, `JSON-LD must be valid JSON: ${error.message}`);
      continue;
    }

    inspectForForbiddenClaims(parsed, relativePath, occurrence, {
      businessType: false,
      operationalProperties: new Set(),
      restaurantId: false
    });
    parsedOccurrences.push({ occurrence, parsed });
  }

  if (expectedPageUrl && occurrences.length === 1 && parsedOccurrences.length === 1) {
    validateCoreGraph(
      parsedOccurrences[0].parsed,
      expectedPageUrl,
      relativePath,
      parsedOccurrences[0].occurrence
    );
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line}:${violation.column}: ${violation.message}`);
  }
  process.exit(1);
}

console.log(`Schema policy check passed (${htmlFiles.length} HTML files scanned).`);
