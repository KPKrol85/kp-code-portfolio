const fs = require("fs");
const path = require("path");
const { createLogger } = require("./utils/logger");

const logger = createLogger();
const outputPath = path.join(process.cwd(), "dist", "css", "style.min.css");

logger.debug(`verify-css-build: checking ${outputPath}`);

if (!fs.existsSync(outputPath)) {
  logger.error(`Missing CSS output: ${outputPath}`);
  process.exit(1);
}

const css = fs.readFileSync(outputPath, "utf8");

if (/@import\b/i.test(css)) {
  logger.error(
    "CSS build verification failed: '@import' found in dist/css/style.min.css",
  );
  process.exit(1);
}

logger.summary("OK: CSS build verification passed.");
