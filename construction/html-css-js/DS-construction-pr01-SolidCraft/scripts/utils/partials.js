const fs = require("fs/promises");
const path = require("path");

/* Build-time HTML partial renderer.

   Shared layout markup lives once in partials/ and is expanded into every
   maintained page before the HTML reaches a browser. Nothing is resolved at
   runtime: the generated document already contains the complete header and
   footer, so the site keeps working without JavaScript.

   Page source contract (each directive owns its own line):

     <!-- @layout base="../" home="../index.html" active-home="" -->
     <!-- @include partials/header.html -->

   @layout declares the page context, @include names a partial relative to the
   project root. Partial template contract:

     {{name}}                          value of a declared layout variable
     {{#if name}}...{{/if}}            kept when the variable is non-empty

   Every referenced variable must be declared by the page, every partial must
   exist, and no directive or token may survive rendering — otherwise the
   render throws and the calling build/check script fails loudly. */

const PARTIALS_DIR_NAME = "partials";

const LAYOUT_LINE = /^[ \t]*<!--[ \t]*@layout\b([^]*?)-->[ \t]*\r?\n?/gm;
const INCLUDE_LINE =
  /^([ \t]*)<!--[ \t]*@include[ \t]+([^\s>]+)[ \t]*-->[ \t]*$/gm;
