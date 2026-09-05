import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minify } from "terser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const entryFile = path.join(projectRoot, "js/main.js");
const outFile = path.join(projectRoot, "dist/script.min.js");

const moduleCache = new Map();

const normalizeId = (absolutePath) => path.relative(projectRoot, absolutePath).replace(/\\/g, "/");

const resolveImport = (importPath, importerPath) => {
  const baseDir = path.dirname(importerPath);
  let resolved = path.resolve(baseDir, importPath);
  if (!path.extname(resolved)) {
    resolved += ".js";
  }
  return resolved;
};

const parseImports = (source) => {
  const imports = [];
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    imports.push({ names: match[1].trim(), path: match[2] });
  }
  return imports;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const transformModule = async (filePath) => {
  const resolvedPath = path.resolve(filePath);
  if (moduleCache.has(resolvedPath)) {
    return moduleCache.get(resolvedPath);
  }
  const source = await fs.readFile(resolvedPath, "utf8");
  const imports = parseImports(source);
  let transformed = source;

  imports.forEach((imp) => {
    const depPath = resolveImport(imp.path, resolvedPath);
    const depId = normalizeId(depPath);
    const importRegex = new RegExp(
      `import\\s+\\{\\s*${escapeRegExp(imp.names)}\\s*\\}\\s+from\\s+["']${escapeRegExp(imp.path)}["']\\s*;?`,
      "g"
    );
    const replacement = `const { ${imp.names} } = __require("${depId}");`;
    transformed = transformed.replace(importRegex, replacement);
  });

  const exports = [];
  transformed = transformed.replace(/export\s+const\s+(\w+)\s*=/g, (_, name) => {
    exports.push(name);
    return `const ${name} =`;
  });
  transformed = transformed.replace(/export\s+function\s+(\w+)\s*\(/g, (_, name) => {
    exports.push(name);
    return `function ${name}(`;
  });
  transformed = transformed.replace(/export\s+\{([^}]+)\};?/g, (_, names) => {
    names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .forEach((n) => exports.push(n));
    return "";
  });

  const exportLines = exports.map((name) => `__exports.${name} = ${name};`).join("\n");
  if (exportLines) {
    transformed = `${transformed}\n${exportLines}\n`;
  }

  const id = normalizeId(resolvedPath);
  const module = { id, filePath: resolvedPath, code: transformed, imports };
  moduleCache.set(resolvedPath, module);

  await Promise.all(imports.map((imp) => transformModule(resolveImport(imp.path, resolvedPath))));

  return module;
};

// Discovery stays concurrent, so moduleCache insertion order follows whichever
// file read finished first - scheduling, not source. Emission is ordered here by
// the stable normalized module id instead, so identical sources always produce
// identical bundle bytes and therefore an identical content hash. Registration
// order carries no meaning at runtime: every module is stored as a closure and
// nothing executes until the trailing __require(entry) call below.
//
// Compared by code point rather than localeCompare, so the order cannot vary
// with the machine's locale.
const byModuleId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const build = async () => {
  await transformModule(entryFile);
  const modules = Array.from(moduleCache.values()).sort(byModuleId);
  const moduleEntries = modules
    .map((mod) => {
      return `__modules["${mod.id}"] = { exports: {}, executed: false, fn: (__exports) => {\n${mod.code}\n} };`;
    })
    .join("\n");

  const bundle = `(() => {\nconst __modules = {};\nconst __require = (id) => {\n  const mod = __modules[id];\n  if (!mod) throw new Error("Module not found: " + id);\n  if (mod.executed) return mod.exports;\n  mod.executed = true;\n  mod.fn(mod.exports);\n  return mod.exports;\n};\n${moduleEntries}\n__require("${normalizeId(entryFile)}");\n})();`;

  const result = await minify(bundle);
  if (!result.code) throw new Error("Minification failed");

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, result.code);
};

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
