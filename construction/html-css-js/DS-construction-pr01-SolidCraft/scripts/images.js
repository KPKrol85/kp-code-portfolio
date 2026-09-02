const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { createLogger } = require("./utils/logger");

const logger = createLogger();

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SRC_ROOT = path.join(PROJECT_ROOT, "assets", "img-src");
const OUT_ROOT = path.join(PROJECT_ROOT, "assets", "img");

const HERO_SIZES = [
  { width: 400, height: 225 },
  { width: 800, height: 450 },
  { width: 1200, height: 675 },
  { width: 1600, height: 900 },
  { width: 2400, height: 1350 },
  { width: 3200, height: 1800 },
];

const OFERTA_SIZES = [
  { width: 400, height: 300 },
  { width: 800, height: 600 },
  { width: 1200, height: 900 },
  { width: 1600, height: 1200 },
];

const GALLERY_SIZES = [
  { width: 480, height: 360 },
  { width: 768, height: 576 },
  { width: 1024, height: 768 },
  { width: 1536, height: 1152 },
  { width: 2048, height: 1536 },
];

/* Every outputDir below is owned outright by this script: its whole content is
   regenerated from assets/img-src/, so anything found there that the current
   configuration would not produce is an obsolete leftover. Directories under
   assets/img/ that are absent from this list (favicon/, logo/, partners-logos/,
   shortcuts/) are hand-maintained and are never touched. */
const CONFIG = [
  {
    name: "hero",
    inputDir: "hero",
    outputDir: "hero",
    sizes: HERO_SIZES,
    nameFor: (baseName, size) => `${baseName}-${size.width}-${size.height}`,
    formats: ["avif", "webp", "jpg"],
  },
  {
    name: "oferta",
    inputDir: "oferta",
    outputDir: "oferta",
    sizes: OFERTA_SIZES,
    nameFor: (baseName, size) => `${baseName}-${size.width}x${size.height}`,
    formats: ["avif", "webp", "jpg"],
  },
  {
    name: "gallery",
    inputDir: "gallery",
    outputDir: "gallery",
    sizes: GALLERY_SIZES,
    nameFor: (baseName, size) => `${baseName}-${size.width}x${size.height}`,
    formats: ["avif", "webp", "jpg"],
  },
  {
    name: "og",
    inputDir: "og",
    outputDir: "og",
    sizes: null,
    nameFor: (baseName) => baseName,
    formats: ["avif", "webp", "source"],
  },
  {
    name: "screenshots",
    inputDir: "screenshots",
    outputDir: "screenshots",
    sizes: null,
    nameFor: (baseName) => baseName,
    formats: ["avif", "webp", "source"],
  },
];

const INPUT_EXTS = new Set([".jpg", ".jpeg", ".png"]);

const QUALITY = {
  webp: { quality: 80 },
  avif: { quality: 50, effort: 4 },
  jpg: { quality: 82, mozjpeg: true },
};

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function outputPathFor(outputDir, baseName, format) {
  return path.join(outputDir, `${baseName}.${format}`);
}

/* Single source of truth for "which files does this source image produce".
   Generation and cleanup both read it, so the canonical set can never drift
   into a second, hand-maintained list of allowed filenames. */
function expectedOutputsForFile(filePath, config) {
  const ext = path.extname(filePath).toLowerCase();
  if (!INPUT_EXTS.has(ext)) {
    return [];
  }

  const baseName = path.basename(filePath, ext);
  const outputDir = path.join(OUT_ROOT, config.outputDir);
  const sizes = config.sizes || [null];
  const outputs = [];

  for (const size of sizes) {
    const outputBase = config.nameFor(baseName, size);
    for (const format of config.formats) {
      const actualFormat = format === "source" ? ext.slice(1) : format;
      outputs.push({
        path: outputPathFor(outputDir, outputBase, actualFormat),
        format: actualFormat,
        size,
      });
    }
  }

  return outputs;
}

