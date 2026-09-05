// Production bundle naming contract (O-01).
//
// The single owner of every production bundle filename decision: the fixed
// intermediate names build:css and build:js write, the content-addressed
// production name format, the hash algorithm and its truncation, the build
// manifest filename, and manifest validation.
//
// No other script constructs a production bundle filename or reads the manifest
// raw. Consumers (build:hash, build:sw, build:dist) call in here, so a naming
// change lands in one file and cannot drift between the release build, the
// service-worker build, and the production HTML rewrite.
//
// Side-effect free: importing this module reads nothing and writes nothing.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const HASH_ALGORITHM = "sha256";

// Matches the truncation tools/sw/build-sw.mjs already uses for the service
// worker cache revision, so the repository keeps one hash convention.
export const HASH_LENGTH = 16;

export const MANIFEST_FILENAME = "build-manifest.json";

// The production bundles, in manifest order. `intermediate` is the fixed name
// its builder writes into dist/; `prefix` and `suffix` frame the content hash
// in the final production filename, which stays at the deployment root because
// the inlined @font-face URLs in the CSS bundle resolve relative to it.
export const BUNDLES = [
  {
    key: "css",
    intermediate: "style.min.css",
    prefix: "style",
    suffix: ".min.css",
    builder: "build:css",
  },
  {
    key: "js",
    intermediate: "script.min.js",
    prefix: "script",
    suffix: ".min.js",
    builder: "build:js",
  },
];

// The digest of the exact bytes handed in - the final minified bundle content,
// never a source file or a pre-minification intermediate.
export const contentHash = (bytes) =>
  crypto.createHash(HASH_ALGORITHM).update(bytes).digest("hex").slice(0, HASH_LENGTH);

export const productionName = (bundle, hash) => `${bundle.prefix}.${hash}${bundle.suffix}`;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const productionNamePattern = (bundle) =>
  new RegExp(
    `^${escapeRegExp(bundle.prefix)}\\.([0-9a-f]{${HASH_LENGTH}})${escapeRegExp(bundle.suffix)}$`,
  );

// The hash a production filename claims, or null when the name does not follow
// the format. Used to check a filename against the bytes it addresses.
export const parseProductionName = (bundle, filename) => {
  const match = productionNamePattern(bundle).exec(filename);

  return match ? match[1] : null;
};

export const describeProductionFormat = (bundle) =>
  `${bundle.prefix}.<${HASH_LENGTH} lowercase hex>${bundle.suffix}`;

export const manifestPath = (distDir) => path.join(distDir, MANIFEST_FILENAME);

// Every file at the dist root carrying this bundle's suffix - the fixed
// intermediate and any content-addressed production file alike - so callers can
// prove the deployment root holds exactly one bundle of each kind.
export const findBundleFiles = async (distDir, bundle) => {
  const entries = await fs.readdir(distDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(bundle.suffix))
    .map((entry) => entry.name)
    .sort();
};

// Deterministic: keys follow the BUNDLES declaration order, the values are bare
// deployment-root filenames, and the formatting is fixed, so identical input
// produces a byte-identical manifest.
export const writeBundleManifest = async (distDir, filesByKey) => {
  const record = {};

  for (const bundle of BUNDLES) {
    record[bundle.intermediate] = filesByKey[bundle.key];
  }

  await fs.writeFile(manifestPath(distDir), `${JSON.stringify(record, null, 2)}\n`, "utf8");

  return record;
};

