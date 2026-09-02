import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import sharp from "sharp";

import { runImagePipeline } from "../scripts/optimize-images.mjs";

const asset = (key, extension = "jpg") => ({
  fallbackPath: `/assets/img/${key}.${extension}`,
  height: 3,
  key,
  sourcePath: `/assets/image-sources/${key}.${extension}`,
  width: 4,
});
const diskPath = (root, publicPath) => join(root, `.${publicPath}`);
const put = async (root, publicPath, data) => {
  const path = diskPath(root, publicPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
  return path;
};

test("canonical preflight, generation, and read-only parity contract", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "lauren-images-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const canonical = await sharp({
    create: { background: "#496b83", channels: 3, height: 3, width: 4 },
  })
    .jpeg()
    .toBuffer();
  const valid = asset("valid");
  const missing = asset("missing");
  await put(root, valid.sourcePath, canonical);
  const protectedOutput = await put(root, valid.fallbackPath, "unchanged");
  const before = await stat(protectedOutput);

  await assert.rejects(
    runImagePipeline({ assets: [valid, missing], root }),
    /Image source preflight failed:[\s\S]*\/assets\/image-sources\/missing\.jpg/u,
  );
  assert.equal((await readFile(protectedOutput, "utf8")), "unchanged");
  assert.equal((await stat(protectedOutput)).mtimeMs, before.mtimeMs);

  await runImagePipeline({ assets: [valid], log: () => {}, root });
  const outputPaths = [
    valid.fallbackPath,
    "/assets/img/valid.avif",
    "/assets/img/valid.webp",
  ];
  for (const outputPath of outputPaths) {
    assert.ok((await readFile(diskPath(root, outputPath))).length > 0);
  }

  const parityTimes = new Map();
  for (const outputPath of outputPaths) {
    parityTimes.set(outputPath, (await stat(diskPath(root, outputPath))).mtimeMs);
  }
  await runImagePipeline({ assets: [valid], check: true, log: () => {}, root });
  for (const outputPath of outputPaths) {
    assert.equal(
      (await stat(diskPath(root, outputPath))).mtimeMs,
      parityTimes.get(outputPath),
    );
  }

  await rm(diskPath(root, "/assets/img/valid.avif"));
  await writeFile(diskPath(root, valid.fallbackPath), "stale");
  const staleBefore = await stat(diskPath(root, valid.fallbackPath));
  await assert.rejects(
    runImagePipeline({ assets: [valid], check: true, root }),
    /Image output parity check failed:[\s\S]*valid\.jpg: invalid image[\s\S]*valid\.avif: missing or unreadable/u,
  );
  assert.equal(
    (await stat(diskPath(root, valid.fallbackPath))).mtimeMs,
    staleBefore.mtimeMs,
  );
});
