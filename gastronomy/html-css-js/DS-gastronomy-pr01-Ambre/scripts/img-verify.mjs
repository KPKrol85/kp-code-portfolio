import fs from "node:fs/promises";
import path from "node:path";

const TARGET = path.resolve("assets/img/_optimized");

async function walk(dir, count) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, count);
      continue;
    }
    count.value += 1;
  }
}

async function run() {
  try {
    const stat = await fs.stat(TARGET);
    if (!stat.isDirectory()) {
      console.log("assets/img/_optimized exists but is not a directory.");
      process.exitCode = 1;
      return;
    }
  } catch {
    console.log("assets/img/_optimized missing.");
    process.exitCode = 1;
    return;
  }

  const counter = { value: 0 };
  await walk(TARGET, counter);
  console.log(`assets/img/_optimized files: ${counter.value}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
