import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

const rootFilesToCopy = [
  "index.html",
  "404.html",
  "offline.html",
  "success.html",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "_headers",
  "LICENSE",
];

const dirsToCopy = ["assets", "services", "legal", "js", "css"];

const htmlFiles = [
  "index.html",
  "404.html",
  "offline.html",
  "success.html",
  path.join("services", "*.html"),
  path.join("legal", "*.html"),
];

const ensureDir = async (targetPath) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
};

const copyFile = async (from, to) => {
  await ensureDir(to);
  await fs.copyFile(from, to);
};

const copyDirRecursive = async (fromDir, toDir) => {
  const entries = await fs.readdir(fromDir, { withFileTypes: true });

  for (const entry of entries) {
    const from = path.join(fromDir, entry.name);
    const to = path.join(toDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(from, to);
      continue;
    }

    await copyFile(from, to);
  }
};

const collectHtmlFiles = async () => {
  const files = [];

  for (const pattern of htmlFiles) {
    if (!pattern.includes("*")) {
      files.push(pattern);
      continue;
    }

    const [dirName] = pattern.split(path.sep + "*");
    const absoluteDir = path.join(rootDir, dirName);
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });

    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
      .forEach((entry) => files.push(path.join(dirName, entry.name)));
  }

  return files;
};

const rewriteHtmlForDist = async () => {
  const files = await collectHtmlFiles();

  for (const relativeFile of files) {
    const htmlPath = path.join(distDir, relativeFile);
    let html = await fs.readFile(htmlPath, "utf8");

    html = html
      .replaceAll("href=\"css/main.css\"", "href=\"style.min.css\"")
      .replaceAll("href=\"../css/main.css\"", "href=\"../style.min.css\"")
      .replaceAll("src=\"js/main.js\" type=\"module\"", "src=\"script.min.js\"")
      .replaceAll("src=\"../js/main.js\" type=\"module\"", "src=\"../script.min.js\"");

    await fs.writeFile(htmlPath, html, "utf8");
  }
};

for (const file of rootFilesToCopy) {
  await copyFile(path.join(rootDir, file), path.join(distDir, file));
}

for (const dir of dirsToCopy) {
  await copyDirRecursive(path.join(rootDir, dir), path.join(distDir, dir));
}

await rewriteHtmlForDist();

console.log("Dist assets copied and HTML references rewritten for production.");
