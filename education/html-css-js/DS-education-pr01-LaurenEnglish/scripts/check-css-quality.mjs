import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_ROOT = resolve(ROOT, "css");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const maskCssCommentsAndStrings = (source) => {
  const masked = source.split("");

  for (let index = 0; index < source.length; index += 1) {
    if (source.startsWith("/*", index)) {
      masked[index] = " ";
      masked[index + 1] = " ";
      index += 2;
      while (index < source.length && !source.startsWith("*/", index)) {
        if (source[index] !== "\n") masked[index] = " ";
        index += 1;
      }
      if (index < source.length) {
        masked[index] = " ";
        masked[index + 1] = " ";
        index += 1;
      }
      continue;
    }

    if (source[index] !== '"' && source[index] !== "'") continue;
    const quote = source[index];
    masked[index] = " ";
    index += 1;
    while (index < source.length) {
      if (source[index] === "\\") {
        masked[index] = " ";
        if (index + 1 < source.length && source[index + 1] !== "\n") {
          masked[index + 1] = " ";
        }
        index += 2;
        continue;
      }
      if (source[index] === quote) {
        masked[index] = " ";
        break;
      }
      if (source[index] !== "\n") masked[index] = " ";
      index += 1;
    }
  }

  return masked.join("");
};

const collectVarReferences = (source) => {
  const maskedSource = maskCssCommentsAndStrings(source);
  const references = [];

  for (let index = 0; index < maskedSource.length; index += 1) {
    const previousCharacter = maskedSource[index - 1] ?? "";
    if (
      /[A-Za-z0-9_-]/u.test(previousCharacter) ||
      maskedSource.slice(index, index + 4).toLowerCase() !== "var("
    ) {
      continue;
    }

    let depth = 1;
    let fallbackIndex = -1;
    let closingIndex = -1;
    for (let cursor = index + 4; cursor < maskedSource.length; cursor += 1) {
      if (maskedSource[cursor] === "(") depth += 1;
      if (maskedSource[cursor] === ")") {
        depth -= 1;
        if (depth === 0) {
          closingIndex = cursor;
          break;
        }
      }
      if (
        maskedSource[cursor] === "," &&
        depth === 1 &&
        fallbackIndex === -1
      ) {
        fallbackIndex = cursor;
      }
    }
    if (closingIndex === -1) continue;

    const propertyName = maskedSource
      .slice(
        index + 4,
        fallbackIndex === -1 ? closingIndex : fallbackIndex,
      )
      .trim();
    if (/^--[A-Za-z0-9_-]+$/u.test(propertyName)) {
      references.push({
        hasFallback: fallbackIndex !== -1,
        index,
        propertyName,
      });
    }
  }

  return references;
};

const collectCssFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? collectCssFiles(path) : path;
    }),
  );
  return files.flat().filter((file) => file.endsWith(".css"));
};

const cssFiles = await collectCssFiles(CSS_ROOT);
const sources = new Map();
for (const file of cssFiles) {
  const key = relative(CSS_ROOT, file).replaceAll("\\", "/");
  sources.set(key, await readFile(file, "utf8"));
}
const maskedSources = new Map(
  [...sources].map(([file, source]) => [
    file,
    maskCssCommentsAndStrings(source),
  ]),
);

const expectedImports = [
  "tokens/tokens.css",
  "base/base.css",
  "base/typography.css",
  "utilities/utilities.css",
  "components/eyebrow.css",
  "components/cta-panel.css",
  "components/project-disclosure.css",
  "components/buttons.css",
  "components/navigation.css",
  "components/cards.css",
  "components/badges.css",
  "components/lists.css",
  "components/accordion.css",
  "components/forms.css",
  "components/tabs.css",
  "sections/hero.css",
  "sections/how.css",
  "sections/services.css",
  "sections/pricing.css",
  "sections/resources.css",
  "sections/testimonials.css",
  "sections/about.css",
  "sections/contact.css",
  "sections/footer.css",
  "sections/offline.css",
  "sections/reveal.css",
  "pages/pages.css",
  "pages/legal.css",
];
const styleSource = sources.get("style.css");
const actualImports = [...styleSource.matchAll(/@import\s+"([^"]+)"/gu)].map(
  (match) => match[1],
);
assert(
  JSON.stringify(actualImports) === JSON.stringify(expectedImports),
  "css/style.css import order must remain tokens → base → utilities → components → sections → pages",
);

