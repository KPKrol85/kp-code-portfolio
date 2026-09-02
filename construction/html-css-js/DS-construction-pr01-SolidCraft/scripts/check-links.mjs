#!/usr/bin/env node

import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { resolveContentType } from './utils/mime-types.mjs';
import partials from './utils/partials.js';

const { PARTIALS_DIR_NAME, renderHtmlFile } = partials;

const projectRoot = process.cwd();
const htmlFiles = await collectHtmlFiles(projectRoot);

if (htmlFiles.length === 0) {
  console.log('PASS check:links (no HTML files found)');
  process.exit(0);
}

// Pages are validated after their shared header/footer partials are expanded,
// so navigation, document and anchor targets stay covered by this check.
const renderedHtml = new Map();
for (const file of htmlFiles) {
  const { html } = await renderHtmlFile(file, { rootDir: projectRoot });
  renderedHtml.set(file, html);
}

const anchorIndex = new Map();
for (const file of htmlFiles) {
  anchorIndex.set(file, extractAnchors(renderedHtml.get(file)));
}

const server = await startStaticServer(projectRoot);
const failures = [];
const warnings = [];
const externalCache = new Map();

for (const file of htmlFiles) {
  const links = extractAnchorHrefs(renderedHtml.get(file));

  for (const link of links) {
    const href = link.value.trim();
    if (!href || isIgnoredHref(href)) continue;

    if (isExternalHttp(href)) {
      const externalResult = await checkExternalLink(href, externalCache);
      if (externalResult.type === 'fail') {
        failures.push(formatFailure(file, link.line, href, externalResult.message));
      }
      if (externalResult.type === 'warn') {
        warnings.push(formatFailure(file, link.line, href, externalResult.message));
      }
      continue;
    }

    const internalError = await checkInternalLink({
      href,
      sourceFile: file,
      sourceDir: path.dirname(file),
      htmlFiles,
      anchorIndex,
      serverPort: server.port,
    });

    if (internalError) failures.push(formatFailure(file, link.line, href, internalError));
  }
}

await stopServer(server.server);

if (failures.length > 0) {
  console.error(`FAIL check:links (${failures.length} issue${failures.length === 1 ? '' : 's'})`);
  for (const failure of failures) console.error(`- ${failure}`);
  if (warnings.length > 0) {
    console.error(`WARN check:links (${warnings.length} external link${warnings.length === 1 ? '' : 's'} skipped)`);
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.log(`PASS check:links (${htmlFiles.length} HTML files scanned, ${warnings.length} external link checks skipped)`);
  for (const warning of warnings) console.log(`- ${warning}`);
} else {
  console.log(`PASS check:links (${htmlFiles.length} HTML files scanned)`);
}

async function collectHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.lighthouse-reports' || entry.name === PARTIALS_DIR_NAME) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectHtmlFiles(fullPath)));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(fullPath);
  }
  return files;
}