async function buildForFile(filePath, config, expectedOutputs) {
  if (expectedOutputs.length === 0) {
    return [];
  }

  await ensureDir(path.join(OUT_ROOT, config.outputDir));
  const buffer = await fs.readFile(filePath);
  const created = [];

  for (const output of expectedOutputs) {
    if (await pathExists(output.path)) {
      continue;
    }

    let pipeline = sharp(buffer).rotate();
    if (output.size) {
      pipeline = pipeline.resize(output.size.width, output.size.height, {
        fit: "cover",
        position: "center",
      });
    }

    if (output.format === "avif") {
      pipeline = pipeline.avif(QUALITY.avif);
    } else if (output.format === "webp") {
      pipeline = pipeline.webp(QUALITY.webp);
    } else if (output.format === "jpg" || output.format === "jpeg") {
      pipeline = pipeline.jpeg(QUALITY.jpg);
    } else if (output.format === "png") {
      pipeline = pipeline.png();
    }

    await pipeline.toFile(output.path);
    created.push(output.path);
  }

  return created;
}

/* Converges the owned output directories to `expected` by deleting everything
   else inside them. Cleanup is therefore driven by what the configuration can
   currently generate rather than by filename guesswork, so outputs left behind
   by superseded naming or sizing rules cannot survive another cycle. */
async function pruneObsolete(ownedDirs, expected, { dryRun = false } = {}) {
  const obsolete = [];

  for (const ownedDir of ownedDirs) {
    const relative = path.relative(OUT_ROOT, ownedDir);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`refusing to prune outside ${OUT_ROOT}: ${ownedDir}`);
    }
    if (!(await pathExists(ownedDir))) {
      continue;
    }

    for (const filePath of await walk(ownedDir)) {
      if (expected.has(filePath)) {
        continue;
      }
      obsolete.push(filePath);
      if (!dryRun) {
        await fs.unlink(filePath);
      }
    }
  }

  return obsolete.sort();
}

async function run(mode, { dryRun = false } = {}) {
  const created = [];
  const expected = new Set();
  const ownedDirs = [];
  let scanned = 0;

  logger.debug(`images:${mode} started${dryRun ? " (dry run)" : ""}`);
  for (const config of CONFIG) {
    const inputDir = path.join(SRC_ROOT, config.inputDir);
    if (!(await pathExists(inputDir))) {
      /* Without its sources the canonical set for this group is unknowable, so
         its output directory is left alone instead of being emptied. */
      logger.debug(
        `images:${mode} skip missing input directory ${config.inputDir}`,
      );
      continue;
    }

    logger.debug(`images:${mode} scanning ${config.inputDir}`);
    ownedDirs.push(path.join(OUT_ROOT, config.outputDir));

    const files = await walk(inputDir);
    for (const filePath of files) {
      scanned += 1;
      /* "clean" keeps nothing, so it contributes no expected outputs and the
         prune below empties every owned directory. */
      if (mode !== "build") {
        continue;
      }

      const outputs = expectedOutputsForFile(filePath, config);
      for (const output of outputs) {
        expected.add(output.path);
      }

      if (dryRun) {
        continue;
      }

      const createdForFile = await buildForFile(filePath, config, outputs);
      if (createdForFile.length > 0) {
        logger.debug(
          `images:build created ${createdForFile.length} output(s) from ${path.relative(PROJECT_ROOT, filePath)}`,
        );
      }
      created.push(...createdForFile);
    }
  }

  const obsolete = await pruneObsolete(ownedDirs, expected, { dryRun });
  for (const filePath of obsolete) {
    const relPath = path.relative(PROJECT_ROOT, filePath);
    if (dryRun) {
      logger.log(`- ${relPath}`);
    } else {
      logger.debug(`images:${mode} removed obsolete output ${relPath}`);
    }
  }

  if (dryRun) {
    logger.summary(
      `OK: images:${mode} --dry-run found ${obsolete.length} obsolete output(s) across ${ownedDirs.length} pipeline-owned directory(ies) from ${scanned} scanned source file(s).`,
    );
  } else if (mode === "build") {
    logger.summary(
      `OK: images:build created ${created.length} file(s) and removed ${obsolete.length} obsolete file(s) from ${scanned} scanned source file(s).`,
    );
  } else if (mode === "clean") {
    logger.summary(
      `OK: images:clean removed ${obsolete.length} file(s) from ${scanned} scanned source file(s).`,
    );
  }
}

const args = process.argv.slice(2);
const mode = args.find((arg) => !arg.startsWith("-"));
if (!mode || !["build", "clean"].includes(mode)) {
  logger.error(
    "Usage: node scripts/images.js <build|clean> [--dry-run] [--verbose]",
  );
  process.exit(1);
}

run(mode, { dryRun: args.includes("--dry-run") }).catch((error) => {
  logger.error("FAIL: image processing failed.");
  logger.error(error.stack || String(error));
  process.exit(1);
});