// Reads the manifest and rejects anything a consumer must not trust: a missing
// or unparseable file, an unexpected or absent bundle key, a value that is not
// a bare deployment-root filename, a name outside the production format, two
// bundles mapped to one file, and a target that no longer exists in dist/.
// Returns the production filenames keyed by bundle key ({ css, js }).
export const readBundleManifest = async (distDir) => {
  const label = `dist/${MANIFEST_FILENAME}`;

  let raw;
  try {
    raw = await fs.readFile(manifestPath(distDir), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;

    throw new Error(
      `Missing ${label}. It is written by build:hash, which runs after build:css and build:js in \`npm run build\`.`,
      { cause: error },
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`, { cause: error });
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `${label} must be a JSON object mapping intermediate bundle names to production filenames.`,
    );
  }

  const expectedKeys = BUNDLES.map((bundle) => bundle.intermediate);
  const unexpectedKeys = Object.keys(parsed).filter((key) => !expectedKeys.includes(key));

  if (unexpectedKeys.length > 0) {
    throw new Error(
      `${label} declares unexpected entries: ${unexpectedKeys.join(", ")}. Expected exactly: ${expectedKeys.join(", ")}.`,
    );
  }

  const files = {};
  const claimedBy = new Map();

  for (const bundle of BUNDLES) {
    const value = parsed[bundle.intermediate];

    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `${label} is missing a production filename for "${bundle.intermediate}". Expected exactly: ${expectedKeys.join(", ")}.`,
      );
    }

    // A manifest value addresses a file at the deployment root, so it must be a
    // bare filename - never a relative path, and never an absolute local path.
    if (
      value !== path.posix.basename(value) ||
      value !== path.win32.basename(value) ||
      value.includes("..")
    ) {
      throw new Error(
        `${label} entry "${bundle.intermediate}" must be a deployment-root filename, not a path: ${value}`,
      );
    }

    if (parseProductionName(bundle, value) === null) {
      throw new Error(
        `${label} entry "${bundle.intermediate}" does not match the production name format ${describeProductionFormat(bundle)}: ${value}`,
      );
    }

    if (claimedBy.has(value)) {
      throw new Error(
        `${label} maps both "${claimedBy.get(value)}" and "${bundle.intermediate}" to ${value}.`,
      );
    }
    claimedBy.set(value, bundle.intermediate);

    let stats;
    try {
      stats = await fs.stat(path.join(distDir, value));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;

      throw new Error(
        `${label} points at ${value}, which does not exist in dist/. The manifest is stale; run \`npm run build\` from a clean dist/.`,
        { cause: error },
      );
    }

    if (!stats.isFile()) {
      throw new Error(`${label} points at ${value}, which is not a file.`);
    }

    files[bundle.key] = value;
  }

  return files;
};

// ---------------------------------------------------------------------------
// Deployment header contract
// ---------------------------------------------------------------------------
//
// The production cache rules are bundle URLs, so they belong to the same
// contract as the names: build:dist writes them into dist/_headers and
// tools/qa/check-references.mjs verifies them. Both call in here, so the writer
// and the validator cannot drift into disagreeing about the expected rule.

export const HEADERS_FILENAME = "_headers";

// The canonical root _headers delimits the generated region with these exact
// comment lines. build:dist replaces everything between them with the rules for
// the current build and leaves every other rule in the file untouched.
export const HEADERS_MARKER_BEGIN = "# >>> AXIOM PRODUCTION BUNDLE CACHE RULES >>>";
export const HEADERS_MARKER_END = "# <<< AXIOM PRODUCTION BUNDLE CACHE RULES <<<";

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

// The only URLs outside the content-addressed bundles that may carry long-lived
// immutable caching: the self-hosted font releases put the release version in
// both the directory and the filename, so a new release lands on a new URL.
export const VERSIONED_IMMUTABLE_PATHS = ["/assets/fonts/*"];

const countOccurrences = (source, marker) => source.split(marker).length - 1;

// Splits a headers file around its single generated region. Throws when the
// marker contract is not exactly one well-formed block, because a build that
// guessed here would silently ship the wrong cache policy.
export const locateHeadersMarkerBlock = (source, label) => {
  const begins = countOccurrences(source, HEADERS_MARKER_BEGIN);
  const ends = countOccurrences(source, HEADERS_MARKER_END);

  if (begins === 0 || ends === 0) {
    throw new Error(
      `${label} is missing the production bundle marker block. Expected one "${HEADERS_MARKER_BEGIN}" line and one "${HEADERS_MARKER_END}" line.`,
    );
  }

  if (begins > 1 || ends > 1) {
    throw new Error(
      `${label} declares the production bundle marker block more than once (${begins} begin, ${ends} end). Exactly one is required.`,
    );
  }

  const start = source.indexOf(HEADERS_MARKER_BEGIN);
  const end = source.indexOf(HEADERS_MARKER_END);

  if (end < start) {
    throw new Error(`${label} closes the production bundle marker block before it opens it.`);
  }

  return {
    before: source.slice(0, start),
    after: source.slice(end + HEADERS_MARKER_END.length),
  };
};

