#!/usr/bin/env node

import { readdir, mkdir, copyFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT_DIR, "assets", "img-src");
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, "assets", "img");

const RASTER_INPUTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const PASSTHROUGH_INPUTS = new Set([".svg"]);

const jpegOptions = {
  quality: 78,
  progressive: true,
  mozjpeg: true,
};

const pngOptions = {
  compressionLevel: 9,
  palette: true,
  quality: 82,
  effort: 8,
};

const webpOptions = {
  quality: 78,
  effort: 6,
};

const avifOptions = {
  quality: 50,
  effort: 6,
};

const log = {
  info(message) {
    console.info(`[optimize-images] ${message}`);
  },
  error(message) {
    console.error(`[optimize-images] ${message}`);
  },
};

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursively(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursively(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

async function ensureDirForFile(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function optimizeSameFamily(image, targetPath, ext) {
  if (ext === ".jpg" || ext === ".jpeg") {
    await image.jpeg(jpegOptions).toFile(targetPath);
    return;
  }

  if (ext === ".png") {
    await image.png(pngOptions).toFile(targetPath);
    return;
  }

  if (ext === ".webp") {
    await image.webp(webpOptions).toFile(targetPath);
    return;
  }

  if (ext === ".avif") {
    await image.avif(avifOptions).toFile(targetPath);
  }
}

async function optimizeRaster(sourcePath, relativePath, outputDir) {
  const ext = path.extname(sourcePath).toLowerCase();
  const outputOriginal = path.join(outputDir, relativePath);
  const baseOutput = outputOriginal.slice(0, -ext.length);

  await ensureDirForFile(outputOriginal);

  const image = sharp(sourcePath, { failOn: "warning" });

  await optimizeSameFamily(image.clone(), outputOriginal, ext);

  const webpPath = `${baseOutput}.webp`;
  if (ext !== ".webp") {
    await image.clone().webp(webpOptions).toFile(webpPath);
  }

  const avifPath = `${baseOutput}.avif`;
  if (ext !== ".avif") {
    await image.clone().avif(avifOptions).toFile(avifPath);
  }
}

export async function buildImages({
  outputDir = DEFAULT_OUTPUT_DIR,
  clean = false,
  logger = log,
} = {}) {
  if (!(await pathExists(SOURCE_DIR))) {
    logger.error(`Source folder not found: ${SOURCE_DIR}`);
    throw new Error(`Source folder not found: ${SOURCE_DIR}`);
  }

  if (clean) {
    await rm(outputDir, { recursive: true, force: true });
  }

  await mkdir(outputDir, { recursive: true });

  const files = await listFilesRecursively(SOURCE_DIR);

  if (!files.length) {
    logger.info("No source files found in assets/img-src/.");
    return {
      optimizedCount: 0,
      passthroughCount: 0,
      skippedCount: 0,
    };
  }

  let optimizedCount = 0;
  let passthroughCount = 0;
  let skippedCount = 0;

  for (const sourcePath of files) {
    const relativePath = path.relative(SOURCE_DIR, sourcePath);
    const ext = path.extname(sourcePath).toLowerCase();

    if (RASTER_INPUTS.has(ext)) {
      await optimizeRaster(sourcePath, relativePath, outputDir);
      optimizedCount += 1;
      continue;
    }

    if (PASSTHROUGH_INPUTS.has(ext)) {
      const outputPath = path.join(outputDir, relativePath);
      await ensureDirForFile(outputPath);
      await copyFile(sourcePath, outputPath);
      passthroughCount += 1;
      continue;
    }

    skippedCount += 1;
  }

  logger.info(`Raster images optimized: ${optimizedCount}`);
  logger.info(`Pass-through image files copied: ${passthroughCount}`);
  logger.info(`Unsupported files skipped: ${skippedCount}`);
  logger.info(`Output directory: ${path.relative(ROOT_DIR, outputDir)}`);

  return {
    optimizedCount,
    passthroughCount,
    skippedCount,
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  buildImages({ clean: process.argv.includes("--clean") }).catch((error) => {
    log.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  });
}