function extractAnchors(html) {
  const anchors = new Set();
  const regexes = [/\sid\s*=\s*(["'])(.*?)\1/gi, /<a[^>]*\sname\s*=\s*(["'])(.*?)\1/gi];
  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const value = match[2].trim();
      if (value) anchors.add(decodeURIComponentSafe(value));
    }
  }
  return anchors;
}

function extractAnchorHrefs(html) {
  const links = [];
  const anchorTagRegex = /<a\b[^>]*>/gi;
  let tagMatch;
  while ((tagMatch = anchorTagRegex.exec(html)) !== null) {
    const hrefMatch = /\shref\s*=\s*(["'])(.*?)\1/i.exec(tagMatch[0]);
    if (!hrefMatch) continue;
    links.push({ value: hrefMatch[2], line: toLineNumber(html, tagMatch.index) });
  }
  return links;
}

function isIgnoredHref(href) {
  const lower = href.toLowerCase();
  return (
    href === '#' ||
    lower.startsWith('#!') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  );
}

function isExternalHttp(href) {
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//');
}

async function checkExternalLink(href, cache) {
  if (cache.has(href)) return cache.get(href);

  const resolvedHref = href.startsWith('//') ? `https:${href}` : href;
  let result = { type: 'ok', message: '' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response = await fetch(resolvedHref, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(resolvedHref, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }

    clearTimeout(timeout);
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        result = { type: 'warn', message: `SKIP external HTTP ${response.status}` };
      } else {
        result = { type: 'fail', message: `external URL returned HTTP ${response.status}` };
      }
    }
  } catch (err) {
    result = { type: 'warn', message: `external URL could not be validated (${err.name})` };
  }

  cache.set(href, result);
  return result;
}

async function checkInternalLink({ href, sourceFile, sourceDir, htmlFiles, anchorIndex, serverPort }) {
  const sourceRelative = toPosix(path.relative(projectRoot, sourceFile));
  let linkPath = href;
  let fragment = '';

  if (href.includes('#')) {
    const parts = href.split('#');
    linkPath = parts[0];
    fragment = decodeURIComponentSafe(parts.slice(1).join('#'));
  }

  let targetFile;
  if (!linkPath) {
    targetFile = sourceFile;
  } else {
    const cleanPath = stripQuery(linkPath);
    targetFile = cleanPath.startsWith('/') ? path.join(projectRoot, cleanPath) : path.resolve(sourceDir, cleanPath);
    if (targetFile.endsWith(path.sep)) targetFile = path.join(targetFile, 'index.html');

    const stat = await safeStat(targetFile);
    if (stat?.isDirectory()) {
      targetFile = path.join(targetFile, 'index.html');
    } else if (!path.extname(targetFile)) {
      const htmlCandidate = `${targetFile}.html`;
      const htmlStat = await safeStat(htmlCandidate);
      if (htmlStat?.isFile()) targetFile = htmlCandidate;
    }
  }

  const route = buildRoute(sourceRelative, href);
  const fetchResult = await fetchInternal(route, serverPort);
  if (!fetchResult.ok) return `internal link returned HTTP ${fetchResult.status}`;

  if (fragment) {
    const normalized = path.normalize(targetFile);
    if (!htmlFiles.includes(normalized)) return `anchor target file not found (${toPosix(path.relative(projectRoot, normalized))})`;
    const targetAnchors = anchorIndex.get(normalized) || new Set();
    if (!targetAnchors.has(fragment)) return `missing anchor #${fragment} in ${toPosix(path.relative(projectRoot, normalized))}`;
  }

  return null;
}

function buildRoute(sourceRelative, href) {
  if (href.startsWith('/')) return stripQuery(href);
  if (href.startsWith('#')) return `/${sourceRelative}${href}`;
  const baseDir = toPosix(path.dirname(sourceRelative));
  return `/${toPosix(path.join(baseDir, stripQuery(href)))}`;
}

async function fetchInternal(route, port) {
  const normalized = route.replace(/\\/g, '/');
  const url = `http://127.0.0.1:${port}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 'ERR' };
  }
}

function stripQuery(value) { return value.split('?')[0]; }
function toLineNumber(content, index) { return content.slice(0, index).split('\n').length; }
function formatFailure(file, line, ref, reason) { return `${toPosix(path.relative(projectRoot, file))}:${line} -> ${ref} (${reason})`; }
function toPosix(value) { return value.split(path.sep).join('/'); }
function decodeURIComponentSafe(value) { try { return decodeURIComponent(value); } catch { return value; } }
async function safeStat(file) { try { return await fs.stat(file); } catch { return null; } }

function resolveServerPath(urlPath) {
  const withoutQuery = stripQuery(urlPath).split('#')[0];
  const clean = decodeURIComponentSafe(withoutQuery);
  const relative = clean.replace(/^\/+/, '') || 'index.html';
  return path.join(projectRoot, relative);
}

async function startStaticServer() {
  const server = createServer(async (req, res) => {
    const reqUrl = req.url || '/';
    let filePath = resolveServerPath(reqUrl);
    const stat = await safeStat(filePath);
    if (stat?.isDirectory()) filePath = path.join(filePath, 'index.html');
    const exists = await safeStat(filePath);
    if (!exists?.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': resolveContentType(ext) });
    res.end(data);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, port: typeof address === 'object' && address ? address.port : 0 };
}

async function stopServer(server) {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}
