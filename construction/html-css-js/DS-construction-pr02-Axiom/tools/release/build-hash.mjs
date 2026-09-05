// Content-addresses the finished production bundles (O-01).
//
// Runs after build:css and build:js and before build:sw and build:dist. Reads
// the final minified bytes each builder wrote, renames the fixed intermediate
// to a content-addressed production filename, and records the mapping in
// dist/build-manifest.json for build:sw and build:dist to consume.
//
// tools/release/bundle-names.mjs owns every filename decision; this script owns
// the filesystem transition and the invariants that make it safe. The rename is
// atomic and stays inside dist/, so a successful step cannot leave the fixed
// intermediate sitting beside the production file.

import fs from "node:fs/promises";
import path from "node:path";

import {
  BUNDLES,
  MANIFEST_FILENAME,
  contentHash,
  describeProductionFormat,
  findBundleFiles,
  parseProductionName,
  productionName,
  readBundleManifest,
  writeBundleManifest,
} from "./bundle-names.mjs";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

const readIntermediate = async (bundle) => {
  try {
    return await fs.readFile(path.join(distDir, bundle.intermediate));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;

    throw new Error(
      `Missing dist/${bundle.intermediate}. It is written by ${bundle.builder}, which runs before build:hash in \`npm run build\`.`,
      { cause: error },
    );
  }
};

// Another bundle of the same kind at the dist root means an earlier build's
// output survived: hashing would leave two live bundles behind and the manifest
// could describe only one of them.
const assertUnambiguousInput = async (bundle) => {
  const found = await findBundleFiles(distDir, bundle);
  const extra = found.filter((name) => name !== bundle.intermediate);

  if (extra.length > 0) {
    throw new Error(
      `dist/ holds ${extra.map((name) => `dist/${name}`).join(", ")} beside dist/${bundle.intermediate}. Run \`npm run build\`, which starts from build:clean, so exactly one ${bundle.suffix} bundle reaches build:hash.`,
    );
  }
};

// The post-conditions of a successful hashing step, checked against the
// filesystem rather than against the values this script just computed.
const assertInvariants = async (expected) => {
  for (const bundle of BUNDLES) {
    const found = await findBundleFiles(distDir, bundle);

    if (found.length !== 1) {
      throw new Error(
        `Expected exactly one ${bundle.suffix} bundle at the dist root, found ${found.length}: ${found.map((name) => `dist/${name}`).join(", ") || "none"}.`,
      );
    }

    if (found.includes(bundle.intermediate)) {
      throw new Error(`dist/${bundle.intermediate} still exists after hashing.`);
    }

    if (found[0] !== expected[bundle.key]) {
      throw new Error(
        `Expected dist/${expected[bundle.key]} at the dist root, found dist/${found[0]}.`,
      );
    }

    const declaredHash = parseProductionName(bundle, found[0]);

    if (declaredHash === null) {
      throw new Error(
        `dist/${found[0]} does not match the production name format ${describeProductionFormat(bundle)}.`,
      );
    }

    const actualHash = contentHash(await fs.readFile(path.join(distDir, found[0])));

    if (actualHash !== declaredHash) {
      throw new Error(
        `dist/${found[0]} is not addressed by its own content: the filename claims ${declaredHash}, its bytes hash to ${actualHash}.`,
      );
    }
  }

  // Re-reading through the shared validator checks the manifest shape, the
  // deployment-root filename form, duplicate targets, and that every target
  // exists - the same contract build:sw and build:dist will rely on.
  const manifest = await readBundleManifest(distDir);

  for (const bundle of BUNDLES) {
    if (manifest[bundle.key] !== expected[bundle.key]) {
      throw new Error(
        `dist/${MANIFEST_FILENAME} maps "${bundle.intermediate}" to ${manifest[bundle.key]}, expected ${expected[bundle.key]}.`,
      );
    }
  }
};

const build = async () => {
  const hashed = {};

  for (const bundle of BUNDLES) {
    const bytes = await readIntermediate(bundle);
    await assertUnambiguousInput(bundle);

    const filename = productionName(bundle, contentHash(bytes));

    await fs.rename(path.join(distDir, bundle.intermediate), path.join(distDir, filename));
    hashed[bundle.key] = filename;
  }

  await writeBundleManifest(distDir, hashed);
  await assertInvariants(hashed);

  for (const bundle of BUNDLES) {
    console.log(`Hashed dist/${bundle.intermediate} -> dist/${hashed[bundle.key]}`);
  }

  console.log(`Wrote dist/${MANIFEST_FILENAME}`);
};

build().catch((error) => {
  console.error("Failed to hash production bundles:", error.message);
  process.exitCode = 1;
});