const declaredCustomProperties = new Set();
for (const maskedSource of maskedSources.values()) {
  for (const match of maskedSource.matchAll(
    /(?:^|[;{])\s*(--[A-Za-z0-9_-]+)\s*:/gmu,
  )) {
    declaredCustomProperties.add(match[1]);
  }
  for (const match of maskedSource.matchAll(
    /@property\s+(--[A-Za-z0-9_-]+)\s*\{/gmu,
  )) {
    declaredCustomProperties.add(match[1]);
  }
}

const unresolvedCustomProperties = [];
for (const [file, source] of sources) {
  for (const reference of collectVarReferences(source)) {
    if (
      declaredCustomProperties.has(reference.propertyName) ||
      reference.hasFallback
    ) {
      continue;
    }
    unresolvedCustomProperties.push(
      `${file}:${source.slice(0, reference.index).split("\n").length}: var(${reference.propertyName}) has no project declaration or fallback`,
    );
  }
}
assert(
  unresolvedCustomProperties.length === 0,
  `Unresolved custom-property references:\n${unresolvedCustomProperties.join("\n")}`,
);

const tokensSource = sources.get("tokens/tokens.css");
const themeTokens = [
  "color-surface-overlay",
  "color-modal-backdrop",
  "color-header-overlay",
  "color-hero-surface-start",
  "color-hero-surface-end",
  "color-text-on-primary",
  "color-control-border",
  "color-interactive-surface",
  "color-disabled-surface",
  "color-disabled-text",
  "color-disabled-border",
  "color-status-success-surface",
  "color-status-success-text",
  "color-status-success-border",
  "color-access-premium-surface",
  "color-access-premium-text",
  "color-access-premium-border",
  "color-focus-ring",
  "color-focus-guard",
];
for (const token of themeTokens) {
  const declarations =
    tokensSource.match(new RegExp(`--${token}\\s*:`, "gu")) ?? [];
  assert(
    declarations.length === 2,
    `--${token} must define explicit light and dark values`,
  );
}

const nonTokenSources = [...sources.entries()].filter(
  ([file]) => file !== "tokens/tokens.css",
);
for (const [file, source] of nonTokenSources) {
  assert(
    !/(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()/iu.test(source),
    `${file}: raw colors must be expressed through tokens`,
  );
  assert(
    !/(^|[,{]\s*)#[A-Za-z_][\w-]*/gmu.test(source),
    `${file}: ID selectors are not allowed`,
  );
}

const importantAllowlist = new Map([
  ["base/base.css", 5],
  ["sections/reveal.css", 1],
]);
for (const [file, source] of sources) {
  const actual = (source.match(/!important/gu) ?? []).length;
  const expected = importantAllowlist.get(file) ?? 0;
  assert(
    actual === expected,
    `${file}: expected ${expected} documented !important uses, received ${actual}`,
  );
}

const allSource = [...sources.values()].join("\n");
assert(
  !allSource.includes(".u-visually-hidden"),
  "Duplicate visually-hidden utility remains",
);
assert(
  !allSource.includes(".u-skip-link"),
  "Duplicate skip-link utility remains",
);

for (const selector of [
  ".services .card--service",
  ".pricing .card--pricing",
  ".resources .card--resource",
  ".testimonials .card--testimonial",
  ".progress-hero .hero__card",
]) {
  assert(
    !allSource.includes(selector),
    `Avoidable contextual selector remains: ${selector}`,
  );
}

assert(
  sources
    .get("base/typography.css")
    .includes("Reserved base-layer extension point"),
  "base/typography.css must document its reserved architectural role",
);
assert(
  sources.get("components/tabs.css").includes("reuse"),
  "components/tabs.css must document its intentional reuse strategy",
);

console.log(
  `Verified ${cssFiles.length} canonical CSS files: layer order, ${themeTokens.length} dual-theme semantic tokens, ${declaredCustomProperties.size} declared custom properties with no unresolved references, zero raw colors, no ID selectors, consolidated utilities, documented placeholders, and contextual-selector cleanup.`,
);
