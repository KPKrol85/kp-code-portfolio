const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const htmlPages = [
  "index.html",
  "about.html",
  "menu.html",
  "gallery.html",
  "contact.html",
  "cookies.html",
  "polityka-prywatnosci.html",
  "regulamin.html",
  "offline.html",
  "thank-you.html",
  "404.html",
];
/*
 The shared components every page template composes, keyed by the name its whole-line
 <!-- partial:name --> marker uses. element and className identify the component itself, so a
 hand-written copy of it in a template, or a partial that loses or repeats it, is refused.
*/
const htmlPartials = {
  header: { file: "partials/header.html", element: "header", className: "site-header" },
  footer: { file: "partials/footer.html", element: "footer", className: "footer" },
};
const rootFiles = [
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "sw.js",
  "_headers",
  "_redirects",
];
const assetEntries = [
  "js/bootstrap.js",
  "data/menu.json",
  "assets/docs",
  "assets/fonts/montserrat-vari-latin.woff2",
  "assets/fonts/montserrat-vari-latin-ext.woff2",
  "assets/fonts/playfair-display-vari-latin.woff2",
  "assets/fonts/playfair-display-vari-latin-ext.woff2",
  "assets/icons",
  "assets/img-optimized",
];
const productionAssets = {
  "css/style.css": "css/style.min.css",
  "js/script.js": "js/script.min.js",
  "js/core.js": "js/core.min.js",
};
const PARTIAL_REFERENCE = /<!--\s*partial\b/gi;
const PARTIAL_MARKER = /^([ \t]*)<!-- partial:([\w-]+) -->$/;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const OPEN_TAG = /<([a-z][\w-]*)\b[^>]*>/gi;
const CLASS_ATTRIBUTE = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

// Offsets of a component's opening tags. Comments are blanked in place, so a commented-out copy is no component.
function componentTags(html, { element, className }) {
  const markup = html.replace(HTML_COMMENT, (comment) => comment.replace(/[^\n]/g, " "));
  return [...markup.matchAll(OPEN_TAG)].filter((tag) => {
    const classes = tag[0].match(CLASS_ATTRIBUTE);
    return tag[1].toLowerCase() === element
      && Boolean(classes) && (classes[1] ?? classes[2] ?? classes[3]).split(/\s+/).includes(className);
  }).map((tag) => tag.index);
}

// A partial holds its own component exactly once, no other shared component and no marker of its own.
function readPartial(page, name) {
  const { file } = htmlPartials[name];
  let markup;
  try {
    markup = fs.readFileSync(path.join(rootDir, file), "utf8");
  } catch (error) {
    throw new Error(`${page}: <!-- partial:${name} --> cannot be composed, ${file} `
      + (error.code === "ENOENT" ? "does not exist" : `is unreadable (${error.message})`));
  }
  const nested = markup.search(PARTIAL_REFERENCE);
  if (nested >= 0) {
    throw new Error(`${file}:${lineOf(markup, nested)}: a partial cannot compose another partial (composing ${page})`);
  }
  for (const [other, component] of Object.entries(htmlPartials)) {
    const count = componentTags(markup, component).length;
    const expected = other === name ? 1 : 0;
    if (count !== expected) {
      throw new Error(`${file}: holds ${count} <${component.element} class="${component.className}"> `
        + `element(s) where ${expected} belong (composing ${page})`);
    }
  }
  return markup;
}

