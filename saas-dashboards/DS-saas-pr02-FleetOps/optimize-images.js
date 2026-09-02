const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const rootDir = __dirname;
// Image sources are development inputs and stay out of the production build.
// Generated variants live in the Vite public directory so they are copied to
// `dist/assets/img/` verbatim, without hashing, under their existing URLs.
const sourceDir = path.join(rootDir, "assets", "img-src");
const outputDir = path.join(rootDir, "public", "assets", "img");

const requiredSources = [
  "hero/hero-light.jpg",
  "hero/hero-dark.jpg",
];

const supportedExtensions = new Set([".jpg", ".jpeg", ".png"]);

const outputOptions = {
  avif: { quality: 55, effort: 6 },
  webp: { quality: 78 },
  jpeg: { quality: 82, mozjpeg: true },
  png: { compressionLevel: 9, adaptiveFiltering: true },
};

function assertRequiredSources() {
  for (const source of requiredSources) {
    const sourcePath = path.join(sourceDir, source);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing required image source: assets/img-src/${source}`);
    }
  }
}

function collectSources(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error("Missing image source directory: assets/img-src");
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectSources(entryPath);
    }

    if (!entry.isFile() || !supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
      return [];
    }

    return [entryPath];
  });
}

async function optimizeSource(sourcePath) {
  const relativePath = path.relative(sourceDir, sourcePath);
  const parsed = path.parse(relativePath);
  const outputBase = path.join(outputDir, parsed.dir, parsed.name);

  fs.mkdirSync(path.dirname(outputBase), { recursive: true });

  await sharp(sourcePath).avif(outputOptions.avif).toFile(`${outputBase}.avif`);
  await sharp(sourcePath).webp(outputOptions.webp).toFile(`${outputBase}.webp`);

  if (parsed.ext.toLowerCase() === ".png") {
    await sharp(sourcePath).png(outputOptions.png).toFile(`${outputBase}.png`);
  } else {
    await sharp(sourcePath).jpeg(outputOptions.jpeg).toFile(`${outputBase}.jpg`);
  }
}

async function optimizeImages() {
  assertRequiredSources();

  const sources = collectSources(sourceDir);

  for (const source of sources) {
    await optimizeSource(source);
  }

  console.log(`[images] Optimized ${sources.length} source image(s)`);
}

optimizeImages().catch((error) => {
  console.error(`[images] ${error.message}`);
  process.exit(1);
});
