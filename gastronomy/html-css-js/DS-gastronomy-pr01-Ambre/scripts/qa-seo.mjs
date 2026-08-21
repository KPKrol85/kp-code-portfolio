import fs from "fs";
import path from "path";

const root = process.cwd();
const pages = [
  "index.html",
  "menu.html",
  "galeria.html",
  "cookies.html",
  "polityka-prywatnosci.html",
  "regulamin.html",
  "404.html",
  "offline.html"
];

const errors = [];

const buildLineStarts = (text) => {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
};

const getLineNumber = (lineStarts, index) => {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) {
      if (mid === lineStarts.length - 1 || lineStarts[mid + 1] > index) {
        return mid + 1;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return 1;
};

const addError = (file, line, message) => {
  errors.push({ file, line, message });
};

const parseAttributes = (rawAttrs) => {
  const attrs = new Map();
  const attrRegex = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;

  while ((match = attrRegex.exec(rawAttrs))) {
    const key = match[1].toLowerCase();
    const value = match[3] || match[4] || match[5] || "";
    attrs.set(key, value.trim());
  }

  return attrs;
};

const normalizeComparableUrl = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.hash = "";
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return `${url.protocol}//${url.host}${url.pathname}${url.search}`;
  } catch {
    const hashIndex = trimmed.indexOf("#");
    const withoutHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;

    const queryIndex = withoutHash.indexOf("?");
    const basePart = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
    const queryPart = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";

    let normalizedBase = basePart;
    if (normalizedBase.length > 1 && normalizedBase.endsWith("/")) {
      normalizedBase = normalizedBase.slice(0, -1);
    }

    return `${normalizedBase}${queryPart}`;
  }
};

const collectTags = (html, tagName) => {
  const matches = [];
  const regex = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  let match;

  while ((match = regex.exec(html))) {
    matches.push({ index: match.index, attrs: parseAttributes(match[1] || "") });
  }

  return matches;
};

const checkCanonical = (filePath, lineStarts, html) => {
  const linkTags = collectTags(html, "link");
  const canonicalTags = linkTags.filter(({ attrs }) => {
    const rel = attrs.get("rel") || "";
    return rel
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .includes("canonical");
  });

  if (canonicalTags.length !== 1) {
    addError(filePath, 1, `Expected exactly one canonical link, found ${canonicalTags.length}`);
    return null;
  }

  const canonicalHref = (canonicalTags[0].attrs.get("href") || "").trim();
  const line = getLineNumber(lineStarts, canonicalTags[0].index);
  if (!canonicalHref) {
    addError(filePath, line, "Canonical link href is empty");
  }

  return { value: canonicalHref, line };
};

const checkOgUrl = (filePath, lineStarts, html, canonicalValue) => {
  const metaTags = collectTags(html, "meta");
  const ogUrlTags = metaTags.filter(({ attrs }) => (attrs.get("property") || "").toLowerCase() === "og:url");

  if (ogUrlTags.length !== 1) {
    addError(filePath, 1, `Expected exactly one og:url meta tag, found ${ogUrlTags.length}`);
    return;
  }

  const ogUrlValue = (ogUrlTags[0].attrs.get("content") || "").trim();
  const line = getLineNumber(lineStarts, ogUrlTags[0].index);
  if (!ogUrlValue) {
    addError(filePath, line, "og:url content is empty");
    return;
  }

  if (canonicalValue) {
    const normalizedCanonical = normalizeComparableUrl(canonicalValue);
    const normalizedOgUrl = normalizeComparableUrl(ogUrlValue);
    if (normalizedCanonical !== normalizedOgUrl) {
      addError(
        filePath,
        line,
        `og:url does not match canonical (canonical: "${canonicalValue}", og:url: "${ogUrlValue}")`
      );
    }
  }
};

