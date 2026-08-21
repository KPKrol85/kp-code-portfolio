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
const idsCache = new Map();

const isExternal = (value) =>
  /^(https?:|mailto:|tel:|data:|javascript:)/i.test(value) || value.startsWith("//");

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

const buildLineStarts = (text) => {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
};

const extractIds = (text) => {
  const ids = new Set();
  const regex = /\bid\s*=\s*("([^"]+)"|'([^']+)')/gi;
  let match;
  while ((match = regex.exec(text))) {
    ids.add(match[2] || match[3]);
  }
  return ids;
};

const loadIds = (filePath) => {
  if (idsCache.has(filePath)) return idsCache.get(filePath);
  if (!fs.existsSync(filePath)) {
    idsCache.set(filePath, new Set());
    return idsCache.get(filePath);
  }
  const text = fs.readFileSync(filePath, "utf8");
  const ids = extractIds(text);
  idsCache.set(filePath, ids);
  return ids;
};

const addError = (file, line, message) => {
  errors.push({ file, line, message });
};

const checkAnchor = (targetFile, anchor, sourceFile, line, raw) => {
  if (!anchor) return;
  const ids = loadIds(targetFile);
  if (!ids.has(anchor)) {
    addError(sourceFile, line, `Missing anchor "${anchor}" for ${raw}`);
  }
};

const resolveTarget = (sourceFile, urlPath) => {
  if (urlPath.startsWith("/")) {
    return path.resolve(root, `.${urlPath}`);
  }
  return path.resolve(path.dirname(sourceFile), urlPath);
};

const checkUrl = (sourceFile, line, url) => {
  const raw = url.trim();
  if (!raw || raw === "#") return;
  if (isExternal(raw)) return;

  if (raw.startsWith("/#")) {
    const anchor = raw.slice(2);
    checkAnchor(path.resolve(root, "index.html"), anchor, sourceFile, line, raw);
    return;
  }

  if (raw.startsWith("#")) {
    checkAnchor(sourceFile, raw.slice(1), sourceFile, line, raw);
    return;
  }

  const hashIndex = raw.indexOf("#");
  const queryIndex = raw.indexOf("?");
  let clean = raw;
  let anchor = "";

  if (hashIndex !== -1) {
    anchor = raw.slice(hashIndex + 1);
    clean = raw.slice(0, hashIndex);
  }

  if (queryIndex !== -1 && (hashIndex === -1 || queryIndex < hashIndex)) {
    clean = raw.slice(0, queryIndex);
  }

  if (!clean) {
    checkAnchor(sourceFile, anchor, sourceFile, line, raw);
    return;
  }

  const target = resolveTarget(sourceFile, clean);

  if (!fs.existsSync(target)) {
    addError(sourceFile, line, `Missing file "${clean}" for ${raw}`);
    return;
  }

  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    stat = null;
  }

  let resolvedTarget = target;
  if (stat && stat.isDirectory()) {
    resolvedTarget = path.join(target, "index.html");
    if (!fs.existsSync(resolvedTarget)) {
      addError(sourceFile, line, `Missing index.html in "${clean}" for ${raw}`);
      return;
    }
  }

  if (anchor) {
    if (resolvedTarget.endsWith(".html")) {
      checkAnchor(resolvedTarget, anchor, sourceFile, line, raw);
    }
  }
};

const parseLinks = (filePath, text) => {
  const lineStarts = buildLineStarts(text);
  const regex = /\b(href|src|srcset)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = regex.exec(text))) {
    const attr = match[1].toLowerCase();
    const value = match[3] || match[4] || match[5] || "";
    const line = getLineNumber(lineStarts, match.index);

    if (attr === "srcset") {
      const parts = value.split(",");
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const url = trimmed.split(/\s+/)[0];
        if (url) checkUrl(filePath, line, url);
      }
    } else {
      checkUrl(filePath, line, value);
    }
  }
};

for (const page of pages) {
  const filePath = path.resolve(root, page);
  if (!fs.existsSync(filePath)) {
    addError(filePath, 1, `Missing page file "${page}"`);
    continue;
  }
  const text = fs.readFileSync(filePath, "utf8");
  loadIds(filePath);
  parseLinks(filePath, text);
}

if (errors.length) {
  console.log("QA LINKS: FAIL");
  errors.forEach((err) => {
    console.log(`${err.file}:${err.line} ${err.message}`);
  });
  console.log(`Total link errors: ${errors.length}`);
  process.exit(1);
} else {
  console.log("QA LINKS: PASS");
  process.exit(0);
}