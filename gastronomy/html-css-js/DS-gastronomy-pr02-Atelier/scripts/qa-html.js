const path = require("node:path");
const { FileSystemConfigLoader, HtmlValidate, formatterFactory } = require("html-validate");
const { rootDir, htmlPages, composePageWithOrigins } = require("./build-config.js");

/*
 The 11 pages as the servers and the build deliver them: composed from their templates and partials/,
 then validated under the repository .htmlvalidate.json, which each page's own path resolves.
*/
async function validateComposedPages() {
  const validator = new HtmlValidate(new FileSystemConfigLoader());
  const results = [];
  for (const page of htmlPages) {
    const { html, lineOrigins } = composePageWithOrigins(page);
    const report = await validator.validateString(html, path.join(rootDir, page));
    results.push(...report.results.map((result) => ({
      ...result,
      messages: result.messages.map((message) => {
        const origin = Number.isInteger(message.line) && message.line > 0 ? lineOrigins[message.line - 1] : null;
        const source = origin
          ? `source: ${origin.file}:${origin.line}`
          : "source unavailable: diagnostic has no mapped line";
        return { ...message, message: `${message.message} (${source})` };
      }),
    })));
  }
  if (results.length) {
    console.log(formatterFactory("stylish")(results));
    console.log("Diagnostic line/column positions refer to composed pages; source locations identify editable files (line only).");
  }
  if (results.some((result) => result.errorCount > 0)) {
    process.exitCode = 1;
    return;
  }
  console.log(`Composed HTML valid: ${htmlPages.length} pages.`);
}

validateComposedPages().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
