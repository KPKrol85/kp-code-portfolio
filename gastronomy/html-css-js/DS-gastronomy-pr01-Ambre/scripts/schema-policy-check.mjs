import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const JSON_LD_TYPE_REGEX = /\btype\s*=\s*(["'])application\/ld\+json\1/i;

const REQUIRED_JSON_LD_PAGES = [
  "index.html",
  "menu.html",
  "galeria.html",
  "cookies.html",
  "polityka-prywatnosci.html",
  "regulamin.html"
];

const FORBIDDEN_JSON_LD_PAGES = ["404.html", "offline.html"];

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

const findJsonLdOccurrence = (html) => {
  const scriptRegex = /<script\b[^>]*>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    if (!JSON_LD_TYPE_REGEX.test(match[0])) continue;

    const location = getLineAndColumn(html, match.index);
    return { index: match.index, ...location };
  }

  return null;
};

const violations = [];
const htmlFiles = walkHtmlFiles(PROJECT_ROOT);
const htmlSet = new Set(htmlFiles);

for (const requiredPage of REQUIRED_JSON_LD_PAGES) {
  if (!htmlSet.has(requiredPage)) {
    violations.push({
      file: requiredPage,
      line: 1,
      column: 1,
      message: "required JSON-LD page is missing from repository"
    });
  }
}

for (const forbiddenPage of FORBIDDEN_JSON_LD_PAGES) {
  if (!htmlSet.has(forbiddenPage)) {
    violations.push({
      file: forbiddenPage,
      line: 1,
      column: 1,
      message: "special page is missing from repository"
    });
  }
}

for (const relativePath of htmlFiles) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  const html = fs.readFileSync(fullPath, "utf8");
  const jsonLdOccurrence = findJsonLdOccurrence(html);
  const hasJsonLd = Boolean(jsonLdOccurrence);

  if (FORBIDDEN_JSON_LD_PAGES.includes(relativePath) && hasJsonLd) {
    violations.push({
      file: relativePath,
      line: jsonLdOccurrence.line,
      column: jsonLdOccurrence.column,
      message: 'special operational page must not contain type="application/ld+json"'
    });
  }

  if (REQUIRED_JSON_LD_PAGES.includes(relativePath) && !hasJsonLd) {
    violations.push({
      file: relativePath,
      line: 1,
      column: 1,
      message: 'core page must contain type="application/ld+json"'
    });
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line}:${violation.column}: ${violation.message}`);
  }
  process.exit(1);
}

console.log(`Schema policy check passed (${htmlFiles.length} HTML files scanned).`);
