import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC_DIR = resolve(ROOT, ".vite-public");

const ROOT_FILES = ["site.webmanifest", "sitemap.xml", "robots.txt", "_redirects"];

const ASSET_DIRECTORIES = ["favicon", "fonts", "icons", "img", "og", "pwa"];

await rm(PUBLIC_DIR, {
  recursive: true,
  force: true,
});

await mkdir(resolve(PUBLIC_DIR, "assets"), {
  recursive: true,
});

for (const file of ROOT_FILES) {
  await cp(resolve(ROOT, file), resolve(PUBLIC_DIR, file));
}

for (const directory of ASSET_DIRECTORIES) {
  await cp(resolve(ROOT, "assets", directory), resolve(PUBLIC_DIR, "assets", directory), { recursive: true });
}

console.log(`Prepared Vite public assets: ${ROOT_FILES.length} root files and ${ASSET_DIRECTORIES.length} asset directories.`);