const ATTRIBUTE = /([A-Za-z][A-Za-z0-9_-]*)[ \t]*=[ \t]*"([^"]*)"/g;
const CONDITIONAL =
  /\{\{#if[ \t]+([A-Za-z][A-Za-z0-9_-]*)[ \t]*\}\}([^]*?)\{\{\/if\}\}/g;
const VARIABLE = /\{\{[ \t]*([A-Za-z][A-Za-z0-9_-]*)[ \t]*\}\}/g;
const LEFTOVER_DIRECTIVE = /<!--[ \t]*@(layout|include)\b/;
const LEFTOVER_TOKEN = /\{\{/;

const MAX_INCLUDE_DEPTH = 8;

class PartialRenderError extends Error {
  constructor(message) {
    super(message);
    this.name = "PartialRenderError";
  }
}

function fail(source, message) {
  throw new PartialRenderError(`${source}: ${message}`);
}

/* Reads `key="value"` pairs from an @layout directive body and rejects
   anything else so a typo can never become a silently ignored variable. */
function parseLayoutVariables(body, source) {
  const variables = Object.create(null);
  let match;

  ATTRIBUTE.lastIndex = 0;
  while ((match = ATTRIBUTE.exec(body)) !== null) {
    const [, name, value] = match;
    if (name in variables) {
      fail(source, `@layout declares "${name}" more than once.`);
    }
    variables[name] = value;
  }

  const leftover = body.replace(ATTRIBUTE, "").trim();
  if (leftover) {
    fail(
      source,
      `@layout contains unparsable content: "${leftover}". Expected key="value" pairs only.`,
    );
  }

  return variables;
}

function applyConditionals(template, variables, source) {
  const result = template.replace(CONDITIONAL, (_match, name, body) => {
    if (!(name in variables)) {
      fail(
        source,
        `{{#if ${name}}} is not declared by the including page's @layout.`,
      );
    }
    return variables[name] ? body : "";
  });

  if (/\{\{#if\b/.test(result) || /\{\{\/if\}\}/.test(result)) {
    fail(source, "unbalanced {{#if}} / {{/if}} block.");
  }

  return result;
}

function applyVariables(template, variables, source) {
  return template.replace(VARIABLE, (_match, name) => {
    if (!(name in variables)) {
      fail(
        source,
        `{{${name}}} is not declared by the including page's @layout.`,
      );
    }
    return variables[name];
  });
}

function indentBlock(block, indent) {
  if (!indent) return block;
  return block
    .split("\n")
    .map((line) => (line.trim() === "" ? line : indent + line))
    .join("\n");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

async function readPartial(rootDir, partialRef, source) {
  const normalized = toPosix(partialRef).replace(/^\.\//, "");
  const absPath = path.resolve(rootDir, normalized);
  const relPath = toPosix(path.relative(rootDir, absPath));

  if (relPath.startsWith("..") || path.isAbsolute(normalized)) {
    fail(source, `@include "${partialRef}" points outside the project root.`);
  }
  if (!relPath.startsWith(`${PARTIALS_DIR_NAME}/`)) {
    fail(
      source,
      `@include "${partialRef}" must reference a file inside ${PARTIALS_DIR_NAME}/.`,
    );
  }

  try {
    return { text: await fs.readFile(absPath, "utf8"), relPath };
  } catch (error) {
    if (error.code === "ENOENT") {
      fail(source, `@include "${partialRef}" was not found (${relPath}).`);
    }
    throw error;
  }
}

/* Expands every @include in `template`, recursing into partials that include
   other partials. `stack` carries the include chain for cycle detection. */
async function expandIncludes(template, { rootDir, variables, source, stack }) {
  if (stack.length > MAX_INCLUDE_DEPTH) {
    fail(source, `@include nesting exceeded ${MAX_INCLUDE_DEPTH} levels.`);
  }

  const directives = [];
  INCLUDE_LINE.lastIndex = 0;
  let match;
  while ((match = INCLUDE_LINE.exec(template)) !== null) {
    directives.push({
      full: match[0],
      indent: match[1],
      ref: match[2],
      index: match.index,
    });
  }

  if (directives.length === 0) return { html: template, partials: [] };

  const partials = [];
  let output = "";
  let cursor = 0;

  for (const directive of directives) {
    const { text, relPath } = await readPartial(rootDir, directive.ref, source);

    if (stack.includes(relPath)) {
      fail(
        source,
        `@include cycle detected: ${[...stack, relPath].join(" -> ")}.`,
      );
    }

    const nested = await expandIncludes(text, {
      rootDir,
      variables,
      source: relPath,
      stack: [...stack, relPath],
    });

    let rendered = applyConditionals(nested.html, variables, relPath);
    rendered = applyVariables(rendered, variables, relPath);
    rendered = indentBlock(rendered.replace(/\n$/, ""), directive.indent);

    output += template.slice(cursor, directive.index) + rendered;
    cursor = directive.index + directive.full.length;
    partials.push(relPath, ...nested.partials);
  }

  output += template.slice(cursor);
  return { html: output, partials };
}

/* Renders one maintained HTML document. Returns the expanded HTML plus the
   partials it used, so callers can report what was resolved. */
async function renderHtml(html, { rootDir, source = "html" } = {}) {
  if (!rootDir) {
    throw new PartialRenderError("renderHtml requires a rootDir option.");
  }

  const layouts = [];
  LAYOUT_LINE.lastIndex = 0;
  let match;
  while ((match = LAYOUT_LINE.exec(html)) !== null) {
    layouts.push({ full: match[0], body: match[1] });
  }

  if (layouts.length > 1) {
    fail(
      source,
      `found ${layouts.length} @layout directives; expected at most one.`,
    );
  }

  const variables = layouts.length
    ? parseLayoutVariables(layouts[0].body, source)
    : Object.create(null);

  const withoutLayout = layouts.length
    ? html.replace(layouts[0].full, "")
    : html;

  const { html: expanded, partials } = await expandIncludes(withoutLayout, {
    rootDir,
    variables,
    source,
    stack: [],
  });

  if (LEFTOVER_DIRECTIVE.test(expanded)) {
    fail(
      source,
      "an unresolved @layout/@include directive survived rendering.",
    );
  }
  if (LEFTOVER_TOKEN.test(expanded)) {
    fail(source, "an unresolved {{token}} survived rendering.");
  }

  return { html: expanded, partials: [...new Set(partials)] };
}

async function renderHtmlFile(absPath, { rootDir } = {}) {
  const root = rootDir || process.cwd();
  const html = await fs.readFile(absPath, "utf8");
  return renderHtml(html, {
    rootDir: root,
    source: toPosix(path.relative(root, absPath)) || path.basename(absPath),
  });
}

module.exports = {
  PARTIALS_DIR_NAME,
  PartialRenderError,
  renderHtml,
  renderHtmlFile,
};
