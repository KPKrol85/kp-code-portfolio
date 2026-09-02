const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const cssSourceDir = path.join(rootDir, "styles", "src");
const customPropertyPattern = /--[A-Za-z0-9_-]+/;
const definitionPattern = /(^|[;{}\s])(--[A-Za-z0-9_-]+)\s*:/g;
const usagePattern = /var\(\s*(--[A-Za-z0-9_-]+)/g;

function toProjectPath(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\r\n]/g, " ")
  );
}

function getLineStarts(source) {
  const starts = [0];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }

  return starts;
}

function getLocation(lineStarts, index) {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (lineStarts[mid] <= index) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const lineIndex = Math.max(0, high);

  return {
    line: lineIndex + 1,
    column: index - lineStarts[lineIndex] + 1,
  };
}

function collectCssFiles() {
  if (!fs.existsSync(cssSourceDir)) {
    throw new Error("Missing CSS source directory: styles/src");
  }

  return fs
    .readdirSync(cssSourceDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".css") && !entry.name.endsWith(".min.css")
    )
    .map((entry) => path.join(cssSourceDir, entry.name))
    .sort();
}

function readCssFiles(files) {
  return files.map((filePath) => {
    const source = fs.readFileSync(filePath, "utf8");

    return {
      filePath,
      source,
      searchableSource: stripComments(source),
      lineStarts: getLineStarts(source),
    };
  });
}

function collectDefinitions(cssFiles) {
  const definitions = new Set();

  for (const cssFile of cssFiles) {
    let match;

    while ((match = definitionPattern.exec(cssFile.searchableSource)) !== null) {
      if (customPropertyPattern.test(match[2])) {
        definitions.add(match[2]);
      }
    }
  }

  return definitions;
}

function collectUsages(cssFiles) {
  const usages = [];

  for (const cssFile of cssFiles) {
    let match;

    while ((match = usagePattern.exec(cssFile.searchableSource)) !== null) {
      const propertyIndex = match.index + match[0].indexOf(match[1]);
      const location = getLocation(cssFile.lineStarts, propertyIndex);

      usages.push({
        filePath: cssFile.filePath,
        property: match[1],
        line: location.line,
        column: location.column,
      });
    }
  }

  return usages;
}

function reportUnresolved(unresolved) {
  console.error("[css-vars] Unresolved CSS custom property usage(s):");

  for (const usage of unresolved) {
    console.error(
      `  ${toProjectPath(usage.filePath)}:${usage.line}:${usage.column} ${usage.property}`
    );
  }
}

function run() {
  const cssFiles = readCssFiles(collectCssFiles());
  const definitions = collectDefinitions(cssFiles);
  const usages = collectUsages(cssFiles);
  const unresolved = usages.filter((usage) => !definitions.has(usage.property));

  if (unresolved.length > 0) {
    reportUnresolved(unresolved);
    process.exit(1);
  }

  console.log(
    `[css-vars] OK: ${usages.length} var() usage(s), ${definitions.size} custom property definition(s), ${cssFiles.length} source CSS file(s).`
  );
}

try {
  run();
} catch (error) {
  console.error(`[css-vars] ${error.message}`);
  process.exit(1);
}
