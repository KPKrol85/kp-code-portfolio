#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

import partials from './utils/partials.js';

const { PARTIALS_DIR_NAME, renderHtmlFile } = partials;

const projectRoot = process.cwd();
const htmlFiles = await collectHtmlFiles(projectRoot);
const failures = [];

for (const file of htmlFiles) {
  // Shared header/footer references are validated through the rendered page,
  // so the partial architecture never hides a broken asset path.
  const { html } = await renderHtmlFile(file, { rootDir: projectRoot });
  const refs = extractAssetReferences(html);

  for (const ref of refs) {
    const candidate = ref.value.trim();
    if (!candidate || isIgnoredReference(candidate)) {
      continue;
    }

    const srcDir = path.dirname(file);
    const resolved = resolveLocalPath(candidate, srcDir);

    if (!resolved) continue;

    const exists = await pathExists(resolved);
    if (!exists) {
      failures.push(
        `${toPosix(path.relative(projectRoot, file))}:${ref.line} -> ${ref.tag}[${ref.attr}]="${candidate}" (missing: ${toPosix(path.relative(projectRoot, resolved))})`
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`FAIL check:assets (${failures.length} issue${failures.length === 1 ? '' : 's'})`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`PASS check:assets (${htmlFiles.length} HTML file${htmlFiles.length === 1 ? '' : 's'} scanned)`);

async function collectHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.lighthouse-reports' || entry.name === PARTIALS_DIR_NAME) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractAssetReferences(html) {
  const refs = [];
  const patterns = [
    { tag: 'img', attr: 'src', regex: /<img\b[^>]*\ssrc\s*=\s*(["'])(.*?)\1/gi },
    { tag: 'script', attr: 'src', regex: /<script\b[^>]*\ssrc\s*=\s*(["'])(.*?)\1/gi },
    { tag: 'link', attr: 'href', regex: /<link\b[^>]*\shref\s*=\s*(["'])(.*?)\1/gi },
    { tag: 'source', attr: 'src', regex: /<source\b[^>]*\ssrc\s*=\s*(["'])(.*?)\1/gi },
    { tag: 'source', attr: 'srcset', regex: /<source\b[^>]*\ssrcset\s*=\s*(["'])(.*?)\1/gi },
    { tag: 'img', attr: 'srcset', regex: /<img\b[^>]*\ssrcset\s*=\s*(["'])(.*?)\1/gi },
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(html)) !== null) {
      const value = match[2];
      const line = toLineNumber(html, match.index);

      if (pattern.attr === 'srcset') {
        for (const candidate of parseSrcset(value)) {
          refs.push({ ...pattern, value: candidate, line });
        }
      } else {
        refs.push({ ...pattern, value, line });
      }
    }
  }

  return refs;
}

function parseSrcset(value) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+/)[0])
    .filter(Boolean);
}

function isIgnoredReference(value) {
  const lower = value.toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('//') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('data:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('#')
  );
}

function resolveLocalPath(value, sourceDir) {
  const clean = value.split('?')[0].split('#')[0].trim();
  if (!clean) return null;

  if (clean.startsWith('/')) {
    return path.join(projectRoot, clean);
  }

  return path.resolve(sourceDir, clean);
}

function toLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

async function pathExists(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch {
    return false;
  }
}
