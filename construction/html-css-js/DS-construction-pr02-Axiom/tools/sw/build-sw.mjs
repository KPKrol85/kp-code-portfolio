import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { BUNDLES, readBundleManifest } from "../release/bundle-names.mjs";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const TEMPLATE_PATH = path.join(ROOT, "sw.template.js");
const WEB_MANIFEST_PATH = path.join(ROOT, "manifest.webmanifest");
const PROFILE_NAMES = ["local", "production"];

const getRequestedProfileNames = () => {
  const args = process.argv.slice(2);

  // Preserve the existing direct/build:sw behavior as a compatibility path,
  // while the named npm scripts select one output explicitly.
  if (args.length === 0) return PROFILE_NAMES;

  const [profileArg] = args;
  const prefix = "--profile=";
  const profileName = profileArg?.startsWith(prefix) ? profileArg.slice(prefix.length) : "";

  if (args.length !== 1 || !PROFILE_NAMES.includes(profileName)) {
    throw new Error(
      "Usage: node tools/sw/build-sw.mjs [--profile=local|--profile=production]",
    );
  }

  return [profileName];
};

// Production precache base: the fixed URLs served from the deployment root that
// build:dist assembles. Kept as a flat array of string literals because
// tools/qa/check-references.mjs reads this declaration to validate the
// production contract without running a build.
//
// The production CSS and JavaScript bundles are deliberately absent: their URLs
// carry a content hash and are read from dist/build-manifest.json per build, so
// this file never constructs or hardcodes one.
const BASE_PRECACHE = [
  "/",
  "/offline.html",
  "/js/offline.js",
  "/js/theme-init.js",
  "/manifest.webmanifest",
];

// Local precache base: the URLs served from the repository root by
// `npm run serve`. The production bundles do not exist there; all 15
// maintained HTML pages load css/main.css, js/main.js, and js/theme-init.js
// directly, while offline.html additionally loads js/offline.js for recovery.
// Those are the files a locally installed service worker can precache. The
// remaining entries are shared with the production profile.
const LOCAL_PRECACHE = [
  "/",
  "/offline.html",
  "/css/main.css",
  "/js/main.js",
  "/js/offline.js",
  "/js/theme-init.js",
  "/manifest.webmanifest",
];

// sw.template.js is the only hand-edited service worker source. Every service
// worker in the repository is rendered from it by the single render step below;
// a profile contributes nothing but the serving root it targets - its precache
// list, its revision inputs, and where the rendered file lands. Neither output
// is canonical, and neither can change without this script producing it.
//
// Built only for the requested profile because production bundle URLs are only
// known once build:hash has named them, while local generation must not depend
// on dist/. A revision is hashed from precached inputs only; no profile may take
// a generated service worker - its own output least of all - as an input.
const createProfile = async (profileName) => {
  if (profileName === "local") {
    return {
      name: "local",
      description: "local - repository root (npm run serve)",
      npmScript: "build:sw:local",
      outputPath: path.join(ROOT, "sw.js"),
      precache: LOCAL_PRECACHE,
      // The development assets this profile precaches, so its revision tracks
      // exactly what the local service worker caches.
      revisionInputs: [
        path.join(ROOT, "css/main.css"),
        path.join(ROOT, "js/main.js"),
        path.join(ROOT, "js/offline.js"),
        path.join(ROOT, "js/theme-init.js"),
        WEB_MANIFEST_PATH,
      ],
    };
  }

  // The production bundle filenames generated for this build. Validated by the
  // shared release contract, so a missing, stale, or malformed manifest stops
  // the build here instead of yielding a service worker that precaches a URL
  // the deployment does not serve.
  const bundles = await readBundleManifest(DIST_DIR);
  const bundleFiles = BUNDLES.map((bundle) => bundles[bundle.key]);

  return {
    name: "production",
    description: "production - dist/ deployment root",
    npmScript: "build:sw:production",
    outputPath: path.join(DIST_DIR, "sw.js"),
    precache: [...BASE_PRECACHE, ...bundleFiles.map((file) => `/${file}`)],
    // The content-addressed bundles plus the two standalone scripts and the web
    // manifest this profile precaches, so its revision tracks every production
    // asset whose bytes can change under a fixed URL. build:hash names the
    // bundles before build:sw:production runs; build:dist copies
    // js/theme-init.js and js/offline.js into dist/ only afterwards, so both are
    // hashed from the canonical root source those copies come from.
    revisionInputs: [
      ...bundleFiles.map((file) => path.join(DIST_DIR, file)),
      path.join(ROOT, "js/offline.js"),
      path.join(ROOT, "js/theme-init.js"),
      WEB_MANIFEST_PATH,
    ],
  };
};

