import fg from "fast-glob";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../assets/src-images");
const outDir = path.resolve(__dirname, "../assets/images");

const run = async () => {
  await fs.mkdir(outDir, { recursive: true });
  const files = await fg(["**/*.{png,jpg,jpeg}"], { cwd: srcDir });

  if (!files.length) {
    console.log("Brak obrazów w assets/src-images.");
    return;
  }

  await Promise.all(
    files.map(async (file) => {
      const inputPath = path.join(srcDir, file);
      const baseName = path.parse(file).name;
      const outputBase = path.join(outDir, baseName);
      await sharp(inputPath).toFormat("webp").toFile(`${outputBase}.webp`);
      await sharp(inputPath).toFormat("avif").toFile(`${outputBase}.avif`);
      console.log(`Przetworzono: ${file}`);
    })
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