// The generated region, built from validated manifest filenames only.
export const renderProductionHeaderRules = (bundles, newline) => {
  const lines = [
    HEADERS_MARKER_BEGIN,
    "# Generated by build:dist from dist/build-manifest.json - do not edit.",
    "# Each URL carries a SHA-256 digest of its own bytes, so a content change",
    "# lands on a new URL and a cached response can never go stale.",
  ];

  for (const bundle of BUNDLES) {
    lines.push("", `/${bundles[bundle.key]}`, `  Cache-Control: ${IMMUTABLE_CACHE_CONTROL}`);
  }

  lines.push("", HEADERS_MARKER_END);

  return lines.join(newline);
};

export const applyProductionHeaderRules = (source, bundles, label) => {
  const { before, after } = locateHeadersMarkerBlock(source, label);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";

  return `${before}${renderProductionHeaderRules(bundles, newline)}${after}`;
};

// Netlify-format rule groups: a path at column zero followed by its indented
// header lines. Comments and blank lines carry no policy.
export const parseHeaderRules = (source) => {
  const rules = [];
  let current = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    if (/^\s/.test(rawLine)) {
      if (current) current.headers.push(trimmed);
      continue;
    }

    current = { path: trimmed, headers: [] };
    rules.push(current);
  }

  return rules;
};

const cacheControlOf = (rule) => {
  const header = rule.headers.find((line) => /^cache-control\s*:/i.test(line));

  return header ? header.slice(header.indexOf(":") + 1).trim() : null;
};

// Every cache-policy rule a headers file must satisfy, returned as a list of
// human-readable problems so build:dist can fail on them and qa:references can
// report them alongside its other findings.
//
// `bundles` is the validated manifest for a generated deployment copy, or null
// for the canonical source, where no hashed rule exists yet.
export const findHeaderPolicyViolations = (source, { label, bundles = null }) => {
  const problems = [];
  const rules = parseHeaderRules(source);

  // A fixed production bundle name no longer addresses anything the build ships.
  for (const bundle of BUNDLES) {
    if (rules.some((rule) => rule.path === `/${bundle.intermediate}`)) {
      problems.push(
        `${label} still declares a cache rule for the fixed production bundle /${bundle.intermediate}.`,
      );
    }
  }

  // Long-lived immutable caching is only ever correct for a URL that carries its
  // own content identity, or a release version already baked into the path.
  const immutableAllowed = new Set(VERSIONED_IMMUTABLE_PATHS);

  if (bundles) {
    for (const bundle of BUNDLES) immutableAllowed.add(`/${bundles[bundle.key]}`);
  }

  for (const rule of rules) {
    const cacheControl = cacheControlOf(rule);

    if (!cacheControl || !/\bimmutable\b/.test(cacheControl)) continue;
    if (immutableAllowed.has(rule.path)) continue;

    problems.push(
      `${label} applies immutable caching to ${rule.path}, whose URL carries no content or release identity.`,
    );
  }

  // A generated deployment copy must carry the exact rule for each bundle the
  // manifest names - the exact path, and the full immutable policy.
  if (bundles) {
    for (const bundle of BUNDLES) {
      const expectedPath = `/${bundles[bundle.key]}`;
      const rule = rules.find((candidate) => candidate.path === expectedPath);

      if (!rule) {
        problems.push(`${label} has no cache rule for ${expectedPath}.`);
        continue;
      }

      const cacheControl = cacheControlOf(rule);

      if (cacheControl !== IMMUTABLE_CACHE_CONTROL) {
        problems.push(
          `${label} rule ${expectedPath} has Cache-Control "${cacheControl ?? "(none)"}", expected "${IMMUTABLE_CACHE_CONTROL}".`,
        );
      }
    }
  }

  return problems;
};
