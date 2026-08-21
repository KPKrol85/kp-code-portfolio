import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT_DIR = path.resolve("assets/img");
const OUT_DIR = path.resolve("assets/img/_optimized");
const CONCURRENCY = 4;
const WEBP_QUALITY = 80;
const WEBP_EFFORT = 4;
const AVIF_QUALITY = 50;
const AVIF_EFFORT = 4;

const args = new Set(process.argv.slice(2));
const wantsWebp = args.has("--webp");
const wantsAvif = args.has("--avif");
const makeWebp = wantsWebp || !wantsAvif;
const makeAvif = wantsAvif || !wantsWebp;

const sourceExts = new Set([".jpg", ".jpeg", ".png"]);

async function walk(dir, results) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_optimized") {
        continue;
      }
      await walk(fullPath, results);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (ext === ".webp" || ext === ".avif") {
      continue;
    }
    if (!sourceExts.has(ext)) {
      continue;
    }
    results.push(fullPath);
  }
}

async function needsWrite(srcStat, destPath) {
  try {
    const destStat = await fs.stat(destPath);
    return destStat.mtimeMs < srcStat.mtimeMs;
  } catch {
    return true;
  }
}

async function run() {
  const sources = [];
  await walk(ROOT_DIR, sources);

  if (!makeWebp && !makeAvif) {
    console.log("No output formats selected.");
    return;
  }

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  const tasks = [];

  for (const srcPath of sources) {
    const srcStat = await fs.stat(srcPath);
    const relPath = path.relative(ROOT_DIR, srcPath);
    const outDir = path.join(OUT_DIR, path.dirname(relPath));
    const baseName = path.parse(relPath).name;

    if (makeWebp) {
      const destWebp = path.join(outDir, `${baseName}.webp`);
      if (await needsWrite(srcStat, destWebp)) {
        tasks.push(async () => {
          try {
            await fs.mkdir(outDir, { recursive: true });
            await sharp(srcPath)
              .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
              .toFile(destWebp);
            generated += 1;
          } catch (err) {
            errors += 1;
            console.error(`WebP failed: ${srcPath}`);
            console.error(err);
          }
        });
      } else {
        skipped += 1;
      }
    }

    if (makeAvif) {
      const destAvif = path.join(outDir, `${baseName}.avif`);
      if (await needsWrite(srcStat, destAvif)) {
        tasks.push(async () => {
          try {
            await fs.mkdir(outDir, { recursive: true });
            await sharp(srcPath)
              .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
              .toFile(destAvif);
            generated += 1;
          } catch (err) {
            errors += 1;
            console.error(`AVIF failed: ${srcPath}`);
            console.error(err);
          }
        });
      } else {
        skipped += 1;
      }
    }
  }

  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor];
      cursor += 1;
      await task();
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, tasks.length || 1) },
    () => worker()
  );
  await Promise.all(workers);

  console.log(`Sources found: ${sources.length}`);
  console.log(`Outputs planned: ${tasks.length}`);
  console.log(`Generated: ${generated}`);
  console.log(`Skipped (up-to-date): ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (errors > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
