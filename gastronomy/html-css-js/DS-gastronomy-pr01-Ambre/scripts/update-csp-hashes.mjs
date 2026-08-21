import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const headersPath = path.join(projectRoot, '_headers');

const HASH_BLOCK_START = '# CSP_SCRIPT_HASHES_BEGIN';
const HASH_BLOCK_END = '# CSP_SCRIPT_HASHES_END';
const HASH_TOKEN_REGEX = /'sha256-[A-Za-z0-9+/=]+'/g;

const toHashToken = (scriptContent) => {
  const digest = createHash('sha256').update(scriptContent).digest('base64');
  return `'sha256-${digest}'`;
};

const toSortedUnique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const extractInlineScriptHashes = async () => {
  const entries = await readdir(projectRoot, { withFileTypes: true });
  const htmlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const hashes = [];
  const inlineScriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

  for (const htmlFile of htmlFiles) {
    const html = await readFile(path.join(projectRoot, htmlFile), 'utf8');
    for (const match of html.matchAll(inlineScriptRegex)) {
      hashes.push(toHashToken(match[1]));
    }
  }

  return toSortedUnique(hashes);
};

const parseHeadersState = (headersContent) => {
  const hashBlockRegex = new RegExp(
    `${HASH_BLOCK_START}[\\s\\S]*?${HASH_BLOCK_END}`,
    'm',
  );
  const hashBlockMatch = headersContent.match(hashBlockRegex);

  if (!hashBlockMatch) {
    throw new Error('Could not locate CSP hash marker block in _headers.');
  }

  const cspLineRegex = /(script-src-elem 'self')(.*?)(; script-src-attr 'none')/s;
  const cspLineMatch = headersContent.match(cspLineRegex);

  if (!cspLineMatch) {
    throw new Error('Could not locate script-src-elem directive in _headers.');
  }

  const markerHashes = toSortedUnique(hashBlockMatch[0].match(HASH_TOKEN_REGEX) ?? []);
  const directiveHashes = toSortedUnique(cspLineMatch[2].match(HASH_TOKEN_REGEX) ?? []);

  return {
    markerHashes,
    directiveHashes,
    hashBlockRegex,
    cspLineRegex,
  };
};

const updateHeadersFile = async (hashes) => {
  const headers = await readFile(headersPath, 'utf8');
  const { hashBlockRegex, cspLineRegex } = parseHeadersState(headers);

  const hashesValue = hashes.length ? ` ${hashes.join(' ')}` : '';
  const headersWithUpdatedCsp = headers.replace(
    cspLineRegex,
    `$1${hashesValue}$3`,
  );

  const hashBlockLines = [
    HASH_BLOCK_START,
    ...hashes.map((hash) => `# ${hash}`),
    HASH_BLOCK_END,
  ];
  const hashBlock = hashBlockLines.join('\n');

  const finalHeaders = headersWithUpdatedCsp.replace(hashBlockRegex, hashBlock);
  await writeFile(headersPath, finalHeaders);
};

const setDiff = (base, compare) => base.filter((item) => !compare.includes(item));

const reportMismatch = (label, expected, actual) => {
  const missing = setDiff(expected, actual);
  const extra = setDiff(actual, expected);

  if (!missing.length && !extra.length) {
    return [];
  }

  return [
    `${label}:`,
    ...missing.map((hash) => `  - missing: ${hash}`),
    ...extra.map((hash) => `  - extra:   ${hash}`),
  ];
};

const checkHeadersFile = async (expectedHashes) => {
  const headers = await readFile(headersPath, 'utf8');
  const { markerHashes, directiveHashes } = parseHeadersState(headers);

  const hasInlineScripts = expectedHashes.length > 0;
  const errors = [];

  if (hasInlineScripts && markerHashes.length === 0) {
    errors.push('Marker block hash list is empty, but inline scripts were found.');
  }

  if (hasInlineScripts && directiveHashes.length === 0) {
    errors.push('script-src-elem hash list is empty, but inline scripts were found.');
  }

  errors.push(...reportMismatch('Marker block hashes differ from expected hashes', expectedHashes, markerHashes));
  errors.push(...reportMismatch('script-src-elem hashes differ from expected hashes', expectedHashes, directiveHashes));

  if (errors.length > 0) {
    console.error('CSP hash validation failed.');
    for (const error of errors) {
      console.error(error);
    }
    console.error('Run "npm run csp:hash" to regenerate hashes in _headers.');
    process.exitCode = 1;
    return;
  }

  console.log(`CSP hashes are up to date (${expectedHashes.length}).`);
};

const shouldCheck = process.argv.includes('--check');
const hashes = await extractInlineScriptHashes();

if (shouldCheck) {
  await checkHeadersFile(hashes);
} else {
  await updateHeadersFile(hashes);
  console.log(`Updated CSP hashes (${hashes.length}) in _headers.`);
}
