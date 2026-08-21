import fs from "fs";
import path from "path";

const rootDir = process.cwd();

const rules = [
  {
    id: "typo-pryat",
    description: "Literówka " + '"pryat"' + " w treści publicznej.",
    match: /pryat/giu
  },
  {
    id: "typo-spis-tresci",
    description: 'Brak polskich znaków w frazie "Spis treści".',
    match: /Spis tresci/gu
  },
  {
    id: "typo-polityka-prywatnosci",
    description: 'Brak polskich znaków w frazie "Polityka prywatności".',
    match: /Polityka prywatnosci/gu
  },
  {
    id: "typo-scroll-gore",
    description: 'Fraza scroll-to-top bez polskich znaków (oczekiwane "górę").',
    match: /(Przewin na gore|Na gore)/gu
  }
];

const getLineNumber = (lineStarts, index) => {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) {
      if (mid === lineStarts.length - 1 || lineStarts[mid + 1] > index) {
        return mid + 1;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return 1;
};

const buildLineStarts = (text) => {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
};

const getLineText = (text, lineNumber) => {
  const lines = text.split(/\r?\n/);
  return lines[lineNumber - 1] || "";
};

const walkHtmlFiles = (dirPath) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkHtmlFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(absolutePath);
    }
  }

  return files;
};

const htmlFiles = walkHtmlFiles(rootDir).sort((a, b) => a.localeCompare(b, "pl"));
const violations = [];

for (const filePath of htmlFiles) {
  const text = fs.readFileSync(filePath, "utf8");
  const lineStarts = buildLineStarts(text);

  for (const rule of rules) {
    rule.match.lastIndex = 0;
    let match;

    while ((match = rule.match.exec(text)) !== null) {
      const line = getLineNumber(lineStarts, match.index);
      const column = match.index - lineStarts[line - 1] + 1;
      const relPath = path.relative(rootDir, filePath).replaceAll(path.sep, "/");
      const snippet = getLineText(text, line).trim();

      violations.push({
        ruleId: rule.id,
        message: rule.description,
        file: relPath,
        line,
        column,
        snippet
      });

      if (match[0].length === 0) {
        rule.match.lastIndex += 1;
      }
    }
  }
}

violations.sort((a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file, "pl");
  if (a.line !== b.line) return a.line - b.line;
  if (a.column !== b.column) return a.column - b.column;
  return a.ruleId.localeCompare(b.ruleId, "pl");
});

if (violations.length > 0) {
  console.log("TEXT LINT: FAIL");
  for (const item of violations) {
    console.log(`${item.file}:${item.line}:${item.column} [${item.ruleId}] ${item.message}`);
    console.log(`  ${item.snippet}`);
  }
  console.log(`Total text issues: ${violations.length}`);
  process.exit(1);
} else {
  console.log("TEXT LINT: PASS");
  process.exit(0);
}
