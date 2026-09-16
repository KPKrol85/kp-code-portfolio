const path = require("path");
const fs = require("fs/promises");
const fg = require("fast-glob");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..", "..");
const SRC_DIR = path.join(ROOT, "assets", "img-src");
const OUT_DIR = path.join(ROOT, "assets", "img-optimized");
const LEGACY_DIR = path.join(ROOT, "assets", "img");

const RASTER_EXTS = new Set([".jpg", ".jpeg", ".png"]);
const COPY_EXTS = new Set([".jpg", ".jpeg", ".png", ".svg"]);

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isDirEmpty(p) {
  try {
    const entries = await fs.readdir(p);
    return entries.length === 0;
  } catch {
    return true;
  }
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function copySeedSources() {
  const hasLegacy = await pathExists(LEGACY_DIR);
  if (!hasLegacy) return;

  await ensureDir(SRC_DIR);
  const patterns = ["**/*.{jpg,jpeg,png,svg}"];
  const entries = await fg(patterns, { cwd: LEGACY_DIR, dot: false });
  if (!entries.length) return;

  await Promise.all(
    entries.map(async (rel) => {
      const src = path.join(LEGACY_DIR, rel);
      const dest = path.join(SRC_DIR, rel);
      await ensureDir(path.dirname(dest));
      await fs.copyFile(src, dest);
    })
  );
}

function parseSizeFromName(filename) {
  const match = filename.match(/-(\d+)x(\d+)(?=\.[^.]+$)/);
  if (!match) return null;
  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

async function buildRaster(srcPath, relPath) {
  const ext = path.extname(relPath).toLowerCase();
  const baseRel = relPath.slice(0, -ext.length);
  const size = parseSizeFromName(relPath);

  const img = sharp(srcPath, { failOn: "none" });
  const meta = await img.metadata();

  let pipeline = img;
  if (size && meta && meta.width && meta.height) {
    if (meta.width !== size.width || meta.height !== size.height) {
      pipeline = pipeline.resize(size.width, size.height, { fit: "cover", position: "centre" });
    }
  }

  const outputs = [];
  outputs.push({ ext: ".webp", format: "webp", options: { quality: 75 } });
  outputs.push({ ext: ".avif", format: "avif", options: { quality: 45 } });

  if (ext === ".png") {
    outputs.push({ ext, format: "png", options: { quality: 80, compressionLevel: 9, adaptiveFiltering: true } });
  } else {
    outputs.push({ ext, format: "jpeg", options: { quality: 82, mozjpeg: true } });
  }

  await Promise.all(
    outputs.map(async (out) => {
      const outPath = path.join(OUT_DIR, baseRel + out.ext);
      await ensureDir(path.dirname(outPath));
      await pipeline.clone()[out.format](out.options).toFile(outPath);
    })
  );
}

async function buildSvg(srcPath, relPath) {
  const outPath = path.join(OUT_DIR, relPath);
  await ensureDir(path.dirname(outPath));
  await fs.copyFile(srcPath, outPath);
}

async function buildAll() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await ensureDir(OUT_DIR);

  const hasSrc = await pathExists(SRC_DIR);
  if (!hasSrc || (await isDirEmpty(SRC_DIR))) {
    await copySeedSources();
  }

  const entries = await fg(["**/*.*"], { cwd: SRC_DIR, dot: false });
  if (!entries.length) {
    console.warn("[images] Brak plików w assets/img-src. Dodaj źródła i uruchom ponownie.");
    return;
  }

  for (const rel of entries) {
    const srcPath = path.join(SRC_DIR, rel);
    const ext = path.extname(rel).toLowerCase();
    if (ext === ".svg") {
      await buildSvg(srcPath, rel);
      continue;
    }
    if (RASTER_EXTS.has(ext)) {
      await buildRaster(srcPath, rel);
    }
  }
}

buildAll().catch((err) => {
  console.error("[images] build failed:", err);
  process.exit(1);
});
