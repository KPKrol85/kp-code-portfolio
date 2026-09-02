import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const sourceRoot = path.join(rootDir, "assets", "img");
const outputRoot = path.join(sourceRoot, "_optimized");

const args = new Set(process.argv.slice(2));
const skipDirs = new Set(["favicon", "icon", "logo", "shortcuts", "screenshots", "og", "_optimized"]);
const rasterExts = new Set([".jpg", ".jpeg", ".png"]);
const minProcessDimension = 420;

// Widths declared by the two `<picture>` shapes the pages use: the full-bleed
// sets (hero, about, and the gallery spreads opened by the lightbox) and the
// 600x400 service cards, whose srcset only names one smaller candidate.
const fullBleedWidths = [480, 768, 1024, 1440];
const serviceCardWidths = [480];

// The optimized set is declared by the pages, not by this script. Every entry
// is a source whose `<picture>` requests `_optimized/` candidates, and its
// widths are exactly the `w` descriptors that srcset carries. A source that is
// absent from this map has no production consumer for a generated variant, so
// nothing is written for it. Each entry also emits a full-size webp and avif,
// which the largest candidate of each srcset points at.
const responsiveSources = new Map([
  ["hero/hero-1920x1080.jpg", fullBleedWidths],
  ["o-nas/o-nas-1600x1200.jpg", fullBleedWidths],
  ["realizacje/budowa-domu-02-1600x1067.jpg", fullBleedWidths],
  ["realizacje/budowa-domu-05-1600x1067.jpg", fullBleedWidths],
  ["realizacje/instalacje-elektryczne-06-1600x1067.jpg", fullBleedWidths],
  ["realizacje/instalacje-sanitarne-02-1600x1067.jpg", fullBleedWidths],
  ["realizacje/instalacje-sanitarne-06-1600x1067.jpg", fullBleedWidths],
  ["realizacje/poddasze-02-1600x1067.jpg", fullBleedWidths],
  ["realizacje/poddasze-03-1600x1067.jpg", fullBleedWidths],
  ["realizacje/poddasze-06-1600x1067.jpg", fullBleedWidths],
  ["realizacje/remont-02-1600x1067.jpg", fullBleedWidths],
  ["realizacje/remont-04-1600x1067.jpg", fullBleedWidths],
  ["realizacje/wykonczenia-wnetrza-01-1600x1067.jpg", fullBleedWidths],
  ["realizacje/wykonczenia-wnetrza-05-1600x1067.jpg", fullBleedWidths],
  ["uslugi/adaptacja-poddaszy-600x400.jpg", serviceCardWidths],
  ["uslugi/budowa-domow-600x400.jpg", serviceCardWidths],
  ["uslugi/instalacje-elektryczne-600x400.jpg", serviceCardWidths],
  ["uslugi/instalacje-sanitarne-600x400.jpg", serviceCardWidths],
  ["uslugi/remonty-600x400.jpg", serviceCardWidths],
  ["uslugi/wykonczenia-wnetrz-600x400.jpg", serviceCardWidths],
]);

const webpOptions = { quality: 80, effort: 5 };
const avifOptions = { quality: 45, effort: 4 };

const formatBytes = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const safeRel = (filePath) => path.relative(sourceRoot, filePath).split(path.sep).join("/");

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const removeDir = async (dirPath) => {
  await fs.rm(dirPath, { recursive: true, force: true });
};

const walk = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) {
        continue;
      }
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

if (args.has("--clean")) {
  await removeDir(outputRoot);
  console.log(`[img:clean] Removed ${safeRel(outputRoot)}`);
  process.exit(0);
}

const run = async () => {
  const files = await walk(sourceRoot);
  const skipped = [];
  const processedSources = new Set();
  let processedCount = 0;
  let inputBytes = 0;
  let outputBytes = 0;
  let notRequested = 0;

  for (const filePath of files) {
    const relPath = safeRel(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (!rasterExts.has(ext)) {
      skipped.push({ file: relPath, reason: `format:${ext || "unknown"}` });
      continue;
    }

    const requestedWidths = responsiveSources.get(relPath);
    if (!requestedWidths) {
      notRequested += 1;
      continue;
    }

    let metadata;
    try {
      metadata = await sharp(filePath).metadata();
    } catch (error) {
      skipped.push({ file: relPath, reason: "unreadable" });
      continue;
    }

    if (!metadata.width || !metadata.height) {
      skipped.push({ file: relPath, reason: "missing-dimensions" });
      continue;
    }

    const maxDimension = Math.max(metadata.width, metadata.height);
    if (maxDimension < minProcessDimension) {
      skipped.push({ file: relPath, reason: `too-small:${metadata.width}x${metadata.height}` });
      continue;
    }

    const stat = await fs.stat(filePath);
    inputBytes += stat.size;

    const relDir = path.dirname(relPath);
    const outputDir = path.join(outputRoot, relDir);
    await ensureDir(outputDir);

    const baseName = path.parse(filePath).name;

    const outputs = [
      {
        format: "webp",
        options: webpOptions,
      },
      {
        format: "avif",
        options: avifOptions,
      },
    ];

    for (const { format, options } of outputs) {
      const baseOutput = path.join(outputDir, `${baseName}.${format}`);
      await sharp(filePath).rotate().toFormat(format, options).toFile(baseOutput);
      outputBytes += (await fs.stat(baseOutput)).size;

      for (const width of requestedWidths) {
        if (width >= metadata.width) {
          continue;
        }
        const sizedOutput = path.join(outputDir, `${baseName}-${width}w.${format}`);
        await sharp(filePath)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .toFormat(format, options)
          .toFile(sizedOutput);
        outputBytes += (await fs.stat(sizedOutput)).size;
      }
    }

    processedSources.add(relPath);
    processedCount += 1;
  }

  console.log(`[img:build] Processed files: ${processedCount}`);
  console.log(`[img:build] Input size: ${formatBytes(inputBytes)}`);
  console.log(`[img:build] Output size: ${formatBytes(outputBytes)}`);
  console.log(`[img:build] Sources no page requests an optimized variant of: ${notRequested}`);

  if (skipped.length) {
    console.log(`[img:build] Skipped files (${skipped.length}):`);
    skipped.forEach((entry) => {
      console.log(`- ${entry.file} (${entry.reason})`);
    });
  }

  // A declared source that never produced output means a page still asks for
  // variants this run did not write, so fail instead of shipping a gap.
  const missingSources = [...responsiveSources.keys()].filter(
    (source) => !processedSources.has(source),
  );

  if (missingSources.length) {
    console.error(`[img:build] Declared sources that produced no output (${missingSources.length}):`);
    missingSources.forEach((source) => {
      console.error(`- ${source}`);
    });
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("[img:build] Failed:", error);
  process.exit(1);
});
