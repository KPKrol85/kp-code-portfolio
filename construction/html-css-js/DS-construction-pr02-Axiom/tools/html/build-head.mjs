import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const templatePath = path.join(projectRoot, "tools/templates/head.partial.html");
const metaPath = path.join(projectRoot, "tools/templates/pages.meta.json");
const defaultOgImage = "https://construction-project-02.netlify.app/assets/img/og/og-1200x630.jpg";

const template = fs.readFileSync(templatePath, "utf8").trimEnd();
const pageMeta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

const escapeAttr = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const buildAssetPrefix = (filePath) => {
  const depth = filePath.split("/").length - 1;
  return depth > 0 ? "../".repeat(depth) : "";
};

const renderHead = (filePath, meta) => {
  const ogTitle = meta.og_title ?? meta.title;
  const ogDescription = meta.og_description ?? meta.description;
  const ogImage = meta.og_image ?? defaultOgImage;
  const twitterTitle = meta.twitter_title ?? ogTitle;
  const twitterDescription = meta.twitter_description ?? ogDescription;
  const twitterImageAlt = meta.twitter_image_alt ?? meta.og_image_alt;

  const replacements = {
    "{{TITLE}}": meta.title,
    "{{DESCRIPTION}}": meta.description,
    "{{CANONICAL}}": meta.canonical,
    "{{ROBOTS}}": meta.robots ?? "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    "{{OG_TITLE}}": ogTitle,
    "{{OG_DESCRIPTION}}": ogDescription,
    "{{OG_URL}}": meta.og_url,
    "{{OG_IMAGE}}": ogImage,
    "{{OG_IMAGE_ALT}}": meta.og_image_alt,
    "{{TWITTER_TITLE}}": twitterTitle,
    "{{TWITTER_DESCRIPTION}}": twitterDescription,
    "{{TWITTER_IMAGE_ALT}}": twitterImageAlt,
    "{{ASSET_PREFIX}}": buildAssetPrefix(filePath)
  };

  return Object.entries(replacements).reduce((output, [token, value]) => {
    if (typeof value !== "string") {
      throw new Error(`Missing required metadata value for ${token} in ${filePath}`);
    }

    return output.replaceAll(token, escapeAttr(value));
  }, template);
};

const indentBlock = (block, spaces = 4) => {
  const prefix = " ".repeat(spaces);
  const lines = block.trim().split("\n");
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const minIndent = nonEmpty.length > 0 ? Math.min(...nonEmpty.map((line) => line.match(/^\s*/)[0].length)) : 0;

  return lines
    .map((line) => `${prefix}${line.slice(minIndent)}`)
    .join("\n");
};

const extractHeadExtras = (headInner) => {
  const scriptRegex = /<script\b[\s\S]*?<\/script>/gi;
  const extras = [];

  for (const match of headInner.matchAll(scriptRegex)) {
    const script = match[0];
    if (script.includes("application/ld+json") || script.includes("theme-init.js")) {
      extras.push(indentBlock(script));
    }
  }

  return extras;
};

for (const [filePath, meta] of Object.entries(pageMeta)) {
  if (meta.canonical !== meta.og_url) {
    throw new Error(`canonical and og_url mismatch for ${filePath}`);
  }

  const absolutePath = path.join(projectRoot, filePath);
  const html = fs.readFileSync(absolutePath, "utf8");
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);

  if (!headMatch) {
    throw new Error(`Could not find <head>...</head> in ${filePath}`);
  }

  const currentHeadInner = headMatch[1];
  const extraBlocks = extractHeadExtras(currentHeadInner);
  const generatedHead = renderHead(filePath, meta);

  const headSections = [generatedHead, ...extraBlocks];
  const nextHeadInner = `\n${headSections.join("\n\n")}\n  `;

  const updatedHtml = html.replace(headMatch[0], `<head>${nextHeadInner}</head>`);

  fs.writeFileSync(absolutePath, updatedHtml, "utf8");
  console.log(`Updated head: ${filePath}`);
}
