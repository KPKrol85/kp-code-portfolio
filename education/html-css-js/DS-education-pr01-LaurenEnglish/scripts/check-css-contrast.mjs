import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tokensSource = await readFile(
  resolve(ROOT, "css/tokens/tokens.css"),
  "utf8",
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const parseHexTokens = (block) => {
  const tokens = new Map();
  for (const match of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,8})\s*;/giu)) {
    tokens.set(match[1], match[2]);
  }
  return tokens;
};

const rootBlock = tokensSource.match(/:root\s*\{([\s\S]*?)\}/u)?.[1];
const darkBlock = tokensSource.match(
  /\[data-theme="dark"\]\s*\{([\s\S]*?)\}/u,
)?.[1];
assert(rootBlock && darkBlock, "Unable to read light and dark token blocks");

const themes = new Map([
  ["light", parseHexTokens(rootBlock)],
  [
    "dark",
    new Map([...parseHexTokens(rootBlock), ...parseHexTokens(darkBlock)]),
  ],
]);

const toRgb = (hex) => {
  const normalized = hex.slice(1);
  const value =
    normalized.length === 3
      ? [...normalized].map((character) => character.repeat(2)).join("")
      : normalized.slice(0, 6);
  return [0, 2, 4].map((index) =>
    Number.parseInt(value.slice(index, index + 2), 16),
  );
};

const luminance = (hex) => {
  const channels = toRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (foreground, background) => {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

const pairs = [
  ["body text / page", "color-text", "color-bg", 4.5],
  ["muted text / page", "color-text-muted", "color-bg", 4.5],
  ["body text / card", "color-text", "color-surface", 4.5],
  ["muted text / card", "color-text-muted", "color-surface", 4.5],
  ["muted text / soft surface", "color-text-muted", "color-surface-soft", 4.5],
  ["body text / hero start", "color-text", "color-hero-surface-start", 4.5],
  ["body text / hero end", "color-text", "color-hero-surface-end", 4.5],
  [
    "muted text / hero start",
    "color-text-muted",
    "color-hero-surface-start",
    4.5,
  ],
  ["muted text / hero end", "color-text-muted", "color-hero-surface-end", 4.5],
  ["body text / hero overlay", "color-text", "color-surface-overlay", 4.5],
  ["primary control text", "color-text-on-primary", "color-primary", 4.5],
  [
    "disabled control text",
    "color-disabled-text",
    "color-disabled-surface",
    4.5,
  ],
  [
    "success status text",
    "color-status-success-text",
    "color-status-success-surface",
    4.5,
  ],
  [
    "premium access text",
    "color-access-premium-text",
    "color-access-premium-surface",
    4.5,
  ],
  ["focus ring / guard", "color-focus-ring", "color-focus-guard", 3],
  ["focus guard / primary", "color-focus-guard", "color-primary", 3],
  ["control boundary / card", "color-control-border", "color-surface", 3],
  ["primary boundary / page", "color-primary", "color-bg", 3],
  [
    "success boundary",
    "color-status-success-border",
    "color-status-success-surface",
    3,
  ],
  [
    "premium boundary",
    "color-access-premium-border",
    "color-access-premium-surface",
    3,
  ],
];

let minimum = { ratio: Number.POSITIVE_INFINITY, label: "", theme: "" };
for (const [theme, tokens] of themes) {
  for (const [label, foregroundToken, backgroundToken, threshold] of pairs) {
    const foreground = tokens.get(foregroundToken);
    const background = tokens.get(backgroundToken);
    assert(
      foreground && background,
      `${theme}: missing contrast token for ${label}`,
    );
    const ratio = contrast(foreground, background);
    assert(
      ratio >= threshold,
      `${theme}: ${label} is ${ratio.toFixed(2)}:1; expected at least ${threshold}:1`,
    );
    if (ratio < minimum.ratio) minimum = { ratio, label, theme };
  }
}

console.log(
  `Verified ${pairs.length * themes.size} deterministic WCAG contrast pairs across light and dark themes; minimum ${minimum.ratio.toFixed(2)}:1 (${minimum.theme} ${minimum.label}).`,
);
