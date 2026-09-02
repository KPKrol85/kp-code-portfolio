
import { execSync } from "node:child_process";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mainFile = path.join(rootDir, "css", "main.css");
const distDir = path.join(rootDir, "dist");
const tempFile = path.join(distDir, "style.css");
const outputFile = path.join(distDir, "style.min.css");
const cssnanoBin = path.join(rootDir, "node_modules", ".bin", process.platform === "win32" ? "cssnano.cmd" : "cssnano");

const importRegex = /^\s*@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/;

async function inlineImports(filePath, seen = new Set()) {
  if (seen.has(filePath)) {
    return "";
  }
  seen.add(filePath);
  const content = await readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const output = [];
  for (const line of lines) {
    const match = line.match(importRegex);
    if (match) {
      const importPath = match[1];
      const resolved = path.resolve(path.dirname(filePath), importPath);
      const inlined = await inlineImports(resolved, seen);
      output.push(inlined);
    } else {
      output.push(line);
    }
  }
  return output.join("\n");
}

async function build() {
  await mkdir(distDir, { recursive: true });
  const combined = await inlineImports(mainFile);
  await writeFile(tempFile, combined.trim() + "\n");
execSync(`"${cssnanoBin}" "${tempFile}" "${outputFile}"`, { stdio: "inherit" });
  await unlink(tempFile);
}

build().catch((error) => {
  console.error("CSS build failed:", error);
  process.exitCode = 1;
});