// Prepended to every generated output so the ownership is visible in the file
// itself. Comment-only, so it never reaches the service worker runtime.
const headerLines = (profile) => [
  "// Generated file - do not edit.",
  "// Source: sw.template.js",
  `// Generator: tools/sw/build-sw.mjs (npm run ${profile.npmScript})`,
  `// Profile: ${profile.description}`,
  "",
];

const relativeToRoot = (filePath) => path.relative(ROOT, filePath).split(path.sep).join("/");

// A missing canonical input must stop the build instead of yielding a service
// worker whose revision no longer describes the assets it precaches.
const readRevisionInput = async (profile, filePath) => {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;

    const relative = relativeToRoot(filePath);
    const hint = relative.startsWith("dist/")
      ? " It is named by build:hash from the bundles build:css and build:js write, all of which run before build:sw:production in `npm run build`."
      : "";

    throw new Error(
      `Missing ${profile.name} revision input ${relative}.${hint}`,
      { cause: error },
    );
  }
};

const buildRevision = async (profile) => {
  const hash = crypto.createHash("sha256");

  for (const filePath of profile.revisionInputs) {
    const data = await readRevisionInput(profile, filePath);
    hash.update(data);
  }

  return hash.digest("hex").slice(0, 16);
};

const getManifestIcons = async () => {
  const manifestRaw = await fs.readFile(WEB_MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];

  const existingIconUrls = [];
  for (const icon of icons) {
    if (!icon?.src || typeof icon.src !== "string") continue;
    const iconUrl = icon.src.startsWith("/") ? icon.src : `/${icon.src}`;
    const iconFilePath = path.join(ROOT, iconUrl.replace(/^\//, ""));

    try {
      await fs.access(iconFilePath);
      existingIconUrls.push(iconUrl);
    } catch {
      // Ignore missing manifest icons.
    }
  }

  return existingIconUrls;
};

// The single render step: template + revision + precache list. Both profiles go
// through it, so the substitution logic exists once.
const renderServiceWorker = (template, profile, revision, assets) => {
  const newline = template.includes("\r\n") ? "\r\n" : "\n";
  const header = headerLines(profile).join(newline) + newline;

  const source = template
    .replace("__SW_REVISION__", revision)
    .replace("__PRECACHE_ASSETS__", JSON.stringify(assets));

  return header + source;
};

const buildServiceWorker = async () => {
  const requestedProfileNames = getRequestedProfileNames();
  const [template, manifestIcons, profiles] = await Promise.all([
    fs.readFile(TEMPLATE_PATH, "utf8"),
    getManifestIcons(),
    Promise.all(requestedProfileNames.map((profileName) => createProfile(profileName))),
  ]);

  // Validate and render every requested profile before writes begin, so an
  // input or rendering failure leaves all selected outputs untouched.
  const generated = [];
  for (const profile of profiles) {
    const revision = await buildRevision(profile);
    const assets = [...new Set([...profile.precache, ...manifestIcons])];

    generated.push({ profile, revision, output: renderServiceWorker(template, profile, revision, assets) });
  }

  for (const { profile, output } of generated) {
    await fs.mkdir(path.dirname(profile.outputPath), { recursive: true });
    await fs.writeFile(profile.outputPath, output, "utf8");
  }

  for (const { profile, revision } of generated) {
    console.log(
      `Generated ${relativeToRoot(profile.outputPath)} (${profile.name}, revision: ${revision})`,
    );
  }
};

buildServiceWorker().catch((error) => {
  console.error("Failed to build service worker", error);
  process.exitCode = 1;
});