const checkOgImage = (filePath, lineStarts, html) => {
  const metaTags = collectTags(html, "meta");
  const ogImageTag = metaTags.find(({ attrs }) => (attrs.get("property") || "").toLowerCase() === "og:image");

  if (!ogImageTag) {
    addError(filePath, 1, "Missing og:image meta tag");
    return;
  }

  const line = getLineNumber(lineStarts, ogImageTag.index);
  const ogImageValue = (ogImageTag.attrs.get("content") || "").trim();
  if (!ogImageValue) {
    addError(filePath, line, "og:image content is empty");
    return;
  }

  if (ogImageValue.startsWith("/")) {
    const imagePath = path.resolve(root, `.${ogImageValue}`);
    if (!imagePath.startsWith(root)) {
      addError(filePath, line, `og:image path resolves outside project root: "${ogImageValue}"`);
      return;
    }

    if (!fs.existsSync(imagePath)) {
      addError(filePath, line, `og:image local file not found: "${ogImageValue}"`);
    }
    return;
  }

  if (!/^https:\/\//i.test(ogImageValue)) {
    addError(filePath, line, `og:image must be root-absolute or https URL: "${ogImageValue}"`);
  }
};

const normalizeTypes = (value) => {
  if (typeof value === "string") {
    return value.trim() ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === "string" && entry.trim());
  }

  return [];
};

const checkJsonLd = (filePath, lineStarts, html) => {
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html))) {
    const attrs = parseAttributes(match[1] || "");
    const typeValue = (attrs.get("type") || "").toLowerCase();
    if (typeValue !== "application/ld+json") continue;

    const line = getLineNumber(lineStarts, match.index);
    const rawJson = (match[2] || "").trim();
    if (!rawJson) {
      addError(filePath, line, "JSON-LD script block is empty");
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON";
      addError(filePath, line, `Invalid JSON-LD: ${message}`);
      continue;
    }

    if (!parsed || (typeof parsed !== "object" && !Array.isArray(parsed))) {
      addError(filePath, line, "JSON-LD must parse to an object or array");
      continue;
    }

    const entries = Array.isArray(parsed) ? parsed : [parsed];
    entries.forEach((entry, idx) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        addError(filePath, line, `JSON-LD entry ${idx + 1} must be an object`);
        return;
      }

      const context = entry["@context"];
      if (typeof context !== "string" || !context.trim()) {
        addError(filePath, line, `JSON-LD entry ${idx + 1} missing non-empty @context`);
      }

      const graph = entry["@graph"];
      if (Array.isArray(graph) && graph.length > 0) {
        graph.forEach((graphEntry, graphIdx) => {
          if (!graphEntry || typeof graphEntry !== "object" || Array.isArray(graphEntry)) {
            addError(filePath, line, `JSON-LD @graph entry ${graphIdx + 1} must be an object`);
            return;
          }

          const graphTypes = normalizeTypes(graphEntry["@type"]);
          if (!graphTypes.length) {
            addError(filePath, line, `JSON-LD @graph entry ${graphIdx + 1} missing non-empty @type`);
          }
        });
        return;
      }

      const types = normalizeTypes(entry["@type"]);
      if (!types.length) {
        addError(filePath, line, `JSON-LD entry ${idx + 1} missing non-empty @type`);
      }
    });
  }
};

for (const page of pages) {
  const filePath = path.resolve(root, page);
  if (!fs.existsSync(filePath)) {
    addError(filePath, 1, `Missing page file "${page}"`);
    continue;
  }

  const html = fs.readFileSync(filePath, "utf8");
  const lineStarts = buildLineStarts(html);

  const canonical = checkCanonical(filePath, lineStarts, html);
  checkOgUrl(filePath, lineStarts, html, canonical?.value || "");
  checkOgImage(filePath, lineStarts, html);
  checkJsonLd(filePath, lineStarts, html);
}

if (errors.length) {
  console.log("QA SEO: FAIL");
  errors.forEach((error) => {
    console.log(`${error.file}:${error.line} ${error.message}`);
  });
  console.log(`Total SEO errors: ${errors.length}`);
  process.exit(1);
}

console.log("QA SEO: PASS");
process.exit(0);