/*
 One page template with every registered partial spliced in at its marker. A marker is the only
 content of its line; each partial line takes the marker's indentation and the page's line ending,
 and the rest of the template is kept byte for byte. A malformed, unknown, repeated or missing
 marker, and a hand-written copy of a shared component, fail with the page and line to correct.
*/
function composeHtmlWithOrigins(page, html) {
  const markers = new Map();
  for (const reference of html.matchAll(PARTIAL_REFERENCE)) {
    const start = html.lastIndexOf("\n", reference.index) + 1;
    const lineEnd = html.indexOf("\n", reference.index);
    const line = html.slice(start, lineEnd < 0 ? html.length : lineEnd).replace(/\r$/, "");
    const sourceLine = lineOf(html, reference.index);
    const at = `${page}:${sourceLine}`;
    const marker = line.match(PARTIAL_MARKER);
    if (!marker) {
      throw new Error(`${at}: "${line.trim()}" is not a partial marker; write <!-- partial:name --> alone on its line`);
    }
    const [, indent, name] = marker;
    if (!Object.hasOwn(htmlPartials, name)) {
      throw new Error(`${at}: unknown partial "${name}"; only ${Object.keys(htmlPartials).join(" and ")} are registered`);
    }
    if (markers.has(name)) {
      throw new Error(`${at}: repeats <!-- partial:${name} -->, already composed at ${markers.get(name).at}`);
    }
    markers.set(name, { at, start, end: start + line.length, indent, sourceLine });
  }
  for (const [name, component] of Object.entries(htmlPartials)) {
    const copy = componentTags(html, component)[0];
    if (copy !== undefined) {
      throw new Error(`${page}:${lineOf(html, copy)}: hand-written <${component.element} class="${component.className}">; `
        + `the shared ${name} lives only in ${component.file}, so replace the block with <!-- partial:${name} -->`);
    }
    if (!markers.has(name)) {
      throw new Error(`${page}: missing <!-- partial:${name} -->; every page composes ${component.file} exactly once`);
    }
  }
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  // Entry i describes composed line i + 1. Whole-line markers keep each line in one source.
  const lineOrigins = [];
  let templateLine = 1;
  function appendTemplateOrigins(untilLine) {
    for (; templateLine < untilLine; templateLine++) {
      lineOrigins.push({ file: page, line: templateLine });
    }
  }
  let composed = "";
  let cursor = 0;
  for (const [name, marker] of [...markers].sort((a, b) => a[1].start - b[1].start)) {
    const lines = readPartial(page, name).replace(/\r?\n$/, "").split(/\r?\n/);
    composed += html.slice(cursor, marker.start) + lines.map((line) => (line ? marker.indent + line : line)).join(eol);
    appendTemplateOrigins(marker.sourceLine);
    // Only the final line ending is removed; leading, interior and trailing blank lines retain their numbers.
    lines.forEach((_, index) => lineOrigins.push({ file: htmlPartials[name].file, line: index + 1 }));
    templateLine = marker.sourceLine + 1;
    cursor = marker.end;
  }
  appendTemplateOrigins(html.split("\n").length + 1);
  return { html: composed + html.slice(cursor), lineOrigins };
}

// Existing consumers still receive exactly the composed HTML string.
function composeHtml(page, html) {
  return composeHtmlWithOrigins(page, html).html;
}

// A registered page read from the repository root and composed; no other file is ever served or built as a page.
function composePageWithOrigins(page) {
  if (!htmlPages.includes(page)) throw new Error(`${page} is not a page registered in scripts/build-config.js`);
  return composeHtmlWithOrigins(page, fs.readFileSync(path.join(rootDir, page), "utf8"));
}

function composePage(page) {
  return composePageWithOrigins(page).html;
}

function productionReference(reference) {
  const match = reference.match(/^(\/|\.\/)?([^?#]+)([?#].*)?$/);
  if (!match || !productionAssets[match[2]]) return reference;
  return (match[1] || "") + productionAssets[match[2]] + (match[3] || "");
}

function productionHtml(html) {
  return html.replace(/<(?:link|script)\b[^>]*>/gi, (tag) =>
    tag.replace(/\b(href|src)=(['"])(.*?)\2/gi, (_, attribute, quote, reference) =>
      `${attribute}=${quote}${productionReference(reference)}${quote}`,
    ),
  );
}

function productionWorker(worker) {
  return worker.replace(/(['"])(\/[^'"\r\n]+)\1/g, (_, quote, reference) =>
    `${quote}${productionReference(reference)}${quote}`,
  );
}

module.exports = {
  rootDir, distDir, htmlPages, htmlPartials, rootFiles, assetEntries, productionAssets,
  composeHtml, composePage, composeHtmlWithOrigins, composePageWithOrigins, productionHtml, productionWorker,
};
